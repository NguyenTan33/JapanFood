using Application.Common.Models;
using Application.DTOs.Reviews;

namespace Application.Interfaces.Repositories;

public interface IDishReviewQueryRepository
{
    Task<bool> CanUserReviewDishAsync(
        int userId,
        int menuItemId,
        int orderId,
        CancellationToken ct = default);

    Task<PagedResult<ReviewViewDto>> GetPagedReviewsByDishIdAsync(
        int menuItemId,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default);

    Task<PagedResult<ReviewViewDto>> GetAllApprovedReviewsAsync(
        bool? featured = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default);

    Task<List<PendingReviewOrderDto>> GetPendingReviewOrdersAsync(
        int userId,
        CancellationToken ct = default);

    Task<ReviewManagePagedResultDto> GetManagedReviewsAsync(
        ReviewManageFilterDto filter,
        CancellationToken ct = default);
}
