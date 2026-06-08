using API.Security;
using Application.DTOs.Ordering;
using Application.Interfaces.Repositories;
using Domain.Constants;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API.Controllers;

[Authorize(Roles = $"{AppRoles.Admin},{AppRoles.Manager}")]
[EnableRateLimiting(RateLimiterExtensions.StaffPolicy)]
[Route("api/reports")]
public class ReportController : BaseApiController
{
    private readonly IOrderQueryRepository _orderQueryRepo;

    public ReportController(IOrderQueryRepository orderQueryRepo)
    {
        _orderQueryRepo = orderQueryRepo;
    }

    /// <summary>
    /// Báo cáo tài chính doanh thu, thuế VAT, giảm giá và doanh thu thuần theo ngày
    /// </summary>
    [HttpGet("revenue")]
    [ProducesResponseType(typeof(List<RevenueReportPointDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetRevenueReport(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct = default)
    {
        var start = fromDate ?? DateTime.UtcNow.Date.AddDays(-30);
        var end = toDate ?? DateTime.UtcNow;

        var report = await _orderQueryRepo.GetRevenueReportAsync(start, end, ct);
        return Ok(report);
    }

    /// <summary>
    /// Thống kê danh sách món ăn bán chạy nhất hệ thống (Top Selling Dishes)
    /// </summary>
    [HttpGet("top-dishes")]
    [ProducesResponseType(typeof(List<TopDishReportDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTopSellingDishes(
        [FromQuery] int topCount = 5,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var safeTopCount = Math.Clamp(topCount, 1, 100);
        var topDishes = await _orderQueryRepo.GetTopSellingDishesAsync(safeTopCount, fromDate, toDate, ct);
        return Ok(topDishes);
    }

    /// <summary>
    /// Báo cáo doanh thu chi tiết nâng cao kèm danh sách món đã bán ra và dữ liệu vẽ biểu đồ đường
    /// </summary>
    [HttpGet("detailed")]
    [ProducesResponseType(typeof(DetailedRevenueReportDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDetailedReport(
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] int? tableId,
        [FromQuery] int? menuItemId,
        [FromQuery] int? categoryId,
        CancellationToken ct = default)
    {
        var report = await _orderQueryRepo.GetDetailedRevenueReportAsync(fromDate, toDate, year, month, tableId, menuItemId, ct, categoryId);
        return Ok(report);
    }
}
