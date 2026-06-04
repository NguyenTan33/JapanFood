using System.Net;
using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Security;

public static class RateLimiterExtensions
{
    public const string AuthPolicy = "AuthPolicy";
    public const string SendOtpPolicy = "SendOtpPolicy";
    public const string VerifyOtpPolicy = "VerifyOtpPolicy";
    public const string CustomerPolicy = "CustomerPolicy";
    public const string PaymentPolicy = "PaymentPolicy";
    public const string StaffPolicy = "StaffPolicy";

    public static IServiceCollection AddSystemRateLimiting(this IServiceCollection services)
    {
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

            options.OnRejected = async (context, token) =>
            {
                context.HttpContext.Response.ContentType = "application/json";
                var retryAfter = "60";
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retrySpan))
                {
                    retryAfter = ((int)retrySpan.TotalSeconds).ToString();
                    context.HttpContext.Response.Headers.RetryAfter = retryAfter;
                }

                var response = new
                {
                    statusCode = StatusCodes.Status429TooManyRequests,
                    code = "TOO_MANY_REQUESTS",
                    message = $"Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau {retryAfter} giây."
                };

                await context.HttpContext.Response.WriteAsync(
                    System.Text.Json.JsonSerializer.Serialize(response),
                    token);
            };

            // 1. Global Limiter cho tất cả endpoints: 100 requests / phút / Client IP (Bỏ qua CORS Preflight OPTIONS)
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
            {
                if (HttpMethods.IsOptions(httpContext.Request.Method))
                {
                    return RateLimitPartition.GetNoLimiter("cors_preflight");
                }

                var clientKey = ResolveClientKey(httpContext);
                var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString();
                var isLocalProxy = remoteIp == "::1" || remoteIp == "127.0.0.1" || httpContext.Request.Host.Host == "localhost";
                if (isLocalProxy)
                {
                    return RateLimitPartition.GetNoLimiter("localhost_global");
                }

                return RateLimitPartition.GetSlidingWindowLimiter(
                    clientKey,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 100,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 0
                    });
            });

            // 2. Auth Policy (Login, Register, Refresh Token, Reset Password): 20 requests / phút
            options.AddPolicy(AuthPolicy, httpContext =>
            {
                var partitionKey = $"auth_{ResolveClientKey(httpContext)}";
                return RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 20,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 4,
                        QueueLimit = 0
                    });
            });

            // 3. Send OTP Policy (Chống spam SMS OTP): 5 requests / phút
            options.AddPolicy(SendOtpPolicy, httpContext =>
            {
                var partitionKey = $"otp_send_{ResolveClientKey(httpContext)}";
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 5,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    });
            });

            // 4. Verify OTP Policy (Chống brute-force OTP): 10 requests / phút
            options.AddPolicy(VerifyOtpPolicy, httpContext =>
            {
                var partitionKey = $"otp_verify_{ResolveClientKey(httpContext)}";
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 10,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    });
            });

            // 5. Customer Policy: 60 requests / phút
            options.AddPolicy(CustomerPolicy, httpContext =>
            {
                var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString();
                var isLocalProxy = remoteIp == "::1" || remoteIp == "127.0.0.1" || httpContext.Request.Host.Host == "localhost";
                if (isLocalProxy)
                {
                    return RateLimitPartition.GetNoLimiter("localhost_cust");
                }

                var partitionKey = $"cust_{ResolveClientKey(httpContext)}";
                return RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 60,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 2,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    });
            });

            // 6. Payment Policy: 30 requests / phút
            options.AddPolicy(PaymentPolicy, httpContext =>
            {
                var partitionKey = $"pay_{ResolveClientKey(httpContext)}";
                return RateLimitPartition.GetFixedWindowLimiter(
                    partitionKey,
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = 30,
                        Window = TimeSpan.FromMinutes(1),
                        QueueLimit = 0
                    });
            });

            // 7. Staff & Operations Policy: 120 requests / phút
            options.AddPolicy(StaffPolicy, httpContext =>
            {
                var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString();
                var isLocalProxy = remoteIp == "::1" || remoteIp == "127.0.0.1" || httpContext.Request.Host.Host == "localhost";
                if (isLocalProxy)
                {
                    return RateLimitPartition.GetNoLimiter("localhost_staff");
                }

                var partitionKey = $"staff_{ResolveClientKey(httpContext)}";
                return RateLimitPartition.GetSlidingWindowLimiter(
                    partitionKey,
                    _ => new SlidingWindowRateLimiterOptions
                    {
                        PermitLimit = 120,
                        Window = TimeSpan.FromMinutes(1),
                        SegmentsPerWindow = 6,
                        QueueLimit = 5,
                        QueueProcessingOrder = QueueProcessingOrder.OldestFirst
                    });
            });
        });

        return services;
    }

    public static string ResolveClientKey(HttpContext httpContext)
    {
        if (httpContext.User?.Identity?.IsAuthenticated == true)
        {
            var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                         ?? httpContext.User.FindFirstValue("sub")
                         ?? httpContext.User.FindFirstValue("customerId");
            if (!string.IsNullOrWhiteSpace(userId))
            {
                return $"user_{userId}";
            }
        }

        var remoteIp = httpContext.Connection.RemoteIpAddress?.ToString();
        var isLocalProxy = remoteIp == "::1" || remoteIp == "127.0.0.1";

        if (isLocalProxy)
        {
            if (httpContext.Request.Headers.TryGetValue("CF-Connecting-IP", out var cfIp) &&
                !string.IsNullOrWhiteSpace(cfIp) &&
                IPAddress.TryParse(cfIp.ToString().Trim(), out _))
            {
                return $"ip_{cfIp.ToString().Trim()}";
            }

            if (httpContext.Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) &&
                !string.IsNullOrWhiteSpace(forwardedFor))
            {
                var candidate = forwardedFor.ToString().Split(',')[0].Trim();
                if (IPAddress.TryParse(candidate, out _))
                {
                    return $"ip_{candidate}";
                }
            }
        }

        return !string.IsNullOrWhiteSpace(remoteIp) ? $"ip_{remoteIp}" : "ip_unknown";
    }
}
