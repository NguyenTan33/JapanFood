using System.Security.Claims;
using Application.DTOs.Auth;
using Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Route("api/[controller]")]
[ApiController]
public class AuthController : ControllerBase
{
    private readonly IAuthenticationService _authenticationService;
    private readonly IOtpService _otpService;
    private readonly IPasswordService _passwordService;
    private readonly ITokenService _tokenService;
    private readonly IGoogleAuthService _googleAuthService;
    private readonly IWebHostEnvironment? _env;

    public AuthController(
        IAuthenticationService authenticationService,
        IOtpService otpService,
        IPasswordService passwordService,
        ITokenService tokenService,
        IGoogleAuthService googleAuthService,
        IWebHostEnvironment? env = null)
    {
        _authenticationService = authenticationService;
        _otpService = otpService;
        _passwordService = passwordService;
        _tokenService = tokenService;
        _googleAuthService = googleAuthService;
        _env = env;
    }

    // 1. REGISTER
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        var response = await _authenticationService.RegisterAsync(request);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    // 2. VERIFY REGISTER OTP
    [AllowAnonymous]
    [EnableRateLimiting("VerifyOtpPolicy")]
    [HttpPost("verify-otp")]
    [ProducesResponseType(typeof(VerifyRegisterOtpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyRegisterOtp([FromBody] VerifyRegisterOtpRequest request)
    {
        var response = await _otpService.VerifyRegisterOtpAsync(request);
        return Ok(response);
    }

    // 3. LOGIN
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var response = await _authenticationService.LoginAsync(request);
        return Ok(response);
    }

    // 4. GOOGLE LOGIN
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("google-login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GoogleLogin([FromBody] GoogleLoginRequest request)
    {
        var response = await _googleAuthService.GoogleLoginAsync(request);
        return Ok(response);
    }

    // 5. GOOGLE REGISTER
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("google-register")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> GoogleRegister([FromBody] GoogleRegisterRequest request)
    {
        var response = await _googleAuthService.GoogleRegisterAsync(request);
        return Ok(response);
    }

    // 6. REFRESH TOKEN
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("refresh")]
    [ProducesResponseType(typeof(RefreshTokenResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var response = await _tokenService.RefreshTokenAsync(request);
        return Ok(response);
    }

    // 7. LOGOUT
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Logout([FromBody] LogoutRequest request)
    {
        await _authenticationService.LogoutAsync(request);
        return Ok(new
        {
            statusCode = StatusCodes.Status200OK,
            message = "Đăng xuất thành công."
        });
    }

    // 8. FORGOT PASSWORD
    [AllowAnonymous]
    [EnableRateLimiting("SendOtpPolicy")]
    [HttpPost("forgot-password")]
    [ProducesResponseType(typeof(ForgotPasswordResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var response = await _passwordService.ForgotPasswordAsync(request);
        return Ok(response);
    }

    // 9. VERIFY FORGOT PASSWORD OTP
    [AllowAnonymous]
    [EnableRateLimiting("VerifyOtpPolicy")]
    [HttpPost("verify-forgot-password-otp")]
    [ProducesResponseType(typeof(VerifyForgotPasswordOtpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> VerifyForgotPasswordOtp([FromBody] VerifyForgotPasswordOtpRequest request)
    {
        var response = await _otpService.VerifyForgotPasswordOtpAsync(request);
        return Ok(response);
    }

    // 10. RESET PASSWORD
    [AllowAnonymous]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        await _passwordService.ResetPasswordAsync(request);
        return Ok(new
        {
            statusCode = StatusCodes.Status200OK,
            message = "Đặt lại mật khẩu thành công."
        });
    }

    // 11. RESEND OTP
    [AllowAnonymous]
    [EnableRateLimiting("SendOtpPolicy")]
    [HttpPost("resend-otp")]
    [ProducesResponseType(typeof(ResendOtpResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResendOtp([FromBody] ResendOtpRequest request)
    {
        var response = await _otpService.ResendOtpAsync(request);
        return Ok(response);
    }

    // 12. CHANGE PASSWORD
    [Authorize]
    [EnableRateLimiting("AuthPolicy")]
    [HttpPost("change-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(userId))
        {
            return Unauthorized(new
            {
                statusCode = StatusCodes.Status401Unauthorized,
                message = "Token không chứa thông tin tài khoản hợp lệ."
            });
        }

        await _passwordService.ChangePasswordAsync(userId, request);

        return Ok(new
        {
            statusCode = StatusCodes.Status200OK,
            message = "Đổi mật khẩu thành công."
        });
    }

    // 13. GET CURRENT USER PROFILE
    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMe(CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue("userId");

        if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
        {
            return Unauthorized(new
            {
                statusCode = StatusCodes.Status401Unauthorized,
                message = "Token không chứa thông tin tài khoản hợp lệ."
            });
        }

        var profile = await _authenticationService.GetCurrentUserAsync(userId, ct);
        return Ok(profile);
    }

    // 14. UPDATE PROFILE (FULL NAME, EMAIL, AVATAR)
    [Authorize]
    [HttpPut("profile")]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue("userId");

        if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
        {
            return Unauthorized(new
            {
                statusCode = StatusCodes.Status401Unauthorized,
                message = "Token không chứa thông tin tài khoản hợp lệ."
            });
        }

        var updated = await _authenticationService.UpdateProfileAsync(userId, request, ct);
        return Ok(updated);
    }

    // 15. SEND SMS OTP FOR PHONE NUMBER CHANGE
    [Authorize]
    [HttpPost("phone/send-otp")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> SendPhoneOtp([FromBody] SendPhoneOtpRequest request, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue("userId");

        if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
        {
            return Unauthorized(new
            {
                statusCode = StatusCodes.Status401Unauthorized,
                message = "Token không chứa thông tin tài khoản hợp lệ."
            });
        }

        var otp = await _authenticationService.SendChangePhoneOtpAsync(userId, request.NewPhoneNumber, ct);
        var isDev = _env?.IsDevelopment() ?? false;
        return Ok(new
        {
            statusCode = StatusCodes.Status200OK,
            message = $"Mã OTP xác thực đã được gửi đến số điện thoại {request.NewPhoneNumber}.",
            otp = isDev ? otp : null
        });
    }

    // 16. VERIFY SMS OTP AND UPDATE PHONE NUMBER
    [Authorize]
    [HttpPost("phone/verify-otp")]
    [ProducesResponseType(typeof(UserProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyPhoneOtp([FromBody] VerifyPhoneOtpRequest request, CancellationToken ct)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? User.FindFirstValue("userId");

        if (!int.TryParse(userIdClaim, out var userId) || userId <= 0)
        {
            return Unauthorized(new
            {
                statusCode = StatusCodes.Status401Unauthorized,
                message = "Token không chứa thông tin tài khoản hợp lệ."
            });
        }

        var profile = await _authenticationService.VerifyChangePhoneOtpAsync(userId, request.NewPhoneNumber, request.Otp, ct);
        return Ok(new
        {
            statusCode = StatusCodes.Status200OK,
            message = "Cập nhật số điện thoại thành công.",
            user = profile
        });
    }
}
