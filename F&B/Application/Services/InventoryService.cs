using Application.Common.Validation;
using Application.DTOs.Inventory;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Entities.Inventory;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class InventoryService : IInventoryService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IInventoryQueryRepository _inventoryQueryRepo;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<InventoryService> _logger;

    public InventoryService(
        IUnitOfWork unitOfWork,
        IInventoryQueryRepository inventoryQueryRepo,
        IValidationFactory validationFactory,
        ILogger<InventoryService> logger)
    {
        _unitOfWork = unitOfWork;
        _inventoryQueryRepo = inventoryQueryRepo;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<List<InventoryItemDto>> GetAllItemsAsync(CancellationToken ct = default)
    {
        return await _unitOfWork.Context.InventoryItems
            .AsNoTracking()
            .Include(i => i.PrimaryUom)
            .OrderBy(i => i.Category)
            .ThenBy(i => i.Name)
            .Select(i => new InventoryItemDto
            {
                Id = i.Id,
                Sku = i.Sku,
                Name = i.Name,
                Category = i.Category,
                PrimaryUomId = i.PrimaryUomId,
                PrimaryUomName = i.PrimaryUom != null ? i.PrimaryUom.Name : "Đơn vị",
                CurrentStock = i.CurrentStock,
                MinimumStock = i.MinimumStock,
                UnitCost = i.UnitCost,
                StorageLocation = i.StorageLocation,
                IsActive = i.IsActive
            })
            .ToListAsync(ct);
    }

    public async Task<List<UnitOfMeasureDto>> GetUnitsOfMeasureAsync(CancellationToken ct = default)
    {
        return await _unitOfWork.Context.UnitsOfMeasure
            .AsNoTracking()
            .Where(u => u.IsActive)
            .OrderBy(u => u.Id)
            .Select(u => new UnitOfMeasureDto
            {
                Id = u.Id,
                Code = u.Code,
                Name = u.Name
            })
            .ToListAsync(ct);
    }

    public async Task<InventoryItemDto> CreateItemAsync(CreateInventoryItemRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Sku))
            throw new BusinessException("Mã SKU nguyên vật liệu không được để trống.");
        if (string.IsNullOrWhiteSpace(request.Name))
            throw new BusinessException("Tên nguyên vật liệu không được để trống.");

        var skuUpper = request.Sku.Trim().ToUpperInvariant();
        var exists = await _unitOfWork.Context.InventoryItems.AnyAsync(i => i.Sku == skuUpper, ct);
        if (exists)
            throw new ConflictException($"Mã SKU '{skuUpper}' đã tồn tại trong kho.");

        var uom = await _unitOfWork.Context.UnitsOfMeasure.FirstOrDefaultAsync(u => u.Id == request.PrimaryUomId, ct)
                  ?? await _unitOfWork.Context.UnitsOfMeasure.FirstOrDefaultAsync(ct);
        int uomId = uom?.Id ?? 1;

        var category = string.IsNullOrWhiteSpace(request.Category) ? "Nguyên liệu chung" : request.Category.Trim();
        var item = new InventoryItem(
            skuUpper,
            request.Name,
            category,
            uomId,
            request.MinimumStock,
            request.UnitCost,
            request.StorageLocation);

        if (request.InitialStock > 0)
        {
            item.AddStock(request.InitialStock, request.UnitCost, $"Tồn đầu kỳ khi tạo mới (NV: #{staffUserId})");
        }

        _unitOfWork.Context.InventoryItems.Add(item);
        await _unitOfWork.SaveChangesAsync(ct);

        return new InventoryItemDto
        {
            Id = item.Id,
            Sku = item.Sku,
            Name = item.Name,
            Category = item.Category,
            PrimaryUomId = item.PrimaryUomId,
            PrimaryUomName = uom?.Name ?? "Đơn vị",
            CurrentStock = item.CurrentStock,
            MinimumStock = item.MinimumStock,
            UnitCost = item.UnitCost,
            StorageLocation = item.StorageLocation,
            IsActive = item.IsActive
        };
    }

    public async Task<InventoryItemDto> UpdateItemAsync(int id, UpdateInventoryItemRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        var item = await _unitOfWork.Context.InventoryItems
            .Include(i => i.PrimaryUom)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy nguyên vật liệu #{id}.");

        var category = string.IsNullOrWhiteSpace(request.Category) ? item.Category : request.Category.Trim();
        item.UpdateDetails(
            request.Name,
            category,
            request.PrimaryUomId,
            request.MinimumStock,
            request.UnitCost,
            request.StorageLocation);

        if (request.CurrentStock.HasValue && request.CurrentStock.Value >= 0 && request.CurrentStock.Value != item.CurrentStock)
        {
            item.AdjustStock(request.CurrentStock.Value, $"Điều chỉnh tồn kho trực tiếp (NV: #{staffUserId})");
        }

        if (request.IsActive.HasValue)
        {
            if (request.IsActive.Value) item.Activate();
            else item.Deactivate();
        }

        await _unitOfWork.SaveChangesAsync(ct);

        var uom = await _unitOfWork.Context.UnitsOfMeasure.AsNoTracking().FirstOrDefaultAsync(u => u.Id == item.PrimaryUomId, ct);
        return new InventoryItemDto
        {
            Id = item.Id,
            Sku = item.Sku,
            Name = item.Name,
            Category = item.Category,
            PrimaryUomId = item.PrimaryUomId,
            PrimaryUomName = uom?.Name ?? item.PrimaryUom?.Name ?? "Đơn vị",
            CurrentStock = item.CurrentStock,
            MinimumStock = item.MinimumStock,
            UnitCost = item.UnitCost,
            StorageLocation = item.StorageLocation,
            IsActive = item.IsActive
        };
    }

    public async Task<bool> DeleteItemAsync(int id, CancellationToken ct = default)
    {
        var item = await _unitOfWork.Context.InventoryItems
            .Include(i => i.Recipes)
            .FirstOrDefaultAsync(i => i.Id == id, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy nguyên vật liệu #{id}.");

        if (item.Recipes.Any())
        {
            _unitOfWork.Context.RecipeBOMs.RemoveRange(item.Recipes);
        }

        _unitOfWork.Context.InventoryItems.Remove(item);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> RestockItemAsync(RestockItemRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên nhập kho không hợp lệ.");

        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 2. Load inventory item
        var item = await _unitOfWork.Context.InventoryItems
            .FirstOrDefaultAsync(i => i.Id == request.InventoryItemId, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy nguyên vật liệu #{request.InventoryItemId}.");

        // 3. Add stock and recalculate weighted moving average cost
        var trackingReason = $"{request.Reason} (NV: #{staffUserId})";
        item.AddStock(request.Quantity, request.UnitCost, trackingReason);

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeductStockManualAsync(DeductStockRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên xuất kho không hợp lệ.");

        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 2. Load inventory item
        var item = await _unitOfWork.Context.InventoryItems
            .FirstOrDefaultAsync(i => i.Id == request.InventoryItemId, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy nguyên vật liệu #{request.InventoryItemId}.");

        // 3. Deduct stock with inventory invariant checking
        var trackingReason = $"{request.Reason} (NV: #{staffUserId})";
        item.DeductStock(request.Quantity, trackingReason);

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeductInventoryForOrderAsync(int orderId, int staffUserId, CancellationToken ct = default)
    {
        if (orderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        await _inventoryQueryRepo.DeductInventoryForCompletedOrderAsync(orderId, staffUserId, ct);
        return true;
    }
}
