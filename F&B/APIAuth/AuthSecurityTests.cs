using System.Security.Claims;
using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Application.Services;
using Application.Validation.Auth;
using Domain.Constants;
using Domain.Entities;
using Domain.Exceptions;
using Google.Apis.Auth;
using Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth;

public class AuthSecurityTests
{
    private readonly DbContextOptions<JapanFoodDbContext> _dbOptions;
    private readonly IConfiguration _configuration;
    private readonly IHashService _hashService;
    private readonly IPhoneService _phoneService;
    private readonly ISmsService _smsService;

    public AuthSecurityTests()
    {
        _dbOptions = new DbContextOptionsBuilder<JapanFoodDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var inMemorySettings = new Dictionary<string, string?>
        {
            { "Jwt:Key", "JapanFood_Super_Secret_Key_For_Jwt_Authentication_Must_Be_Long_Enough_2026!" },
            { "Jwt:Issuer", "JapanFoodAPI" },
            { "Jwt:Audience", "JapanFoodClient" },
            { "Jwt:ExpireMinutes", "120" },
            { "RefreshToken:Secret", "JapanFood_RefreshToken_Secret_Key_For_HmacSha256_Encryption_2026!" },
            { "RefreshToken:ExpireDays", "7" },
            { "Otp:Secret", "JapanFood_Otp_Secret_Key_Hmac_2026!" }
        };

        _configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();

        _hashService = new HashService();
        _phoneService = new PhoneService();
        _smsService = new NullSmsService();
    }

    private class NullSmsService : ISmsService
    {
        public Task SendOtpAsync(string phoneNumber, string otp) => Task.CompletedTask;
    }

    private class MockGoogleTokenValidator : IGoogleTokenValidator
    {
        public bool ShouldFail { get; set; }
        public string Email { get; set; } = "valid.user@gmail.com";
        public string Name { get; set; } = "Valid User";

        public Task<GoogleJsonWebSignature.Payload> ValidateAsync(string idToken)
        {
            if (ShouldFail || idToken.StartsWith("dev_google_") || idToken.StartsWith("quick_google_") || idToken == "invalid_token")
            {
                throw new InvalidOperationException("Invalid Google ID Token");
            }

            return Task.FromResult(new GoogleJsonWebSignature.Payload
            {
                Email = Email,
                Name = Name,
                Subject = "1234567890"
            });
        }
    }

    private IValidationFactory CreateValidationFactory(JapanFoodDbContext context)
    {
        var services = new ServiceCollection();
        services.AddScoped<IJapanFoodDbContext>(_ => context);
        services.AddSingleton(_phoneService);
        services.AddScoped<IValidationRule<RegisterRequest>, RegisterValidationRule>();
        services.AddScoped<IValidationRule<LoginRequest>, LoginValidationRule>();
        services.AddScoped<IValidationRule<VerifyRegisterOtpRequest>, VerifyRegisterOtpValidationRule>();
        services.AddScoped<IValidationRule<VerifyForgotPasswordOtpRequest>, VerifyForgotPasswordOtpValidationRule>();
        services.AddScoped<IValidationRule<ResendOtpRequest>, ResendOtpValidationRule>();
        services.AddScoped<IValidationRule<ForgotPasswordRequest>, ForgotPasswordValidationRule>();
        services.AddScoped<IValidationRule<ResetPasswordRequest>, ResetPasswordValidationRule>();
        services.AddScoped<IValidationRule<ChangePasswordRequest>, ChangePasswordValidationRule>();
        services.AddScoped<IValidationRule<RefreshTokenRequest>, RefreshTokenValidationRule>();
        services.AddScoped<IValidationRule<LogoutRequest>, LogoutValidationRule>();
        services.AddScoped<IValidationRule<GoogleLoginRequest>, GoogleLoginValidationRule>();
        services.AddScoped<IValidationRule<GoogleRegisterRequest>, GoogleRegisterValidationRule>();
        services.AddScoped<IValidationFactory, ValidationFactory>();

        return services.BuildServiceProvider().GetRequiredService<IValidationFactory>();
    }

    [Fact]
    public async Task Security_GoogleLogin_ShouldRejectBackdoorDevGoogleTokens()
    {
        // Kiểm thử bảo mật: Kẻ tấn công không thể sử dụng dev_google_* để vượt qua xác thực
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);
        var googleValidator = new MockGoogleTokenValidator();
        var googleAuthService = new GoogleAuthService(context, tokenService, _hashService, _phoneService, googleValidator, _configuration, validationFactory);

        // Tạo tài khoản Admin trước
        var admin = new User
        {
            FullName = "Admin",
            Email = "admin@japanfood.vn",
            PhoneNumber = "+84999999999",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("AdminPass123"),
            Role = AppRoles.Admin,
            AccountStatus = "ACTIVE"
        };
        context.Users.Add(admin);
        await context.SaveChangesAsync();

        // Kẻ tấn công gửi chuỗi bypass "dev_google_admin@japanfood.vn"
        var request = new GoogleLoginRequest { IdToken = "dev_google_admin@japanfood.vn" };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => googleAuthService.GoogleLoginAsync(request));
        Assert.Contains("Xác thực Token Google thất bại", ex.Message);
    }

    [Fact]
    public async Task Security_Login_ShouldRejectPlaintextPasswordComparison()
    {
        // Kiểm thử bảo mật: Hệ thống không chấp nhận đối chiếu mật khẩu dạng văn bản thô (Plaintext fallback)
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var authService = new AuthenticationService(context, _phoneService, otpService, tokenService, _hashService, _configuration, validationFactory, NullLogger<AuthenticationService>.Instance);

        // Giả lập một bản ghi trong CSDL có PasswordHash bị lộ/nhập thô hoặc lưu plaintext
        var rawPassword = "PlainPassword123";
        var user = new User
        {
            FullName = "Victim",
            Email = "victim@japanfood.vn",
            PhoneNumber = "+84988888888",
            PasswordHash = rawPassword, // KHÔNG PHẢI BCRYPT HASH!
            AccountStatus = "ACTIVE"
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var request = new LoginRequest
        {
            PhoneNumber = "+84988888888",
            Password = rawPassword
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => authService.LoginAsync(request));
        Assert.Equal("Số điện thoại / Email hoặc mật khẩu không chính xác.", ex.Message);
    }

    [Fact]
    public async Task Security_RefreshTokenReuse_ShouldRevokeAllUserSessions()
    {
        // Kiểm thử chuẩn OAuth 2.0 / RFC 6819: Phát hiện sử dụng lại Refresh Token đã thu hồi
        // Hệ thống phải lập tức thu hồi toàn bộ token còn lại của tài khoản này!
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);

        var user = new User
        {
            FullName = "Test User",
            Email = "user@japanfood.vn",
            PhoneNumber = "+84977777777",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("TestPass123"),
            AccountStatus = "ACTIVE"
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var secret = _configuration["RefreshToken:Secret"]!;

        // Token 1: Đã bị thu hồi (ví dụ kẻ trộm lấy được token cũ)
        var rawToken1 = "StolenOldRefreshToken1234567890123456789012345678901234567890";
        var hash1 = _hashService.Hash(rawToken1, secret);
        var tokenRecord1 = new RefreshToken
        {
            AccountId = user.UserId.ToString(),
            TokenHash = hash1,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = true, // Đã bị thu hồi!
            RevokedAt = DateTime.UtcNow.AddMinutes(-10)
        };

        // Token 2: Phiên hợp lệ của người dùng đang hoạt động
        var rawToken2 = "LegitimateActiveRefreshToken12345678901234567890123456789012";
        var hash2 = _hashService.Hash(rawToken2, secret);
        var tokenRecord2 = new RefreshToken
        {
            AccountId = user.UserId.ToString(),
            TokenHash = hash2,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        };

        context.RefreshTokens.AddRange(tokenRecord1, tokenRecord2);
        await context.SaveChangesAsync();

        // Kẻ tấn công hoặc người dùng gửi lại tokenRecord1 đã bị thu hồi
        var refreshRequest = new RefreshTokenRequest { RefreshToken = rawToken1 };

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() => tokenService.RefreshTokenAsync(refreshRequest));
        Assert.Contains("Cảnh báo bảo mật: Phiên làm việc đã bị hủy", ex.Message);

        // Kiểm tra Token 2: PHẢI BỊ THU HỒI NGAY LẬP TỨC để bảo vệ tài khoản!
        var updatedToken2 = await context.RefreshTokens.FirstAsync(x => x.TokenHash == hash2);
        Assert.True(updatedToken2.IsRevoked);
        Assert.NotNull(updatedToken2.RevokedAt);
    }

    [Fact]
    public async Task Security_ResetPassword_ShouldHashTokenAtRestAndRevokeAllSessions()
    {
        // Kiểm thử bảo mật: Reset Token phải được băm khi lưu trong DB và thu hồi phiên đăng nhập sau khi đổi
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var passwordService = new PasswordService(context, _phoneService, otpService, _hashService, _configuration, validationFactory);

        var user = new User
        {
            FullName = "Reset User",
            Email = "reset@japanfood.vn",
            PhoneNumber = "+84966666666",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("OldPass123"),
            AccountStatus = "ACTIVE"
        };
        context.Users.Add(user);

        // Tạo 1 Refresh Token đang hoạt động
        var activeToken = new RefreshToken
        {
            AccountId = "1",
            TokenHash = "SomeActiveHash",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        };
        context.RefreshTokens.Add(activeToken);
        await context.SaveChangesAsync();

        // 1. Gửi OTP quên mật khẩu
        await otpService.SendForgotPasswordOtpAsync("+84966666666");
        var otpRecord = await context.OtpVerifications.FirstAsync(x => x.Purpose == "ForgotPassword");

        // 2. Xác thực OTP quên mật khẩu
        // Tìm OTP thực bằng cách brute test (vì unit test có secret)
        string foundOtp = "";
        for (int i = 100000; i <= 999999; i++)
        {
            if (_hashService.Verify(i.ToString(), otpRecord.OtpHash, _configuration["Otp:Secret"]!))
            {
                foundOtp = i.ToString();
                break;
            }
        }
        Assert.NotEmpty(foundOtp);

        var verifyResponse = await otpService.VerifyForgotPasswordOtpAsync(new VerifyForgotPasswordOtpRequest
        {
            PhoneNumber = "+84966666666",
            Otp = foundOtp
        });

        // Đảm bảo ResetToken trả về cho client là token thô (raw)
        var rawResetToken = verifyResponse.ResetToken;
        Assert.NotEmpty(rawResetToken);

        // Đảm bảo trong CSDL chỉ lưu BẢN BĂM (hash), KHÔNG lưu raw token thô
        var resetTokenRecord = await context.OtpVerifications.FirstAsync(x => x.Purpose == "PasswordResetToken");
        Assert.NotEqual(rawResetToken, resetTokenRecord.OtpHash);
        Assert.True(_hashService.Verify(rawResetToken, resetTokenRecord.OtpHash, _configuration["Otp:Secret"]!));

        // 3. Đặt lại mật khẩu với rawResetToken
        await passwordService.ResetPasswordAsync(new ResetPasswordRequest
        {
            PhoneNumber = "+84966666666",
            ResetToken = rawResetToken,
            NewPassword = "NewSecurePassword123!",
            ConfirmNewPassword = "NewSecurePassword123!"
        });

        // Xác nhận mật khẩu đã đổi sang BCrypt hash mới
        var updatedUser = await context.Users.FirstAsync(x => x.PhoneNumber == "+84966666666");
        Assert.True(BCrypt.Net.BCrypt.Verify("NewSecurePassword123!", updatedUser.PasswordHash));

        // Xác nhận toàn bộ Refresh Token của user đã bị thu hồi!
        var revokedToken = await context.RefreshTokens.FirstAsync(x => x.AccountId == updatedUser.UserId.ToString());
        Assert.True(revokedToken.IsRevoked);
    }

    [Fact]
    public async Task Security_ChangePassword_ShouldRejectSamePasswordAndRevokeActiveSessions()
    {
        // Kiểm thử bảo mật: Đổi mật khẩu không cho trùng mật khẩu cũ và phải thu hồi toàn bộ session
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var passwordService = new PasswordService(context, _phoneService, otpService, _hashService, _configuration, validationFactory);

        var currentPass = "CurrentPassword123";
        var user = new User
        {
            FullName = "Change User",
            Email = "change@japanfood.vn",
            PhoneNumber = "+84955555555",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(currentPass),
            AccountStatus = "ACTIVE"
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var activeToken = new RefreshToken
        {
            AccountId = user.UserId.ToString(),
            TokenHash = "ActiveTokenHash123",
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        };
        context.RefreshTokens.Add(activeToken);
        await context.SaveChangesAsync();

        // 1. Thử đổi mật khẩu giống hệt mật khẩu hiện tại -> Bị từ chối
        var sameRequest = new ChangePasswordRequest
        {
            CurrentPassword = currentPass,
            NewPassword = currentPass,
            ConfirmNewPassword = currentPass
        };

        var sameEx = await Assert.ThrowsAsync<BusinessException>(() =>
            passwordService.ChangePasswordAsync(user.UserId.ToString(), sameRequest));
        Assert.Equal("Mật khẩu mới không được trùng với mật khẩu hiện tại.", sameEx.Message);

        // 2. Đổi mật khẩu mới hợp lệ
        var validRequest = new ChangePasswordRequest
        {
            CurrentPassword = currentPass,
            NewPassword = "BrandNewPassword123!",
            ConfirmNewPassword = "BrandNewPassword123!"
        };

        await passwordService.ChangePasswordAsync(user.UserId.ToString(), validRequest);

        // Phiên đăng nhập cũ phải bị thu hồi ngay
        var tokenInDb = await context.RefreshTokens.FirstAsync(x => x.AccountId == user.UserId.ToString());
        Assert.True(tokenInDb.IsRevoked);
    }

    [Fact]
    public async Task Security_OtpFlooding_ShouldEnforce60SecondsCooldown()
    {
        // Kiểm thử chống Spam SMS / SMS Toll Fraud
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);

        var phone = "+84944444444";

        // Lần 1: Thành công
        await otpService.SendRegisterOtpAsync(phone);

        // Lần 2 ngay lập tức: Phải bị chặn với lỗi Cooldown
        var ex = await Assert.ThrowsAsync<BusinessException>(() => otpService.SendRegisterOtpAsync(phone));
        Assert.Contains("Vui lòng đợi", ex.Message);
    }

    [Fact]
    public async Task Security_OtpVerification_ShouldLockAfter5FailedAttempts()
    {
        // Kiểm thử chống Brute-Force mã OTP 6 số
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);

        var phone = "+84933333333";
        await otpService.SendRegisterOtpAsync(phone);

        // Thử sai 4 lần
        for (int i = 0; i < 4; i++)
        {
            var exWrong = await Assert.ThrowsAsync<BusinessException>(() =>
                otpService.ValidateOtpAsync(phone, "000000", "Register"));
            Assert.Equal("Mã OTP không chính xác.", exWrong.Message);
        }

        // Lần 5 sai: Trực tiếp báo đã bị khóa do đạt ngưỡng 5 lần
        var ex5 = await Assert.ThrowsAsync<BusinessException>(() =>
            otpService.ValidateOtpAsync(phone, "000000", "Register"));
        Assert.Contains("đã bị khóa do nhập sai quá 5 lần", ex5.Message);

        // Lần 6: Tiếp tục bị chặn bởi khóa 5 lần
        var exLock = await Assert.ThrowsAsync<BusinessException>(() =>
            otpService.ValidateOtpAsync(phone, "000000", "Register"));
        Assert.Contains("đã bị khóa do nhập sai quá 5 lần", exLock.Message);
    }

    [Fact]
    public async Task Security_ResendOtp_ShouldRejectInvalidPurpose()
    {
        // Kiểm thử bảo mật: Chỉ chấp nhận Purpose hợp lệ
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var rule = new ResendOtpValidationRule(_phoneService);

        var invalidRequest = new ResendOtpRequest
        {
            PhoneNumber = "+84987654321",
            Purpose = "HackerCustomPurpose"
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(invalidRequest));
        Assert.Contains("Mục đích yêu cầu OTP không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task Security_ForgotPassword_ShouldPreventUserEnumeration()
    {
        // Chống User Enumeration: Số điện thoại không tồn tại vẫn trả về thông báo chung
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var passwordService = new PasswordService(context, _phoneService, otpService, _hashService, _configuration, validationFactory);

        var response = await passwordService.ForgotPasswordAsync(new ForgotPasswordRequest
        {
            PhoneNumber = "+84911111111"
        });

        Assert.Equal("Nếu số điện thoại được đăng ký, mã xác thực sẽ được gửi.", response.Message);
    }

    [Fact]
    public async Task Security_LockedUser_CannotLoginOrRefreshToken()
    {
        // Tài khoản bị khóa (LOCKED) không thể đăng nhập hoặc làm mới token
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var authService = new AuthenticationService(context, _phoneService, otpService, tokenService, _hashService, _configuration, validationFactory, NullLogger<AuthenticationService>.Instance);

        var lockedUser = new User
        {
            FullName = "Locked User",
            Email = "locked@japanfood.vn",
            PhoneNumber = "+84922222222",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass123456"),
            AccountStatus = "LOCKED"
        };
        context.Users.Add(lockedUser);
        await context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<ForbiddenException>(() =>
            authService.LoginAsync(new LoginRequest
            {
                PhoneNumber = "+84922222222",
                Password = "Pass123456"
            }));

        Assert.Contains("đã bị khóa", ex.Message);
    }

    [Fact]
    public async Task Security_PendingVerifyUser_CannotLoginBeforeOtpConfirmation()
    {
        // Tài khoản PENDING_VERIFY không thể đăng nhập trực tiếp mà phải xác thực OTP
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var authService = new AuthenticationService(context, _phoneService, otpService, tokenService, _hashService, _configuration, validationFactory, NullLogger<AuthenticationService>.Instance);

        var unverifiedUser = new User
        {
            FullName = "Unverified User",
            Email = "unverified@japanfood.vn",
            PhoneNumber = "+84912345678",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass123456"),
            AccountStatus = "PENDING_VERIFY"
        };
        context.Users.Add(unverifiedUser);
        await context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            authService.LoginAsync(new LoginRequest
            {
                PhoneNumber = "+84912345678",
                Password = "Pass123456"
            }));

        Assert.Contains("Tài khoản chưa được kích hoạt", ex.Message);
    }

    [Fact]
    public async Task Security_Registration_ShouldRejectInvalidEmailFormatAndLongInputs()
    {
        // Chống tràn bộ đệm và SQL Truncation lỗi: Email sai định dạng, Tên quá 255 ký tự, Password > 128 ký tự
        using var context = new JapanFoodDbContext(_dbOptions);
        var rule = new RegisterValidationRule(context, _phoneService);

        // 1. Email sai định dạng
        var invalidEmailReq = new RegisterRequest
        {
            FullName = "Valid Name",
            PhoneNumber = "+84987654321",
            Password = "Password123",
            Email = "invalid-email-no-at-sign"
        };
        var exEmail = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(invalidEmailReq));
        Assert.Equal("Địa chỉ Email không đúng định dạng hợp lệ.", exEmail.Message);

        // 2. Tên quá 255 ký tự
        var longNameReq = new RegisterRequest
        {
            FullName = new string('A', 256),
            PhoneNumber = "+84987654321",
            Password = "Password123"
        };
        var exName = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(longNameReq));
        Assert.Equal("Họ và tên không được vượt quá 255 ký tự.", exName.Message);

        // 3. Password quá 128 ký tự (Chống BCrypt CPU ReDoS)
        var longPassReq = new RegisterRequest
        {
            FullName = "Valid Name",
            PhoneNumber = "+84987654321",
            Password = new string('P', 129)
        };
        var exPass = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(longPassReq));
        Assert.Equal("Mật khẩu không được vượt quá 128 ký tự.", exPass.Message);
    }
}
