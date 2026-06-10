using System.Security.Cryptography;
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
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth;

public class AuthServiceTests
{
    private readonly DbContextOptions<JapanFoodDbContext> _dbOptions;
    private readonly IConfiguration _configuration;
    private readonly IHashService _hashService;
    private readonly IPhoneService _phoneService;
    private readonly ISmsService _smsService;

    public AuthServiceTests()
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

    private class MockGoogleValidator : IGoogleTokenValidator
    {
        public Task<GoogleJsonWebSignature.Payload> ValidateAsync(string idToken)
        {
            return Task.FromResult(new GoogleJsonWebSignature.Payload
            {
                Email = "google.test.user@gmail.com",
                Name = "Google Test User",
                Subject = "google_sub_12345"
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
    public async Task Service_RegisterAndVerifyOtp_ShouldActivateUser()
    {
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var authService = new AuthenticationService(context, _phoneService, otpService, tokenService, _hashService, _configuration, validationFactory, NullLogger<AuthenticationService>.Instance);

        var regRequest = new RegisterRequest
        {
            FullName = "Tran Van B",
            PhoneNumber = "0981234567",
            Password = "Password@123",
            Email = "tranvanb@gmail.com",
            StreetAddress = "123 Nguyen Trai",
            City = "Ha Noi"
        };

        var regResponse = await authService.RegisterAsync(regRequest);
        Assert.NotEmpty(regResponse.UserId);

        var user = await context.Users.FirstAsync(x => x.Email == "tranvanb@gmail.com");
        Assert.Equal("PENDING_VERIFY", user.AccountStatus);

        // Lấy OTP từ CSDL và xác thực
        var otpRecord = await context.OtpVerifications.FirstAsync(x => x.PhoneNumber == "+84981234567" && x.Purpose == "Register");
        string foundOtp = "";
        for (int i = 100000; i <= 999999; i++)
        {
            if (_hashService.Verify(i.ToString(), otpRecord.OtpHash, _configuration["Otp:Secret"]!))
            {
                foundOtp = i.ToString();
                break;
            }
        }

        var verifyResponse = await otpService.VerifyRegisterOtpAsync(new VerifyRegisterOtpRequest
        {
            PhoneNumber = "+84981234567",
            Otp = foundOtp
        });

        Assert.Equal(user.UserId.ToString(), verifyResponse.UserId);

        var activatedUser = await context.Users.FindAsync(user.UserId);
        Assert.Equal("ACTIVE", activatedUser!.AccountStatus);
    }

    [Fact]
    public async Task Service_Login_WithEmailAndPhone_ShouldSucceedWhenActive()
    {
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);
        var otpService = new OtpService(context, _hashService, _phoneService, _smsService, _configuration, validationFactory);
        var authService = new AuthenticationService(context, _phoneService, otpService, tokenService, _hashService, _configuration, validationFactory, NullLogger<AuthenticationService>.Instance);

        var password = "CorrectPassword@123";
        var user = new User
        {
            FullName = "Le Thi C",
            Email = "lethic@gmail.com",
            PhoneNumber = "+84987654321",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
            AccountStatus = "ACTIVE"
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        // 1. Đăng nhập bằng Email
        var emailLoginResponse = await authService.LoginAsync(new LoginRequest
        {
            PhoneNumber = "lethic@gmail.com",
            Password = password
        });
        Assert.NotEmpty(emailLoginResponse.AccessToken);
        Assert.NotEmpty(emailLoginResponse.RefreshToken);

        // 2. Đăng nhập bằng Số điện thoại
        var phoneLoginResponse = await authService.LoginAsync(new LoginRequest
        {
            PhoneNumber = "0987654321",
            Password = password
        });
        Assert.NotEmpty(phoneLoginResponse.AccessToken);
        Assert.NotEmpty(phoneLoginResponse.RefreshToken);
    }

    [Fact]
    public async Task Service_RefreshToken_ShouldRotateAndIssueNewPair()
    {
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);

        var user = new User
        {
            FullName = "Rotating User",
            Email = "rotating@gmail.com",
            PhoneNumber = "+84981112233",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Pass123!"),
            AccountStatus = "ACTIVE"
        };
        context.Users.Add(user);
        await context.SaveChangesAsync();

        var initialToken = tokenService.GenerateRefreshToken();
        var secret = _configuration["RefreshToken:Secret"]!;
        var hash = _hashService.Hash(initialToken, secret);

        context.RefreshTokens.Add(new RefreshToken
        {
            AccountId = user.UserId.ToString(),
            TokenHash = hash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsRevoked = false
        });
        await context.SaveChangesAsync();

        // Xoay vòng token
        var response = await tokenService.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = initialToken
        });

        Assert.NotEmpty(response.AccessToken);
        Assert.NotEmpty(response.RefreshToken);
        Assert.NotEqual(initialToken, response.RefreshToken);

        // Token cũ phải chuyển thành Revoked
        var oldTokenRecord = await context.RefreshTokens.FirstAsync(x => x.TokenHash == hash);
        Assert.True(oldTokenRecord.IsRevoked);

        // Token mới phải tồn tại và chưa bị Revoked
        var newHash = _hashService.Hash(response.RefreshToken, secret);
        var newTokenRecord = await context.RefreshTokens.FirstAsync(x => x.TokenHash == newHash);
        Assert.False(newTokenRecord.IsRevoked);
    }

    [Fact]
    public async Task Service_GoogleAuth_ShouldCreateUserOrLoginSeamlessly()
    {
        using var context = new JapanFoodDbContext(_dbOptions);
        var validationFactory = CreateValidationFactory(context);
        var tokenService = new TokenService(context, _hashService, _configuration, validationFactory);
        var googleAuthService = new GoogleAuthService(context, tokenService, _hashService, _phoneService, new MockGoogleValidator(), _configuration, validationFactory);

        // 1. Google Login với user mới -> tự động tạo và cấp token
        var loginResponse = await googleAuthService.GoogleLoginAsync(new GoogleLoginRequest
        {
            IdToken = "valid_google_token"
        });

        Assert.NotEmpty(loginResponse.AccessToken);
        Assert.NotEmpty(loginResponse.RefreshToken);

        var user = await context.Users.FirstAsync(x => x.Email == "google.test.user@gmail.com");
        Assert.Equal("ACTIVE", user.AccountStatus);

        // 2. Thử Google Register khi đã có tài khoản ACTIVE -> Báo lỗi Conflict 409
        await Assert.ThrowsAsync<ConflictException>(() =>
            googleAuthService.GoogleRegisterAsync(new GoogleRegisterRequest
            {
                IdToken = "valid_google_token"
            }));
    }
}
