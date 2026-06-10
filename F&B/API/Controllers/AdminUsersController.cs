using API.Security;
using Application.DTOs.Auth;
using Application.Interfaces.Services;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
[EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
[Route("api/admin/users")]
public class AdminUsersController : BaseApiController
{
    private readonly IUserManagementService _userManagementService;

    public AdminUsersController(IUserManagementService userManagementService)
    {
        _userManagementService = userManagementService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(AdminUserListResponseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUsers([FromQuery] AdminUserFilterDto filter, CancellationToken ct)
    {
        filter ??= new AdminUserFilterDto();

        // Thu ngân (STAFF) CHỈ ĐƯỢC tra cứu thông tin khách hàng (CUSTOMER)
        if (User.IsInRole(AppRoles.Staff))
        {
            filter.Role = AppRoles.Customer;
        }

        var result = await _userManagementService.GetUsersAsync(filter, ct);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateUser([FromBody] CreateAdminUserRequestDto request, CancellationToken ct)
    {
        // Thu ngân chỉ được đăng ký tài khoản khách hàng mới khi khách đến quán
        if (User.IsInRole(AppRoles.Staff))
        {
            request.Role = AppRoles.Customer;
        }
        else if (User.IsInRole(AppRoles.Manager) && string.Equals(request.Role, AppRoles.Admin, StringComparison.OrdinalIgnoreCase))
        {
            return Forbid(); // Manager không được tạo Admin
        }

        var created = await _userManagementService.CreateUserAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    [HttpPut("customers/{id:int}")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCustomer(int id, [FromBody] UpdateCustomerRequestDto request, CancellationToken ct)
    {
        var canEditPoints = User.IsInRole(AppRoles.Admin);
        var updated = await _userManagementService.UpdateCustomerAsync(id, request, canEditPoints, ct);
        return Ok(updated);
    }

    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateStaffUserRequestDto request, CancellationToken ct)
    {
        var currentAdminId = GetCurrentUserId();
        if (!currentAdminId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        var updated = await _userManagementService.UpdateStaffUserAsync(id, currentAdminId.Value, request, ct);
        return Ok(updated);
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPut("{id:int}/role")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateUserRole(int id, [FromBody] UpdateUserRoleRequestDto request, CancellationToken ct)
    {
        var currentAdminId = GetCurrentUserId();
        if (!currentAdminId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        var updated = await _userManagementService.UpdateUserRoleAsync(id, currentAdminId.Value, request, ct);
        return Ok(updated);
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPost("{id:int}/reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ResetPassword(int id, [FromBody] AdminResetPasswordRequestDto request, CancellationToken ct)
    {
        await _userManagementService.ResetPasswordAsync(id, request, ct);
        return Ok(new { message = "Cấp lại mật khẩu thành công." });
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPatch("{id:int}/lock")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> LockUser(int id, CancellationToken ct)
    {
        var currentAdminId = GetCurrentUserId();
        if (!currentAdminId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        var updated = await _userManagementService.LockUserAsync(id, currentAdminId.Value, ct);
        return Ok(updated);
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpPatch("{id:int}/unlock")]
    [ProducesResponseType(typeof(AdminUserDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UnlockUser(int id, CancellationToken ct)
    {
        var updated = await _userManagementService.UnlockUserAsync(id, ct);
        return Ok(updated);
    }

    [Authorize(Roles = AppRoles.Admin)]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteUser(int id, CancellationToken ct)
    {
        var currentAdminId = GetCurrentUserId();
        if (!currentAdminId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        await _userManagementService.DeleteUserAsync(id, currentAdminId.Value, ct);
        return Ok(new { message = "Xóa tài khoản thành công." });
    }
}
