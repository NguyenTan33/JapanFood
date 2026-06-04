using System.Security.Claims;
using System.Text;
using API.Middlewares;
using API.Security;
using Application.Interfaces;
using Infrastructure;
using Infrastructure.Seeders;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    ContentRootPath = AppContext.BaseDirectory
});

var defaultUrl = builder.Configuration["Urls"] ?? "http://localhost:5243";
builder.WebHost.UseUrls(defaultUrl);

// 0. Normalize Storage:UploadPath against ContentRootPath so LocalFileStorageService & UseStaticFiles share exact root
var configuredUploadPath = builder.Configuration["Storage:UploadPath"];
var resolvedWebRoot = string.IsNullOrWhiteSpace(configuredUploadPath)
    ? Path.Combine(builder.Environment.ContentRootPath, "wwwroot")
    : (Path.IsPathRooted(configuredUploadPath)
        ? configuredUploadPath
        : Path.Combine(builder.Environment.ContentRootPath, configuredUploadPath));
builder.Configuration["Storage:UploadPath"] = Path.GetFullPath(resolvedWebRoot);

// 1. Add Infrastructure Services (SQL Server DbContext, Auth Services, Validation Factory)
builder.Services.AddInfrastructureServices(builder.Configuration);

// 2. Add Authentication & JWT Bearer
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? "JapanFood_Super_Secret_Key_For_Jwt_Authentication_Must_Be_Long_Enough_2026!";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidateIssuer = !string.IsNullOrEmpty(builder.Configuration["Jwt:Issuer"]),
        ValidIssuer = builder.Configuration["Jwt:Issuer"],
        ValidateAudience = !string.IsNullOrEmpty(builder.Configuration["Jwt:Audience"]),
        ValidAudience = builder.Configuration["Jwt:Audience"],
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };

    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var userIdClaim = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? context.Principal?.FindFirstValue("sub")
                ?? context.Principal?.FindFirstValue("userId");

            if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
            {
                context.Fail("Token không chứa thông tin tài khoản hợp lệ.");
                return;
            }

            var db = context.HttpContext.RequestServices.GetRequiredService<IJapanFoodDbContext>();
            var userState = await db.Users
                .AsNoTracking()
                .Where(u => u.UserId == userId)
                .Select(u => new { u.AccountStatus, u.Role })
                .FirstOrDefaultAsync(context.HttpContext.RequestAborted);

            if (userState == null || userState.AccountStatus == "LOCKED" || userState.AccountStatus == "DELETED")
            {
                context.HttpContext.Items["AuthFailureCode"] = "ACCOUNT_LOCKED";
                context.HttpContext.Items["AuthFailureMessage"] = "Tài khoản của bạn đã bị khóa hoặc không còn hoạt động.";
                context.Fail("Tài khoản đã bị khóa.");
                return;
            }

            if (context.Principal?.Identity is ClaimsIdentity identity)
            {
                foreach (var oldRole in identity.FindAll(ClaimTypes.Role).Concat(identity.FindAll("role")).ToList())
                {
                    identity.RemoveClaim(oldRole);
                }

                var liveRole = string.IsNullOrWhiteSpace(userState.Role) ? "CUSTOMER" : userState.Role;
                identity.AddClaim(new Claim(ClaimTypes.Role, liveRole));
                identity.AddClaim(new Claim("role", liveRole));
            }
        },
        OnAuthenticationFailed = context =>
        {
            if (context.Exception is SecurityTokenExpiredException)
            {
                context.Response.Headers.Append("Token-Expired", "true");
            }
            return Task.CompletedTask;
        },
        OnChallenge = async context =>
        {
            if (!context.Response.HasStarted)
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";

                string code;
                string message;
                if (context.HttpContext.Items.TryGetValue("AuthFailureCode", out var customCodeObj) &&
                    customCodeObj is string customCode)
                {
                    code = customCode;
                    message = context.HttpContext.Items.TryGetValue("AuthFailureMessage", out var customMsgObj) &&
                              customMsgObj is string customMsg
                        ? customMsg
                        : "Tài khoản của bạn đã bị khóa hoặc không còn hoạt động.";
                }
                else
                {
                    var isExpired = context.Response.Headers.ContainsKey("Token-Expired");
                    code = isExpired ? "TOKEN_EXPIRED" : "UNAUTHORIZED";
                    message = isExpired
                        ? "Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại."
                        : "Bạn chưa đăng nhập hoặc không có quyền truy cập tính năng này.";
                }

                var json = System.Text.Json.JsonSerializer.Serialize(new
                {
                    statusCode = 401,
                    code,
                    message
                });
                await context.Response.WriteAsync(json);
            }
        }
    };
});

// 3. Rate Limiting (Chống spam và Brute-force)
builder.Services.AddSystemRateLimiting();

// 4. CORS Whitelist (Hardened & Preflight Optimized)
var configuredOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://localhost:3000", "http://localhost:5000", "https://localhost:5001" };

var allowedOrigins = configuredOrigins
    .Where(o => !string.IsNullOrWhiteSpace(o) && o.Trim() != "*" && Uri.TryCreate(o.Trim(), UriKind.Absolute, out _))
    .Select(o => o.Trim().TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

var isDevEnv = builder.Environment.IsDevelopment();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin)) return false;
                var normalized = origin.Trim().TrimEnd('/');
                if (allowedOrigins.Contains(normalized, StringComparer.OrdinalIgnoreCase))
                {
                    return true;
                }

                if (isDevEnv && Uri.TryCreate(normalized, UriKind.Absolute, out var uri) &&
                    (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps) &&
                    (string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase)))
                {
                    return true;
                }

                return false;
            })
            .AllowAnyHeader()
            .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .WithExposedHeaders("Token-Expired", "Retry-After", "Content-Disposition")
            .SetPreflightMaxAge(TimeSpan.FromMinutes(10))
            .AllowCredentials();
    });
});

// 5. Controllers & Zero Trust Authorization
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
builder.Services.AddSingleton<API.Services.TableAlertStore>();

builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

// 6. OpenAPI & Swagger with Bearer JWT
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, cancellationToken) =>
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes["Bearer"] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
            Description = "Dán Access Token (JWT) vào đây để xác thực"
        };
        return Task.CompletedTask;
    });
});

builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "JapanFood Web API",
        Version = "v1",
        Description = "Hệ thống Backend JapanFood - SQL Server & JWT / Google Authentication"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Nhập JWT Token: Bearer {token} hoặc dán chuỗi token vào ô bên dưới."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// 0. CORS must run before ExceptionHandlingMiddleware & RateLimiter so error responses (400/401/403/429/500) always include CORS headers
app.UseCors("AllowFrontend");

// 1. Error Handling Middleware
app.UseMiddleware<ExceptionHandlingMiddleware>();

// 2. Security Headers (OWASP)
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Frame-Options", "DENY");
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-XSS-Protection", "0");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    context.Response.Headers.Append("Content-Security-Policy", "default-src 'self'; frame-ancestors 'none';");
    await next();
});

// 2.1 Static files (Avatars, uploads)
var wwwrootDir = Path.GetFullPath(
    app.Configuration["Storage:UploadPath"]
    ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"));
if (!Directory.Exists(wwwrootDir))
{
    Directory.CreateDirectory(wwwrootDir);
}
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(wwwrootDir),
    RequestPath = ""
});

// 3. Scalar API Reference & Swagger in Development
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference(options =>
    {
        options.WithTitle("JapanFood API - Scalar Reference")
               .WithTheme(ScalarTheme.Moon)
               .WithOpenApiRoutePattern("/swagger/v1/swagger.json");
    }).AllowAnonymous();

    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "JapanFood API v1");
        c.RoutePrefix = "swagger";
    });

    // Chuyển hướng trang chủ về Scalar để tiện test API
    app.MapGet("/", () => Results.Redirect("/scalar/v1")).AllowAnonymous();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseRateLimiter();
app.UseAuthorization();

app.MapControllers();

// 4. Seed Data & Database Initialization on Startup
await IdentityDbSeeder.SeedRolesAndAdminAsync(app.Services);

app.Run();
