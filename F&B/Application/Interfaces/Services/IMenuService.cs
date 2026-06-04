using Application.DTOs.Menu;

namespace Application.Interfaces.Services;

public interface IMenuService
{
    Task<DishDetailDto> CreateDishAsync(CreateMenuItemRequestDto request, CancellationToken ct = default);
    Task<DishDetailDto> UpdateDishDetailsAsync(int dishId, UpdateMenuItemRequestDto request, CancellationToken ct = default);
    Task<bool> UpdateDishPriceAsync(int dishId, decimal newPrice, CancellationToken ct = default);
    Task<bool> SetDishAvailabilityAsync(int dishId, bool isAvailable, CancellationToken ct = default);
    Task<string> UploadDishImageAsync(int dishId, Stream fileStream, string fileName, CancellationToken ct = default);
    Task<CategoryMenuDto> CreateCategoryAsync(CreateCategoryRequestDto request, CancellationToken ct = default);
    Task<CategoryMenuDto> UpdateCategoryAsync(int categoryId, UpdateCategoryRequestDto request, CancellationToken ct = default);
    Task<bool> SetCategoryStatusAsync(int categoryId, bool isActive, CancellationToken ct = default);
    Task<bool> DeleteDishAsync(int dishId, CancellationToken ct = default);
    Task<bool> DeleteCategoryAsync(int categoryId, CancellationToken ct = default);
}
