using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Entities;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class AuthenticationService : IAuthenticationService
{
    private readonly IJapanFoodDbContext _context;
    private readonly IPhoneService _phoneService;
    private readonly IOtpService _otpService;
    private readonly ITokenService _tokenService;
    private readonly IHashService _hashService;
    private readonly IConfiguration _configuration;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<AuthenticationService> _logger;

    public AuthenticationService(
        IJapanFoodDbContext context,
        IPhoneService phoneService,
        IOtpService otpService,
        ITokenService tokenService,
        IHashService hashService,
        IConfiguration configuration,
        IValidationFactory validationFactory,
        ILogger<AuthenticationService> logger)
    {
        _context = context;
        _phoneService = phoneService;
        _otpService = otpService;
        _tokenService = tokenService;
        _hashService = hashService;
        _configuration = configuration;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<RegisterResponse> RegisterAsync(RegisterRequest request)
    {
        // 1. Validate request
        await _validationFactory.ValidateAsync(request);

        var phoneNumber = _phoneService.Normalize(request.PhoneNumber);
        var email = !string.IsNullOrWhiteSpace(request.Email)
            ? request.Email.Trim().ToLower()
            : $"{phoneNumber.Replace("+", "")}@japanfood.vn";

        // Xóa tài khoản chưa xác thực nếu đăng ký lại cùng số điện thoại
        var unconfirmedUser = await _context.Users
            .FirstOrDefaultAsync(x => x.PhoneNumber == phoneNumber && x.AccountStatus == "PENDING_VERIFY");
        if (unconfirmedUser != null)
        {
            _context.Users.Remove(unconfirmedUser);
            await _context.SaveChangesAsync();
        }

        // Mã hóa mật khẩu an toàn với BCrypt
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 11);

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            PhoneNumber = phoneNumber,
            PasswordHash = passwordHash,
            LoyaltyPoints = 0,
            MembershipTier = "BRONZE",
            AccountStatus = "PENDING_VERIFY",
            Role = "CUSTOMER",
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // Lưu thông tin địa chỉ nếu có
        if (!string.IsNullOrWhiteSpace(request.StreetAddress) &&
            !string.IsNullOrWhiteSpace(request.City))
        {
            var address = new UserAddress
            {
                UserId = user.UserId,
                RecipientName = request.FullName.Trim(),
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

        try
        {
            // Gửi mã OTP xác nhận đăng ký
            await _otpService.SendRegisterOtpAsync(phoneNumber);

            return new RegisterResponse
            {
                Message = "Đăng ký thành công. Vui lòng nhập mã OTP đã được gửi về số điện thoại của bạn.",
                UserId = user.UserId.ToString()
            };
        }
        catch (BusinessException)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi gửi OTP cho người dùng vừa tạo {Id}", user.UserId);
            return new RegisterResponse
            {
                Message = "Đăng ký thành công.",
                UserId = user.UserId.ToString()
            };
        }
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        // 1. Validate request
        await _validationFactory.ValidateAsync(request);

        var loginIdentifier = !string.IsNullOrWhiteSpace(request.Email)
            ? request.Email.Trim()
            : request.PhoneNumber.Trim();
        User? user = null;

        // Kiểm tra xem người dùng đăng nhập bằng Email hay Số điện thoại
        if (loginIdentifier.Contains('@'))
        {
            user = await _context.Users
                .FirstOrDefaultAsync(x => x.Email.ToLower() == loginIdentifier.ToLower());
        }
        else
        {
            var normalizedPhone = _phoneService.Normalize(loginIdentifier);
            user = await _context.Users
                .FirstOrDefaultAsync(x => x.PhoneNumber == normalizedPhone);
        }

        if (user == null)
        {
            throw new BusinessException("Số điện thoại / Email hoặc mật khẩu không chính xác.");
        }

        if (user.AccountStatus == "LOCKED" || user.AccountStatus == "DELETED")
        {
            throw new ForbiddenException("Tài khoản của bạn đã bị khóa hoặc đã bị xóa. Vui lòng liên hệ Quản trị viên.");
        }

        if (user.AccountStatus == "PENDING_VERIFY")
        {
            throw new BusinessException("Tài khoản chưa được kích hoạt. Vui lòng xác thực mã OTP gửi về số điện thoại của bạn.");
        }

        // 2. Validate Password strictly using BCrypt
        bool isPasswordValid = false;
        try
        {
            if (!string.IsNullOrWhiteSpace(user.PasswordHash) &&
                (user.PasswordHash.StartsWith("$2a$") ||
                 user.PasswordHash.StartsWith("$2b$") ||
                 user.PasswordHash.StartsWith("$2y$")))
            {
                isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
            }
        }
        catch
        {
            isPasswordValid = false;
        }

        if (!isPasswordValid)
        {
            throw new BusinessException("Số điện thoại / Email hoặc mật khẩu không chính xác.");
        }

        // 3. Generate Access Token (JWT)
        var accessToken = await _tokenService.GenerateAccessTokenAsync(user);

        // 4. Generate and Hash Refresh Token
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
            User = MapUserProfile(user)
        };
    }

    public async Task<UserProfileDto> GetCurrentUserAsync(int userId, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã định danh người dùng không hợp lệ.");

        var user = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.UserId == userId, ct);

        if (user == null)
            throw new NotFoundException($"Không tìm thấy tài khoản #{userId}.");

        if (user.AccountStatus == "LOCKED" || user.AccountStatus == "DELETED")
            throw new ForbiddenException("Tài khoản của bạn đã bị khóa hoặc đã bị xóa.");

        return MapUserProfile(user);
    }

    public async Task<UserProfileDto> UpdateProfileAsync(int userId, UpdateProfileRequest request, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã định danh người dùng không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new BusinessException("Họ và tên không được để trống.");

        var user = await _context.Users.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (user == null)
            throw new NotFoundException($"Không tìm thấy tài khoản #{userId}.");

        // Validate email uniqueness if changing email
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var normalizedEmail = request.Email.Trim().ToLower();
            if (normalizedEmail != user.Email.ToLower())
            {
                var emailExists = await _context.Users
                    .AnyAsync(x => x.UserId != userId && x.Email.ToLower() == normalizedEmail, ct);
                if (emailExists)
                    throw new BusinessException("Địa chỉ email này đã được sử dụng bởi một tài khoản khác.");
                user.Email = normalizedEmail;
            }
        }

        user.FullName = request.FullName.Trim();
        if (request.AvatarUrl != null)
        {
            user.AvatarUrl = request.AvatarUrl.Trim();
        }

        await _context.SaveChangesAsync(ct);
        return MapUserProfile(user);
    }

    public async Task<string> SendChangePhoneOtpAsync(int userId, string newPhoneNumber, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã định danh người dùng không hợp lệ.");

        if (string.IsNullOrWhiteSpace(newPhoneNumber))
            throw new BusinessException("Vui lòng nhập số điện thoại mới.");

        var normalizedPhone = _phoneService.Normalize(newPhoneNumber);

        // Check if phone already registered by another account
        var phoneExists = await _context.Users
            .AnyAsync(x => x.UserId != userId && x.PhoneNumber == normalizedPhone, ct);
        if (phoneExists)
            throw new BusinessException("Số điện thoại này đã được đăng ký bởi tài khoản khác.");

        var otp = await _otpService.GenerateAndSaveOtpAsync(normalizedPhone, "ChangePhone");
        _logger.LogInformation("Mã OTP đổi số điện thoại cho tài khoản #{UserId} tới {Phone} là {Otp}", userId, normalizedPhone, otp);

        return otp;
    }

    public async Task<UserProfileDto> VerifyChangePhoneOtpAsync(int userId, string newPhoneNumber, string otp, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã định danh người dùng không hợp lệ.");

        if (string.IsNullOrWhiteSpace(newPhoneNumber) || string.IsNullOrWhiteSpace(otp))
            throw new BusinessException("Vui lòng cung cấp đầy đủ số điện thoại và mã OTP.");

        var normalizedPhone = _phoneService.Normalize(newPhoneNumber);
        await _otpService.ValidateOtpAsync(normalizedPhone, otp, "ChangePhone");

        var user = await _context.Users.FirstOrDefaultAsync(x => x.UserId == userId, ct);
        if (user == null)
            throw new NotFoundException($"Không tìm thấy tài khoản #{userId}.");

        user.PhoneNumber = normalizedPhone;
        await _context.SaveChangesAsync(ct);

        return MapUserProfile(user);
    }

    internal static UserProfileDto MapUserProfile(User user) => new()
    {
        Id = user.UserId,
        FullName = user.FullName,
        Email = user.Email,
        PhoneNumber = user.PhoneNumber,
        AvatarUrl = user.AvatarUrl,
        Role = user.Role,
        LoyaltyPoints = user.LoyaltyPoints,
        MembershipTier = user.MembershipTier,
        CreatedAt = user.CreatedAt
    };

    public async Task LogoutAsync(LogoutRequest request)
    {
        await _validationFactory.ValidateAsync(request);

        var refreshTokenSecret = _configuration["RefreshToken:Secret"]
            ?? throw new InvalidOperationException("Refresh Token Secret chưa được cấu hình.");

        var refreshTokenHash = _hashService.Hash(request.RefreshToken, refreshTokenSecret);

        var storedRefreshToken = await _context.RefreshTokens
            .FirstOrDefaultAsync(x => x.TokenHash == refreshTokenHash);

        if (storedRefreshToken != null && !storedRefreshToken.IsRevoked)
        {
            storedRefreshToken.IsRevoked = true;
            storedRefreshToken.RevokedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
}
