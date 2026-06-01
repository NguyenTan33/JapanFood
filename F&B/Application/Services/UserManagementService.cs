using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Application.Interfaces.Services;
using Domain.Constants;
using Domain.Entities;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class UserManagementService : IUserManagementService
{
    private readonly IJapanFoodDbContext _context;
    private readonly IPhoneService _phoneService;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<UserManagementService> _logger;

    public UserManagementService(
        IJapanFoodDbContext context,
        IPhoneService phoneService,
        IValidationFactory validationFactory,
        ILogger<UserManagementService> logger)
    {
        _context = context;
        _phoneService = phoneService;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<AdminUserListResponseDto> GetUsersAsync(AdminUserFilterDto filter, CancellationToken ct = default)
    {
        filter ??= new AdminUserFilterDto();

        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize <= 0 ? 20 : filter.PageSize, 1, 100);

        var query = _context.Users.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim().ToLowerInvariant();
            query = query.Where(u =>
                u.FullName.ToLower().Contains(term) ||
                u.Email.ToLower().Contains(term) ||
                u.PhoneNumber.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(filter.Role) &&
            !string.Equals(filter.Role.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedRole = filter.Role.Trim().ToUpperInvariant();
            query = query.Where(u => u.Role.ToUpper() == normalizedRole);
        }

        if (filter.IsActive.HasValue)
        {
            var targetStatus = filter.IsActive.Value ? "ACTIVE" : "LOCKED";
            query = query.Where(u => u.AccountStatus.ToUpper() == targetStatus);
        }
        else if (!string.IsNullOrWhiteSpace(filter.Status) &&
            !string.Equals(filter.Status.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var normalizedStatus = filter.Status.Trim().ToUpperInvariant();
            query = query.Where(u => u.AccountStatus.ToUpper() == normalizedStatus);
        }

        var totalCount = await query.CountAsync(ct);
        var totalPages = pageSize > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0;

        var items = await query
            .OrderByDescending(u => u.CreatedAt)
            .ThenByDescending(u => u.UserId)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new AdminUserDto
            {
                Id = u.UserId,
                FullName = u.FullName,
                Email = u.Email,
                PhoneNumber = u.PhoneNumber,
                Role = u.Role,
                AccountStatus = u.AccountStatus,
                IsActive = u.AccountStatus.ToUpper() == "ACTIVE",
                LoyaltyPoints = u.LoyaltyPoints,
                MembershipTier = u.MembershipTier,
                CreatedAt = u.CreatedAt,
                LastLoginAt = u.LastLoginAt
            })
            .ToListAsync(ct);

        return new AdminUserListResponseDto
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    public async Task<AdminUserDto> CreateUserAsync(CreateAdminUserRequestDto request, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var emailLower = request.Email.Trim().ToLowerInvariant();
        var normalizedPhone = !string.IsNullOrWhiteSpace(request.PhoneNumber)
            ? _phoneService.Normalize(request.PhoneNumber)
            : string.Empty;
        var normalizedRole = AppRoles.Normalize(request.Role);

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = emailLower,
            PhoneNumber = normalizedPhone,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password, workFactor: 11),
            LoyaltyPoints = 0,
            MembershipTier = "BRONZE",
            AccountStatus = "ACTIVE",
            Role = normalizedRole,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Admin đã tạo tài khoản mới #{UserId} ({Email}) với vai trò {Role}", user.UserId, user.Email, user.Role);

        return MapDto(user);
    }

    public async Task<AdminUserDto> UpdateUserRoleAsync(int targetUserId, int currentAdminUserId, UpdateUserRoleRequestDto request, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var newRole = AppRoles.Normalize(request.Role);
        if (targetUserId == currentAdminUserId && !string.Equals(newRole, AppRoles.Admin, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException("Không thể tự hạ quyền tài khoản Quản trị viên đang đăng nhập.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == targetUserId, ct);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy tài khoản #{targetUserId}.");
        }

        user.Role = newRole;
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Admin #{AdminId} đã đổi vai trò tài khoản #{TargetId} thành {Role}", currentAdminUserId, targetUserId, newRole);

        return MapDto(user);
    }

    public async Task ResetPasswordAsync(int targetUserId, AdminResetPasswordRequestDto request, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == targetUserId, ct);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy tài khoản #{targetUserId}.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 11);

        await RevokeUserRefreshTokensAsync(user.UserId, ct);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Admin đã cấp lại mật khẩu và thu hồi RefreshToken cho tài khoản #{TargetId}", targetUserId);
    }

    public async Task<AdminUserDto> LockUserAsync(int targetUserId, int currentAdminUserId, CancellationToken ct = default)
    {
        if (targetUserId == currentAdminUserId)
        {
            throw new BusinessException("Không thể tự khóa tài khoản Quản trị viên đang đăng nhập.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == targetUserId, ct);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy tài khoản #{targetUserId}.");
        }

        if (string.Equals(user.AccountStatus, "DELETED", StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException("Không thể khóa tài khoản đã bị xóa.");
        }

        user.AccountStatus = "LOCKED";
        await RevokeUserRefreshTokensAsync(user.UserId, ct);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Admin #{AdminId} đã khóa tài khoản #{TargetId}", currentAdminUserId, targetUserId);

        return MapDto(user);
    }

    public async Task<AdminUserDto> UnlockUserAsync(int targetUserId, CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == targetUserId, ct);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy tài khoản #{targetUserId}.");
        }

        if (string.Equals(user.AccountStatus, "DELETED", StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessException("Không thể mở khóa tài khoản đã bị xóa.");
        }

        user.AccountStatus = "ACTIVE";
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Admin đã mở khóa tài khoản #{TargetId}", targetUserId);

        return MapDto(user);
    }

    public async Task<AdminUserDto> UpdateCustomerAsync(int targetUserId, UpdateCustomerRequestDto request, bool canEditPoints, CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == targetUserId, ct);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy tài khoản #{targetUserId}.");
        }

        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            user.FullName = request.FullName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var normPhone = _phoneService.Normalize(request.PhoneNumber);
            var phoneConflict = await _context.Users.AnyAsync(u => u.PhoneNumber == normPhone && u.UserId != targetUserId, ct);
            if (phoneConflict)
            {
                throw new BusinessException($"Số điện thoại '{request.PhoneNumber}' đã được sử dụng bởi một tài khoản khác.");
            }
            user.PhoneNumber = normPhone;
        }

        if (!string.IsNullOrWhiteSpace(request.MembershipTier))
        {
            user.MembershipTier = request.MembershipTier.Trim().ToUpperInvariant();
        }

        // CHỈ ADMIN MỚI ĐƯỢC PHÉP SỬA ĐIỂM TÍCH LŨY THỦ CÔNG
        if (canEditPoints && request.LoyaltyPoints.HasValue)
        {
            user.LoyaltyPoints = Math.Max(0, request.LoyaltyPoints.Value);
        }

        await _context.SaveChangesAsync(ct);
        _logger.LogInformation("Đã cập nhật thông tin khách hàng #{UserId}", targetUserId);

        return MapDto(user);
    }

    public async Task<AdminUserDto> UpdateStaffUserAsync(int targetUserId, int currentAdminUserId, UpdateStaffUserRequestDto request, CancellationToken ct = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == targetUserId, ct);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy tài khoản #{targetUserId}.");
        }

        if (!string.IsNullOrWhiteSpace(request.FullName))
        {
            user.FullName = request.FullName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var emailLower = request.Email.Trim().ToLowerInvariant();
            var emailConflict = await _context.Users.AnyAsync(u => u.Email == emailLower && u.UserId != targetUserId, ct);
            if (emailConflict)
            {
                throw new BusinessException($"Email '{request.Email}' đã được sử dụng bởi một tài khoản khác.");
            }
            user.Email = emailLower;
        }

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var normPhone = _phoneService.Normalize(request.PhoneNumber);
            var phoneConflict = await _context.Users.AnyAsync(u => u.PhoneNumber == normPhone && u.UserId != targetUserId, ct);
            if (phoneConflict)
            {
                throw new BusinessException($"Số điện thoại '{request.PhoneNumber}' đã được sử dụng bởi một tài khoản khác.");
            }
            user.PhoneNumber = normPhone;
        }

        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            var normalizedRole = AppRoles.Normalize(request.Role);
            if (targetUserId == currentAdminUserId && !string.Equals(normalizedRole, AppRoles.Admin, StringComparison.OrdinalIgnoreCase))
            {
                throw new BusinessException("Không thể tự hạ quyền tài khoản Quản trị viên đang đăng nhập.");
            }
            user.Role = normalizedRole;
        }

        if (!string.IsNullOrWhiteSpace(request.AccountStatus))
        {
            var statusUpper = request.AccountStatus.Trim().ToUpperInvariant();
            if (targetUserId == currentAdminUserId && statusUpper != "ACTIVE")
            {
                throw new BusinessException("Không thể khóa tài khoản Quản trị viên đang đăng nhập.");
            }
            user.AccountStatus = statusUpper;
        }

        await _context.SaveChangesAsync(ct);
        _logger.LogInformation("Admin #{AdminId} đã cập nhật thông tin nhân viên #{TargetId}", currentAdminUserId, targetUserId);

        return MapDto(user);
    }

    public async Task DeleteUserAsync(int targetUserId, int currentAdminUserId, CancellationToken ct = default)
    {
        if (targetUserId == currentAdminUserId)
        {
            throw new BusinessException("Không thể tự xóa tài khoản Quản trị viên đang đăng nhập.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.UserId == targetUserId, ct);
        if (user == null)
        {
            throw new NotFoundException($"Không tìm thấy tài khoản #{targetUserId}.");
        }

        user.AccountStatus = "DELETED";
        await RevokeUserRefreshTokensAsync(user.UserId, ct);
        await _context.SaveChangesAsync(ct);

        _logger.LogInformation("Admin #{AdminId} đã xóa tài khoản #{TargetId}", currentAdminUserId, targetUserId);
    }

    private async Task RevokeUserRefreshTokensAsync(int userId, CancellationToken ct)
    {
        var accountIdStr = userId.ToString();
        var activeTokens = await _context.RefreshTokens
            .Where(t => t.AccountId == accountIdStr && !t.IsRevoked)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;
        foreach (var token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = now;
        }
    }

    private static AdminUserDto MapDto(User user) => new()
    {
        Id = user.UserId,
        FullName = user.FullName,
        Email = user.Email,
        PhoneNumber = user.PhoneNumber,
        Role = user.Role,
        AccountStatus = user.AccountStatus,
        IsActive = string.Equals(user.AccountStatus, "ACTIVE", StringComparison.OrdinalIgnoreCase),
        LoyaltyPoints = user.LoyaltyPoints,
        MembershipTier = user.MembershipTier,
        CreatedAt = user.CreatedAt,
        LastLoginAt = user.LastLoginAt
    };
}
