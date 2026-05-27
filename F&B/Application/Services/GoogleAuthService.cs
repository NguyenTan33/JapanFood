using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Entities;
using Domain.Exceptions;
using Google.Apis.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Application.Services;

public class GoogleAuthService : IGoogleAuthService
{
    private readonly IJapanFoodDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IHashService _hashService;
    private readonly IPhoneService _phoneService;
    private readonly IGoogleTokenValidator _googleTokenValidator;
    private readonly IConfiguration _configuration;
    private readonly IValidationFactory _validationFactory;

    public GoogleAuthService(
        IJapanFoodDbContext context,
        ITokenService tokenService,
        IHashService hashService,
        IPhoneService phoneService,
        IGoogleTokenValidator googleTokenValidator,
        IConfiguration configuration,
        IValidationFactory validationFactory)
    {
        _context = context;
        _tokenService = tokenService;
        _hashService = hashService;
        _phoneService = phoneService;
        _googleTokenValidator = googleTokenValidator;
        _configuration = configuration;
        _validationFactory = validationFactory;
    }

    public async Task<LoginResponse> GoogleLoginAsync(GoogleLoginRequest request)
    {
        await _validationFactory.ValidateAsync(request);

        var payload = await ValidateGoogleTokenAsync(request.IdToken);

        var email = payload.Email?.ToLower().Trim();
        var fullName = payload.Name ?? email?.Split('@')[0] ?? "Google User";

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new BusinessException("Không thể lấy địa chỉ Email từ tài khoản Google.");
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.Email.ToLower() == email);

        if (user == null)
        {
            var phonePlaceholder = await GenerateUniquePhonePlaceholderAsync(email);
            user = new User
            {
                FullName = fullName,
                Email = email,
                PhoneNumber = phonePlaceholder,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                LoyaltyPoints = 50,
                MembershipTier = "BRONZE",
                AccountStatus = "ACTIVE",
                Role = "CUSTOMER",
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        }
        else
        {
            if (user.AccountStatus == "LOCKED" || user.AccountStatus == "DELETED")
            {
                throw new ForbiddenException("Tài khoản của bạn đã bị khóa hoặc đã bị xóa. Vui lòng liên hệ ban quản trị.");
            }

            if (user.AccountStatus == "PENDING_VERIFY")
            {
                user.AccountStatus = "ACTIVE";
                await _context.SaveChangesAsync();
            }
        }

        return await GenerateAuthResponseAsync(user);
    }

    public async Task<LoginResponse> GoogleRegisterAsync(GoogleRegisterRequest request)
    {
        await _validationFactory.ValidateAsync(request);

        var payload = await ValidateGoogleTokenAsync(request.IdToken);

        var email = payload.Email?.ToLower().Trim();
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new BusinessException("Không thể lấy địa chỉ Email từ tài khoản Google.");
        }

        var existingUser = await _context.Users
            .FirstOrDefaultAsync(x => x.Email.ToLower() == email);

        if (existingUser != null)
        {
            if (existingUser.AccountStatus == "ACTIVE")
            {
                throw new ConflictException("Tài khoản với Email này đã tồn tại trong hệ thống. Vui lòng dùng chức năng Đăng nhập bằng Google.");
            }
            if (existingUser.AccountStatus == "LOCKED" || existingUser.AccountStatus == "DELETED")
            {
                throw new ForbiddenException("Tài khoản đã bị tạm khóa hoặc đã bị xóa.");
            }
            if (existingUser.AccountStatus == "PENDING_VERIFY")
            {
                existingUser.AccountStatus = "ACTIVE";
                await _context.SaveChangesAsync();
                return await GenerateAuthResponseAsync(existingUser);
            }
        }

        var fullName = !string.IsNullOrWhiteSpace(request.FullName)
            ? request.FullName.Trim()
            : (payload.Name ?? email.Split('@')[0]);

        var phoneNumber = !string.IsNullOrWhiteSpace(request.PhoneNumber)
            ? _phoneService.Normalize(request.PhoneNumber)
            : await GenerateUniquePhonePlaceholderAsync(email);

        var user = new User
        {
            FullName = fullName,
            Email = email,
            PhoneNumber = phoneNumber,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
            LoyaltyPoints = 50,
            MembershipTier = "BRONZE",
            AccountStatus = "ACTIVE",
            Role = "CUSTOMER",
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        if (!string.IsNullOrWhiteSpace(request.StreetAddress) &&
            !string.IsNullOrWhiteSpace(request.City))
        {
            var address = new UserAddress
            {
                UserId = user.UserId,
                RecipientName = fullName,
                PhoneNumber = phoneNumber,
                StreetAddress = request.StreetAddress.Trim(),
                Ward = request.Ward?.Trim() ?? string.Empty,
                District = request.District?.Trim() ?? string.Empty,
                City = request.City.Trim(),
                IsDefault = "Y"
            };

            _context.UserAddresses.Add(address);
            await _context.SaveChangesAsync();
        }

        return await GenerateAuthResponseAsync(user);
    }

    private async Task<GoogleJsonWebSignature.Payload> ValidateGoogleTokenAsync(string idToken)
    {
        try
        {
            return await _googleTokenValidator.ValidateAsync(idToken);
        }
        catch (Exception ex)
        {
            throw new BusinessException($"Xác thực Token Google thất bại: {ex.Message}");
        }
    }

    private async Task<string> GenerateUniquePhonePlaceholderAsync(string email)
    {
        var baseSeed = Math.Abs(email.GetHashCode()) % 80000000 + 10000000;
        for (int i = 0; i < 100; i++)
        {
            var candidate = $"+849{(baseSeed + i) % 90000000 + 10000000}";
            var exists = await _context.Users.AnyAsync(x => x.PhoneNumber == candidate);
            if (!exists)
            {
                return candidate;
            }
        }

        return $"+849{Random.Shared.Next(10000000, 99999999)}";
    }

    private async Task<LoginResponse> GenerateAuthResponseAsync(User user)
    {
        var accessToken = await _tokenService.GenerateAccessTokenAsync(user);
        var refreshToken = _tokenService.GenerateRefreshToken();

        var refreshTokenSecret = _configuration["RefreshToken:Secret"]
            ?? throw new InvalidOperationException("Refresh Token Secret chưa được cấu hình.");

        var refreshTokenHash = _hashService.Hash(refreshToken, refreshTokenSecret);
        var refreshTokenExpireDays = int.Parse(_configuration["RefreshToken:ExpireDays"] ?? "7");

        var refreshTokenEntity = new RefreshToken
        {
            AccountId = user.UserId.ToString(),
            TokenHash = refreshTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpireDays),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.RefreshTokens.Add(refreshTokenEntity);
        user.LastLoginAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        var accessTokenExpireMinutes = int.Parse(_configuration["Jwt:ExpireMinutes"] ?? "120");

        return new LoginResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = DateTime.UtcNow.AddMinutes(accessTokenExpireMinutes),
            ExpiresInMinutes = accessTokenExpireMinutes,
            User = AuthenticationService.MapUserProfile(user)
        };
    }
}
