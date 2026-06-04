using Application.Common.Models;
using Application.DTOs.Ordering;
using Domain.Entities.Menu;

namespace Application.Interfaces.Repositories;

public interface IOrderQueryRepository
{
    Task<OrderDetailViewDto?> GetOrderWithDetailsByIdAsync(
        int orderId,
        CancellationToken ct = default);

    Task<PagedResult<OrderDetailViewDto>> GetUserOrderHistoryAsync(
        int userId,
        OrderStatus? status = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default);

    Task<List<RevenueReportPointDto>> GetRevenueReportAsync(
        DateTime fromDate,
        DateTime toDate,
        CancellationToken ct = default);

    Task<List<TopDishReportDto>> GetTopSellingDishesAsync(
        int topCount = 5,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default);

    Task<DetailedRevenueReportDto> GetDetailedRevenueReportAsync(
        DateTime? fromDate,
        DateTime? toDate,
        int? year,
        int? month,
        int? tableId,
        int? menuItemId,
        CancellationToken ct = default,
        int? categoryId = null);
}
