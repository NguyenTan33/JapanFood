using System.Net;
using System.Security.Claims;
using Domain.Constants;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class BaseApiController : ControllerBase
{
    protected int? GetCurrentUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? User.FindFirstValue("sub")
                    ?? User.FindFirstValue("customerId");
        return int.TryParse(claim, out var id) && id > 0 ? id : null;
    }

    protected bool IsStaffOrHigher()
    {
        return User.IsInRole(AppRoles.Staff)
            || User.IsInRole(AppRoles.Manager)
            || User.IsInRole(AppRoles.Admin);
    }

    protected string GetClientIpAddress()
    {
        var remoteIp = HttpContext?.Connection?.RemoteIpAddress?.ToString();
        var isLocalProxy = remoteIp == "::1" || remoteIp == "127.0.0.1";

        if (isLocalProxy && Request?.Headers != null)
        {
            if (Request.Headers.TryGetValue("CF-Connecting-IP", out var cfIp) &&
                !string.IsNullOrWhiteSpace(cfIp) &&
                IPAddress.TryParse(cfIp.ToString().Trim(), out var parsedCfIp))
            {
                return parsedCfIp.ToString();
            }

            if (Request.Headers.TryGetValue("X-Forwarded-For", out var forwardedFor) &&
                !string.IsNullOrWhiteSpace(forwardedFor))
            {
                var candidate = forwardedFor.ToString().Split(',')[0].Trim();
                if (IPAddress.TryParse(candidate, out var parsedForwardedIp))
                {
                    return parsedForwardedIp.ToString();
                }
            }
        }

        if (!string.IsNullOrWhiteSpace(remoteIp) && IPAddress.TryParse(remoteIp, out var validRemoteIp))
        {
            return validRemoteIp.ToString();
        }

        return "127.0.0.1";
    }

    protected string ResolveSafeReturnUrl(string? requestedReturnUrl, string defaultRelativePath)
    {
        var defaultUrl = $"{Request.Scheme}://{Request.Host}{defaultRelativePath}";
        if (string.IsNullOrWhiteSpace(requestedReturnUrl))
        {
            return defaultUrl;
        }

        var trimmed = requestedReturnUrl.Trim();
        if (trimmed.StartsWith('/') && !trimmed.StartsWith("//") && !trimmed.StartsWith("/\\"))
        {
            return $"{Request.Scheme}://{Request.Host}{trimmed}";
        }

        if (Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            var currentHost = Request.Host.Host;
            if (string.Equals(uri.Host, currentHost, StringComparison.OrdinalIgnoreCase) ||
                string.Equals(uri.Host, "localhost", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(uri.Host, "127.0.0.1", StringComparison.OrdinalIgnoreCase))
            {
                return uri.ToString();
            }
        }

        return defaultUrl;
    }
}
