using APIAuth.Services.Common;
using Application.DTOs.Inventory;
using Application.Services;
using Domain.Entities.Menu;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class InventoryServiceTests : TestApplicationBase
{
    private readonly InventoryService _service;

    public InventoryServiceTests()
    {
        _service = new InventoryService(
            UnitOfWork,
            InventoryQueryRepo,
            ValidationFactory,
            NullLogger<InventoryService>.Instance);
    }

    [Fact]
    public async Task RestockItem_ValidRequest_AddsStockAndUpdatesWeightedAverageCost()
    {
        // Arrange
        // Initial: 100 kg @ 20,000đ = 2,000,000đ
        var item = await SeedInventoryItemAsync("ING-FLOUR-TEST", "Bột Mì Thượng Hạng", initialStock: 100m, unitCost: 20000m);
        int staffUserId = 5;

        // Restock: 100 kg @ 30,000đ = 3,000,000đ
        // Total: 200 kg @ 25,000đ (weighted average)
        var request = new RestockItemRequestDto
        {
            InventoryItemId = item.Id,
            Quantity = 100m,
            UnitCost = 30000m,
            Reason = "Nhập kho lô hàng mới"
        };

        // Act
        var success = await _service.RestockItemAsync(request, staffUserId);

        // Assert
        Assert.True(success);

        var updated = await Context.InventoryItems.FirstOrDefaultAsync(i => i.Id == item.Id);
        Assert.NotNull(updated);
        Assert.Equal(200m, updated.CurrentStock);
        Assert.Equal(25000m, updated.UnitCost);
    }

    [Fact]
    public async Task RestockItem_InvalidStaffId_ThrowsBusinessException()
    {
        // Arrange
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 1,
            Quantity = 10m,
            UnitCost = 20000m,
            Reason = "Nhập hàng"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.RestockItemAsync(request, 0));
        Assert.Contains("Mã nhân viên nhập kho", ex.Message);
    }

    [Fact]
    public async Task RestockItem_ItemNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 99999, // Non-existent
            Quantity = 10m,
            UnitCost = 20000m,
            Reason = "Nhập hàng"
        };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.RestockItemAsync(request, 1));
    }

    [Fact]
    public async Task RestockItem_ZeroOrNegativeQuantity_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 1,
            Quantity = 0m,
            UnitCost = 20000m,
            Reason = "Nhập hàng"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.RestockItemAsync(request, 1));
        Assert.Contains("Số lượng nhập kho", ex.Message);
    }

    [Fact]
    public async Task RestockItem_NegativeCost_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 1,
            Quantity = 10m,
            UnitCost = -100m,
            Reason = "Nhập hàng"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.RestockItemAsync(request, 1));
        Assert.Contains("Đơn giá nhập không được âm", ex.Message);
    }

    [Fact]
    public async Task RestockItem_EmptyReason_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 1,
            Quantity = 10m,
            UnitCost = 1000m,
            Reason = "   "
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.RestockItemAsync(request, 1));
        Assert.Contains("Lý do nhập kho", ex.Message);
    }

    [Fact]
    public async Task DeductStockManual_ValidRequest_DeductsStock()
    {
        // Arrange
        var item = await SeedInventoryItemAsync("ING-MEAT-TEST", "Thịt Bò Wagyu A5", initialStock: 50m, unitCost: 800000m);
        int staffUserId = 9;

        var request = new DeductStockRequestDto
        {
            InventoryItemId = item.Id,
            Quantity = 15m,
            Reason = "Xuất kho chế biến tiệc"
        };

        // Act
        var success = await _service.DeductStockManualAsync(request, staffUserId);

        // Assert
        Assert.True(success);

        var updated = await Context.InventoryItems.FirstOrDefaultAsync(i => i.Id == item.Id);
        Assert.NotNull(updated);
        Assert.Equal(35m, updated.CurrentStock);
    }

    [Fact]
    public async Task DeductStockManual_InsufficientStock_ThrowsBusinessException()
    {
        // Arrange
        var item = await SeedInventoryItemAsync("ING-SAUCE-TEST", "Nước Tương Shoyu", initialStock: 10m, unitCost: 50000m);

        var request = new DeductStockRequestDto
        {
            InventoryItemId = item.Id,
            Quantity = 25m, // More than 10m
            Reason = "Xuất vượt quá tồn kho"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.DeductStockManualAsync(request, 1));
        Assert.Contains("Tồn kho không đủ", ex.Message);
    }

    [Fact]
    public async Task DeductStockManual_InvalidStaffId_ThrowsBusinessException()
    {
        // Arrange
        var request = new DeductStockRequestDto
        {
            InventoryItemId = 1,
            Quantity = 5m,
            Reason = "Xuất hàng"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.DeductStockManualAsync(request, -1));
        Assert.Contains("Mã nhân viên xuất kho", ex.Message);
    }

    [Fact]
    public async Task DeductStockManual_ItemNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var request = new DeductStockRequestDto
        {
            InventoryItemId = 99999, // Non-existent
            Quantity = 5m,
            Reason = "Xuất hàng"
        };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.DeductStockManualAsync(request, 1));
    }

    [Fact]
    public async Task DeductStockManual_InvalidQuantity_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new DeductStockRequestDto
        {
            InventoryItemId = 1,
            Quantity = 0m,
            Reason = "Xuất hàng"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.DeductStockManualAsync(request, 1));
        Assert.Contains("Số lượng xuất kho", ex.Message);
    }

    [Fact]
    public async Task DeductStockManual_EmptyReason_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new DeductStockRequestDto
        {
            InventoryItemId = 1,
            Quantity = 5m,
            Reason = ""
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.DeductStockManualAsync(request, 1));
        Assert.Contains("Lý do xuất kho", ex.Message);
    }

    [Fact]
    public async Task DeductInventoryForOrder_ValidRequest_ReturnsTrue()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        int staffUserId = 3;

        // Act
        var success = await _service.DeductInventoryForOrderAsync(order.Id, staffUserId);

        // Assert
        Assert.True(success);
    }

    [Fact]
    public async Task DeductInventoryForOrder_InvalidOrderId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.DeductInventoryForOrderAsync(0, 1));
        Assert.Contains("Mã đơn hàng không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task DeductInventoryForOrder_InvalidStaffId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.DeductInventoryForOrderAsync(1, 0));
        Assert.Contains("Mã nhân viên không hợp lệ", ex.Message);
    }
}
