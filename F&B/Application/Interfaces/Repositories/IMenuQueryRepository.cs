using Application.Common.Models;
using Application.DTOs.Menu;

namespace Application.Interfaces.Repositories;

public interface IMenuQueryRepository
{
    Task<List<CategoryMenuDto>> GetCategoriesWithActiveDishesAsync(CancellationToken ct = default);

    Task<PagedResult<DishCardDto>> GetPagedDishesAsync(
        DishFilterQueryDto filter,
        CancellationToken ct = default);

    Task<DishDetailDto?> GetDishDetailByCodeAsync(
        string code,
        CancellationToken ct = default);

    Task<List<string>> CheckDishAvailabilityAsync(
        List<int> dishIds,
        CancellationToken ct = default);
}
