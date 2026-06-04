using Application.DTOs.Inventory;

namespace Application.Interfaces.Services;

public interface IInventoryService
{
    Task<List<InventoryItemDto>> GetAllItemsAsync(CancellationToken ct = default);
    Task<List<UnitOfMeasureDto>> GetUnitsOfMeasureAsync(CancellationToken ct = default);
    Task<InventoryItemDto> CreateItemAsync(CreateInventoryItemRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<InventoryItemDto> UpdateItemAsync(int id, UpdateInventoryItemRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<bool> DeleteItemAsync(int id, CancellationToken ct = default);
    Task<bool> RestockItemAsync(RestockItemRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<bool> DeductStockManualAsync(DeductStockRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<bool> DeductInventoryForOrderAsync(int orderId, int staffUserId, CancellationToken ct = default);
}
