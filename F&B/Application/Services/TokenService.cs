using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Entities;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Application.Services;

public class TokenService : ITokenService
{
    private readonly IJapanFoodDbContext _context;
    private readonly IHashService _hashService;
    private readonly IConfiguration _configuration;
    private readonly IValidationFactory _validationFactory;

    public TokenService(
        IJapanFoodDbContext context,
        IHashService hashService,
        IConfiguration configuration,
        IValidationFactory validationFactory)
    {
        _context = context;
        _hashService = hashService;
        _configuration = configuration;
        _validationFactory = validationFactory;
    }

    public Task<string> GenerateAccessTokenAsync(User user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new("userId", user.UserId.ToString()),
            new("id", user.UserId.ToString()),
            new("role", user.Role ?? "CUSTOMER"),
            new(ClaimTypes.Role, user.Role ?? "CUSTOMER")
        };

        if (!string.IsNullOrWhiteSpace(user.PhoneNumber))
        {
            claims.Add(new Claim(ClaimTypes.MobilePhone, user.PhoneNumber));
        }

        var effectiveName = !string.IsNullOrWhiteSpace(user.FullName)
            ? user.FullName
            : !string.IsNullOrWhiteSpace(user.PhoneNumber) ? user.PhoneNumber : "Khách hàng JapanFood";

        claims.Add(new Claim(ClaimTypes.Name, effectiveName));
        claims.Add(new Claim("name", effectiveName));
        claims.Add(new Claim("fullName", effectiveName));

        if (!string.IsNullOrWhiteSpace(user.Email))
        {
            claims.Add(new Claim(ClaimTypes.Email, user.Email));
            claims.Add(new Claim("email", user.Email));
        }

        // Custom claims
        claims.Add(new Claim("membershipTier", user.MembershipTier ?? "BRONZE"));
        claims.Add(new Claim("loyaltyPoints", user.LoyaltyPoints.ToString()));
        claims.Add(new Claim("accountStatus", user.AccountStatus ?? "ACTIVE"));

        // JWT Secret key (đồng bộ chuẩn giữa Program.cs và TokenService)
        var jwtKey = _configuration["Jwt:Key"]
            ?? "JapanFood_Super_Secret_Key_For_Jwt_Authentication_Must_Be_Long_Enough_2026!";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var expireMinutes = int.Parse(_configuration["Jwt:ExpireMinutes"] ?? "120");

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expireMinutes),
            signingCredentials: credentials);

        var tokenHandler = new JwtSecurityTokenHandler();
        return Task.FromResult(tokenHandler.WriteToken(token));
    }

    public string GenerateRefreshToken()
    {
        var randomBytes = RandomNumberGenerator.GetBytes(64);
        return Convert.ToBase64String(randomBytes);
    }

    public async Task<RefreshTokenResponse> RefreshTokenAsync(RefreshTokenRequest request)
    {
        await _validationFactory.ValidateAsync(request);

        var refreshTokenSecret = _configuration["RefreshToken:Secret"]
            ?? throw new InvalidOperationException("Refresh Token Secret chưa được cấu hình.");

        var refreshTokenHash = _hashService.Hash(request.RefreshToken, refreshTokenSecret);

        var storedRefreshToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(x => x.TokenHash == refreshTokenHash);

        if (storedRefreshToken == null)
        {
            throw new BusinessException("Refresh Token không hợp lệ.");
        }

        // BẢO MẬT: Chống Tấn Công Sử Dụng Lại Token (Refresh Token Reuse Detection - RFC 6819)
        // Nếu token đã bị thu hồi trước đó mà lại được gửi lên, lập tức hủy tất cả các phiên còn lại!
        if (storedRefreshToken.IsRevoked)
        {
            var compromisedTokens = await _context.RefreshTokens
                .Where(x => x.AccountId == storedRefreshToken.AccountId && !x.IsRevoked)
                .ToListAsync();

            foreach (var token in compromisedTokens)
            {
                token.IsRevoked = true;
                token.RevokedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            throw new ForbiddenException("Cảnh báo bảo mật: Phiên làm việc đã bị hủy do phát hiện token được sử dụng lại bất thường. Vui lòng đăng nhập lại.");
        }

        if (DateTime.UtcNow > storedRefreshToken.ExpiresAt)
        {
            storedRefreshToken.IsRevoked = true;
            storedRefreshToken.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            throw new BusinessException("Refresh Token đã hết hạn.");
        }

        if (!int.TryParse(storedRefreshToken.AccountId, out var userId))
        {
            throw new BusinessException("Tài khoản không hợp lệ.");
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new BusinessException("Tài khoản không tồn tại.");
        }

        if (user.AccountStatus == "LOCKED" || user.AccountStatus == "DELETED")
        {
            throw new ForbiddenException("Tài khoản đã bị tạm khóa hoặc đã bị xóa.");
        }

        // Thu hồi token hiện tại (xoay vòng token - token rotation)
        storedRefreshToken.IsRevoked = true;
        storedRefreshToken.RevokedAt = DateTime.UtcNow;

        // Sinh cặp token mới
        var newAccessToken = await GenerateAccessTokenAsync(user);

        var newRefreshToken = GenerateRefreshToken();
        var newRefreshTokenHash = _hashService.Hash(newRefreshToken, refreshTokenSecret);
        var refreshTokenExpireDays = int.Parse(_configuration["RefreshToken:ExpireDays"] ?? "7");

        var newRefreshTokenEntity = new RefreshToken
        {
            AccountId = user.UserId.ToString(),
            TokenHash = newRefreshTokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(refreshTokenExpireDays),
            IsRevoked = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.RefreshTokens.Add(newRefreshTokenEntity);
        await _context.SaveChangesAsync();

        var accessTokenExpireMinutes = int.Parse(_configuration["Jwt:ExpireMinutes"] ?? "120");

        return new RefreshTokenResponse
        {
            AccessToken = newAccessToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = DateTime.UtcNow.AddMinutes(accessTokenExpireMinutes),
            ExpiresInMinutes = accessTokenExpireMinutes
        };
    }
}
