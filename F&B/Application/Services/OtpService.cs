using System.Security.Cryptography;
using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Entities;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Application.Services;

public class OtpService : IOtpService
{
    private readonly IJapanFoodDbContext _context;
    private readonly IHashService _hashService;
    private readonly IPhoneService _phoneService;
    private readonly ISmsService _smsService;
    private readonly IConfiguration _configuration;
    private readonly IValidationFactory _validationFactory;
    private readonly ITokenService? _tokenService;

    public OtpService(
        IJapanFoodDbContext context,
        IHashService hashService,
        IPhoneService phoneService,
        ISmsService smsService,
        IConfiguration configuration,
        IValidationFactory validationFactory,
        ITokenService? tokenService = null)
    {
        _context = context;
        _hashService = hashService;
        _phoneService = phoneService;
        _smsService = smsService;
        _configuration = configuration;
        _validationFactory = validationFactory;
        _tokenService = tokenService;
    }

    private async Task<string?> ResolveNormalizedPhoneAsync(string? phoneNumber, string? email)
    {
        if (!string.IsNullOrWhiteSpace(phoneNumber) && !phoneNumber.Contains('@'))
        {
            return _phoneService.Normalize(phoneNumber);
        }

        var emailToLookup = !string.IsNullOrWhiteSpace(email) ? email.Trim().ToLower() : phoneNumber?.Trim().ToLower();
        if (string.IsNullOrWhiteSpace(emailToLookup))
            return null;

        return await _context.Users
            .AsNoTracking()
            .Where(x => x.Email.ToLower() == emailToLookup)
            .Select(x => x.PhoneNumber)
            .FirstOrDefaultAsync();
    }

    private string GetOtpSecret() =>
        _configuration["Otp:Secret"] ?? "JapanFood_Otp_Secret_Key_Hmac_2026!";

    public async Task<string> GenerateAndSaveOtpAsync(string phoneNumber, string purpose)
    {
        // 1. Kiểm tra cooldown chống spam SMS và SMS Toll Fraud (60 giây)
        var recentOtp = await _context.OtpVerifications
            .Where(x => x.PhoneNumber == phoneNumber && x.Purpose == purpose)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (recentOtp != null && (DateTime.UtcNow - recentOtp.CreatedAt) < TimeSpan.FromSeconds(60))
        {
            var remainingSeconds = 60 - (int)(DateTime.UtcNow - recentOtp.CreatedAt).TotalSeconds;
            throw new BusinessException($"Vui lòng đợi {remainingSeconds} giây trước khi yêu cầu mã OTP mới.");
        }

        // 2. Sinh mã OTP 6 số ngẫu nhiên chuẩn mã hóa an toàn (CSPRNG)
        var otp = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        var otpHash = _hashService.Hash(otp, GetOtpSecret());

        var otpVerification = new OtpVerification
        {
            PhoneNumber = phoneNumber,
            OtpHash = otpHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(5),
            FailedAttempts = 0,
            IsUsed = false,
            Purpose = purpose,
            CreatedAt = DateTime.UtcNow
        };

        _context.OtpVerifications.Add(otpVerification);
        await _context.SaveChangesAsync();

        return otp;
    }

    public async Task ValidateOtpAsync(string phoneNumber, string otp, string purpose)
    {
        if (string.IsNullOrWhiteSpace(otp) || otp.Length != 6 || !otp.All(char.IsDigit))
        {
            throw new BusinessException("Mã OTP không hợp lệ.");
        }

        var otpVerification = await _context.OtpVerifications
            .Where(x => x.PhoneNumber == phoneNumber && x.Purpose == purpose)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (otpVerification == null)
            throw new BusinessException("Mã OTP không tồn tại hoặc đã được sử dụng.");

        if (otpVerification.FailedAttempts >= 5)
            throw new BusinessException("Mã OTP đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.");

        if (otpVerification.IsUsed)
            throw new BusinessException("Mã OTP không tồn tại hoặc đã được sử dụng.");

        if (DateTime.UtcNow > otpVerification.ExpiresAt)
            throw new BusinessException("Mã OTP đã hết hạn. Vui lòng yêu cầu mã mới.");

        var isValid = _hashService.Verify(otp, otpVerification.OtpHash, GetOtpSecret());
        if (!isValid)
        {
            otpVerification.FailedAttempts++;
            await _context.SaveChangesAsync();
            if (otpVerification.FailedAttempts >= 5)
            {
                throw new BusinessException("Mã OTP đã bị khóa do nhập sai quá 5 lần. Vui lòng yêu cầu mã mới.");
            }
            throw new BusinessException("Mã OTP không chính xác.");
        }

        otpVerification.IsUsed = true;
        await _context.SaveChangesAsync();
    }

    public async Task<string> SendRegisterOtpAsync(string phoneNumber)
    {
        var normalizedPhone = _phoneService.Normalize(phoneNumber);
        var otp = await GenerateAndSaveOtpAsync(normalizedPhone, "Register");
        await _smsService.SendOtpAsync(normalizedPhone, otp);
        return otp;
    }

    public async Task<VerifyRegisterOtpResponse> VerifyRegisterOtpAsync(VerifyRegisterOtpRequest request)
    {
        await _validationFactory.ValidateAsync(request);
        var normalizedPhone = await ResolveNormalizedPhoneAsync(request.PhoneNumber, request.Email);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
        {
            throw new BusinessException("Mã OTP không tồn tại hoặc đã được sử dụng.");
        }

        await ValidateOtpAsync(normalizedPhone, request.Otp, "Register");

        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.PhoneNumber == normalizedPhone);

        if (user != null)
        {
            user.AccountStatus = "ACTIVE";
            await _context.SaveChangesAsync();
        }

        var response = new VerifyRegisterOtpResponse
        {
            Message = "Xác thực số điện thoại thành công. Tài khoản của bạn đã được kích hoạt.",
            UserId = user?.UserId.ToString() ?? string.Empty
        };

        if (user != null && _tokenService != null)
        {
            var accessToken = await _tokenService.GenerateAccessTokenAsync(user);
            var refreshToken = _tokenService.GenerateRefreshToken();
            var refreshTokenSecret = _configuration["RefreshToken:Secret"]
                ?? throw new InvalidOperationException("Refresh Token Secret chưa được cấu hình.");
            var refreshTokenHash = _hashService.Hash(refreshToken, refreshTokenSecret);
            var refreshTokenExpireDays = int.Parse(_configuration["RefreshToken:ExpireDays"] ?? "7");

            _context.RefreshTokens.Add(new RefreshToken
            {
                AccountId = user.UserId.ToString(),
                TokenHash = refreshTokenHash,
                ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpireDays),
                IsRevoked = false,
                CreatedAt = DateTime.UtcNow
            });
            await _context.SaveChangesAsync();

            var accessTokenExpireMinutes = int.Parse(_configuration["Jwt:ExpireMinutes"] ?? "120");
            response.AccessToken = accessToken;
            response.RefreshToken = refreshToken;
            response.ExpiresAt = DateTime.UtcNow.AddMinutes(accessTokenExpireMinutes);
            response.ExpiresInMinutes = accessTokenExpireMinutes;
            response.User = AuthenticationService.MapUserProfile(user);
        }

        return response;
    }

    public async Task<string> SendForgotPasswordOtpAsync(string phoneNumber)
    {
        var normalizedPhone = _phoneService.Normalize(phoneNumber);
        var otp = await GenerateAndSaveOtpAsync(normalizedPhone, "ForgotPassword");
        await _smsService.SendOtpAsync(normalizedPhone, otp);
        return otp;
    }

    public async Task<VerifyForgotPasswordOtpResponse> VerifyForgotPasswordOtpAsync(VerifyForgotPasswordOtpRequest request)
    {
        await _validationFactory.ValidateAsync(request);
        var normalizedPhone = await ResolveNormalizedPhoneAsync(request.PhoneNumber, request.Email);
        if (string.IsNullOrWhiteSpace(normalizedPhone))
            throw new BusinessException("Không tìm thấy tài khoản tương ứng.");

        await ValidateOtpAsync(normalizedPhone, request.Otp, "ForgotPassword");

        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.PhoneNumber == normalizedPhone);

        if (user == null)
            throw new BusinessException("Không tìm thấy tài khoản tương ứng.");

        // Sinh token ngẫu nhiên bảo mật 256-bit (32 bytes)
        var rawResetToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash = _hashService.Hash(rawResetToken, GetOtpSecret());

        var resetTokenEntity = new OtpVerification
        {
            PhoneNumber = normalizedPhone,
            OtpHash = tokenHash,
            Purpose = "PasswordResetToken",
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            IsUsed = false,
            FailedAttempts = 0,
            CreatedAt = DateTime.UtcNow
        };
        _context.OtpVerifications.Add(resetTokenEntity);
        await _context.SaveChangesAsync();

        return new VerifyForgotPasswordOtpResponse
        {
            ResetToken = rawResetToken,
            UserId = user.UserId.ToString()
        };
    }

    public async Task<ResendOtpResponse> ResendOtpAsync(ResendOtpRequest request)
    {
        await _validationFactory.ValidateAsync(request);
        var normalizedPhone = await ResolveNormalizedPhoneAsync(request.PhoneNumber, request.Email);

        if (string.IsNullOrWhiteSpace(normalizedPhone))
        {
            if (request.Purpose == "ForgotPassword")
            {
                return new ResendOtpResponse
                {
                    Message = "Mã OTP mới đã được gửi thành công."
                };
            }

            throw new BusinessException("Không tìm thấy tài khoản tương ứng.");
        }

        if (request.Purpose == "ForgotPassword")
        {
            var userExists = await _context.Users.AnyAsync(x => x.PhoneNumber == normalizedPhone);
            if (!userExists)
            {
                return new ResendOtpResponse
                {
                    Message = "Mã OTP mới đã được gửi thành công."
                };
            }
        }
        else if (request.Purpose == "Register")
        {
            var isAlreadyActive = await _context.Users
                .AnyAsync(x => x.PhoneNumber == normalizedPhone && x.AccountStatus == "ACTIVE");
            if (isAlreadyActive)
            {
                throw new BusinessException("Số điện thoại này đã được xác thực và đang hoạt động.");
            }
        }

        var otp = await GenerateAndSaveOtpAsync(normalizedPhone, request.Purpose);
        await _smsService.SendOtpAsync(normalizedPhone, otp);

        return new ResendOtpResponse
        {
            Message = "Mã OTP mới đã được gửi thành công."
        };
    }
}
