using API.Security;
using Application.Common.Models;
using Application.DTOs.Menu;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[EnableRateLimiting(RateLimiterExtensions.CustomerPolicy)]
public class MenuController : BaseApiController
{
    private readonly IMenuQueryRepository _menuQueryRepo;
    private readonly IMenuService _menuService;

    public MenuController(
        IMenuQueryRepository menuQueryRepo,
        IMenuService menuService)
    {
        _menuQueryRepo = menuQueryRepo;
        _menuService = menuService;
    }

    /// <summary>
    /// Lấy danh mục đang bán kèm danh sách món ăn đang phục vụ để hiển thị thực đơn
    /// </summary>
    [AllowAnonymous]
    [HttpGet("categories")]
    [ProducesResponseType(typeof(List<CategoryMenuDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategoriesWithActiveDishes(CancellationToken ct)
    {
        var result = await _menuQueryRepo.GetCategoriesWithActiveDishesAsync(ct);
        return Ok(result);
    }

    /// <summary>
    /// Tìm kiếm và lọc món ăn đa tiêu chí (danh mục, khoảng giá, từ khóa, phân trang, sắp xếp)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("dishes")]
    [ProducesResponseType(typeof(PagedResult<DishCardDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPagedDishes([FromQuery] DishFilterQueryDto filter, CancellationToken ct)
    {
        var result = await _menuQueryRepo.GetPagedDishesAsync(filter, ct);
        return Ok(result);
    }

    /// <summary>
    /// Xem chi tiết món ăn theo mã (RAMEN-01, SASHIMI-01) kèm các nhóm tùy chọn (Modifiers)
    /// </summary>
    [AllowAnonymous]
    [HttpGet("dishes/{code}")]
    [ProducesResponseType(typeof(DishDetailDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetDishDetailByCode(string code, CancellationToken ct)
    {
        var result = await _menuQueryRepo.GetDishDetailByCodeAsync(code, ct);
        if (result == null)
        {
            return NotFound(new { message = $"Không tìm thấy món ăn với mã '{code}'." });
        }
        return Ok(result);
    }

    /// <summary>
    /// Thêm món ăn mới vào thực đơn (Yêu cầu quyền Admin hoặc Manager)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPost("dishes")]
    [ProducesResponseType(typeof(DishDetailDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateDish([FromBody] CreateMenuItemRequestDto request, CancellationToken ct)
    {
        var result = await _menuService.CreateDishAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Cập nhật thông tin chi tiết món ăn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPut("dishes/{id:int}")]
    [ProducesResponseType(typeof(DishDetailDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateDish(int id, [FromBody] UpdateMenuItemRequestDto request, CancellationToken ct)
    {
        var result = await _menuService.UpdateDishDetailsAsync(id, request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Cập nhật giá bán món ăn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPatch("dishes/{id:int}/price")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateDishPrice(int id, [FromBody] UpdatePriceRequest request, CancellationToken ct)
    {
        await _menuService.UpdateDishPriceAsync(id, request.NewPrice, ct);
        return Ok(new { message = "Cập nhật giá bán thành công." });
    }

    /// <summary>
    /// Bật/tắt trạng thái mở bán hoặc tạm hết món ăn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [HttpPatch("dishes/{id:int}/availability")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetDishAvailability(int id, [FromBody] SetAvailabilityRequest request, CancellationToken ct)
    {
        await _menuService.SetDishAvailabilityAsync(id, request.IsAvailable, ct);
        return Ok(new { message = request.IsAvailable ? "Món ăn đã được mở bán trở lại." : "Món ăn đã chuyển sang trạng thái tạm hết." });
    }

    /// <summary>
    /// Tải ảnh minh họa cho món ăn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [RequestSizeLimit(5 * 1024 * 1024)]
    [HttpPost("dishes/{id:int}/image")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> UploadDishImage(int id, IFormFile file, CancellationToken ct)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Tệp hình ảnh không hợp lệ." });
        }

        const long maxFileSize = 5 * 1024 * 1024; // 5MB
        if (file.Length > maxFileSize)
        {
            return BadRequest(new { message = "Kích thước tệp hình ảnh không được vượt quá 5MB." });
        }

        using var stream = file.OpenReadStream();
        var imageUrl = await _menuService.UploadDishImageAsync(id, stream, file.FileName, ct);
        return Ok(new { imageUrl });
    }

    /// <summary>
    /// Thêm danh mục thực đơn mới
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPost("categories")]
    [ProducesResponseType(typeof(CategoryMenuDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequestDto request, CancellationToken ct)
    {
        var result = await _menuService.CreateCategoryAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    /// <summary>
    /// Cập nhật danh mục thực đơn
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPut("categories/{id:int}")]
    [ProducesResponseType(typeof(CategoryMenuDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryRequestDto request, CancellationToken ct)
    {
        var result = await _menuService.UpdateCategoryAsync(id, request, ct);
        return Ok(result);
    }

    /// <summary>
    /// Bật/tắt trạng thái hoạt động của danh mục
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPatch("categories/{id:int}/status")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> SetCategoryStatus(int id, [FromBody] SetStatusRequest request, CancellationToken ct)
    {
        await _menuService.SetCategoryStatusAsync(id, request.IsActive, ct);
        return Ok(new { message = "Cập nhật trạng thái danh mục thành công." });
    }

    /// <summary>
    /// Xóa món ăn khỏi thực đơn (Chỉ Quản trị viên ADMIN mới có quyền xóa)
    /// </summary>
    [Authorize(Roles = AppRoles.Admin)]
    [HttpDelete("dishes/{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteDish(int id, CancellationToken ct)
    {
        await _menuService.DeleteDishAsync(id, ct);
        return Ok(new { message = "Xóa món ăn thành công." });
    }

    /// <summary>
    /// Xóa danh mục thực đơn (Chỉ Quản trị viên ADMIN mới có quyền xóa)
    /// </summary>
    [Authorize(Roles = AppRoles.Admin)]
    [HttpDelete("categories/{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteCategory(int id, CancellationToken ct)
    {
        await _menuService.DeleteCategoryAsync(id, ct);
        return Ok(new { message = "Xóa danh mục thành công." });
    }
}

public class UpdatePriceRequest
{
    public decimal NewPrice { get; set; }
}

public class SetAvailabilityRequest
{
    public bool IsAvailable { get; set; }
}

public class SetStatusRequest
{
    public bool IsActive { get; set; }
}
