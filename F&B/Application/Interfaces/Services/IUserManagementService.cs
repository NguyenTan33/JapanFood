using Application.DTOs.Auth;

namespace Application.Interfaces.Services;

public interface IUserManagementService
{
    Task<AdminUserListResponseDto> GetUsersAsync(AdminUserFilterDto filter, CancellationToken ct = default);
    Task<AdminUserDto> CreateUserAsync(CreateAdminUserRequestDto request, CancellationToken ct = default);
    Task<AdminUserDto> UpdateUserRoleAsync(int targetUserId, int currentAdminUserId, UpdateUserRoleRequestDto request, CancellationToken ct = default);
    Task ResetPasswordAsync(int targetUserId, AdminResetPasswordRequestDto request, CancellationToken ct = default);
    Task<AdminUserDto> LockUserAsync(int targetUserId, int currentAdminUserId, CancellationToken ct = default);
    Task<AdminUserDto> UnlockUserAsync(int targetUserId, CancellationToken ct = default);
    Task<AdminUserDto> UpdateCustomerAsync(int targetUserId, UpdateCustomerRequestDto request, bool canEditPoints, CancellationToken ct = default);
    Task<AdminUserDto> UpdateStaffUserAsync(int targetUserId, int currentAdminUserId, UpdateStaffUserRequestDto request, CancellationToken ct = default);
    Task DeleteUserAsync(int targetUserId, int currentAdminUserId, CancellationToken ct = default);
}
