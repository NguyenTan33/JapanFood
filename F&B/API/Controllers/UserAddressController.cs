using API.Security;
using Application.DTOs.User;
using Application.Interfaces.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize]
[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
[Route("api/user/addresses")]
public class UserAddressController : BaseApiController
{
    private readonly IUserAddressService _addressService;

    public UserAddressController(IUserAddressService addressService)
    {
        _addressService = addressService;
    }

    /// <summary>
    /// Lấy danh sách sổ địa chỉ nhận hàng của người dùng hiện tại
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<UserAddressDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyAddresses(CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized(new { message = "Vui lòng đăng nhập để xem sổ địa chỉ." });

        var list = await _addressService.GetUserAddressesAsync(userId.Value, ct);
        return Ok(list);
    }

    /// <summary>
    /// Thêm mới một địa chỉ giao hàng vào sổ địa chỉ
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(UserAddressDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateAddress([FromBody] CreateAddressRequestDto request, CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized(new { message = "Vui lòng đăng nhập để thêm địa chỉ." });

        var created = await _addressService.CreateAddressAsync(userId.Value, request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>
    /// Cập nhật thông tin địa chỉ giao hàng
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(UserAddressDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateAddress(int id, [FromBody] UpdateAddressRequestDto request, CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized(new { message = "Vui lòng đăng nhập." });

        var updated = await _addressService.UpdateAddressAsync(userId.Value, id, request, ct);
        return Ok(updated);
    }

    /// <summary>
    /// Xóa một địa chỉ khỏi sổ địa chỉ
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteAddress(int id, CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized(new { message = "Vui lòng đăng nhập." });

        await _addressService.DeleteAddressAsync(userId.Value, id, ct);
        return Ok(new { message = "Đã xóa địa chỉ thành công." });
    }

    /// <summary>
    /// Đặt một địa chỉ làm địa chỉ mặc định
    /// </summary>
    [HttpPut("{id:int}/set-default")]
    [ProducesResponseType(typeof(UserAddressDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> SetDefault(int id, CancellationToken ct = default)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized(new { message = "Vui lòng đăng nhập." });

        var result = await _addressService.SetDefaultAddressAsync(userId.Value, id, ct);
        return Ok(result);
    }
}
