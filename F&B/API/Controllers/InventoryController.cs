using API.Security;
using Application.DTOs.Inventory;
using Application.Interfaces.Services;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize]
[EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
[Route("api/inventory")]
public class InventoryController : BaseApiController
{
    private readonly IInventoryService _inventoryService;

    public InventoryController(IInventoryService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    /// <summary>
    /// Lấy danh sách toàn bộ nguyên vật liệu tồn kho
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [HttpGet]
    [ProducesResponseType(typeof(List<InventoryItemDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAllItems(CancellationToken ct)
    {
        var items = await _inventoryService.GetAllItemsAsync(ct);
        return Ok(items);
    }

    /// <summary>
    /// Lấy danh sách đơn vị tính (kg, g, lít, ml, phần...)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [HttpGet("uoms")]
    [ProducesResponseType(typeof(List<UnitOfMeasureDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnitsOfMeasure(CancellationToken ct)
    {
        var uoms = await _inventoryService.GetUnitsOfMeasureAsync(ct);
        return Ok(uoms);
    }

    /// <summary>
    /// Thêm mới nguyên vật liệu vào kho
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPost]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateItem([FromBody] CreateInventoryItemRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId() ?? 1;
        var created = await _inventoryService.CreateItemAsync(request, staffUserId, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    /// <summary>
    /// Cập nhật thông tin nguyên vật liệu trong kho
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(InventoryItemDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateInventoryItemRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId() ?? 1;
        var updated = await _inventoryService.UpdateItemAsync(id, request, staffUserId, ct);
        return Ok(updated);
    }

    /// <summary>
    /// Xóa nguyên vật liệu khỏi kho
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteItem(int id, CancellationToken ct)
    {
        await _inventoryService.DeleteItemAsync(id, ct);
        return Ok(new { message = "Đã xóa nguyên vật liệu khỏi kho thành công." });
    }

    /// <summary>
    /// Nhập kho nguyên vật liệu mới (Cập nhật số lượng và tính lại giá vốn bình quân)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPost("restock")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> RestockItem([FromBody] RestockItemRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _inventoryService.RestockItemAsync(request, staffUserId.Value, ct);
        return Ok(new { message = "Nhập kho nguyên vật liệu thành công." });
    }

    /// <summary>
    /// Xuất kho thủ công (kiểm kê hao hụt, hỏng, hủy)
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
    [HttpPost("deduct")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeductStockManual([FromBody] DeductStockRequestDto request, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _inventoryService.DeductStockManualAsync(request, staffUserId.Value, ct);
        return Ok(new { message = "Xuất kho thủ công thành công." });
    }

    /// <summary>
    /// Kích hoạt trừ tồn kho nguyên vật liệu tự động theo định lượng BOM cho đơn hàng
    /// </summary>
    [Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager},{AppRoles.Staff}")]
    [HttpPost("deduct-for-order/{orderId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> DeductInventoryForOrder(int orderId, CancellationToken ct)
    {
        var staffUserId = GetCurrentUserId();
        if (!staffUserId.HasValue)
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ hoặc thiếu thông tin định danh." });
        }

        await _inventoryService.DeductInventoryForOrderAsync(orderId, staffUserId.Value, ct);
        return Ok(new { message = $"Đã khấu trừ tồn kho theo định lượng BOM cho đơn hàng #{orderId}." });
    }
}
