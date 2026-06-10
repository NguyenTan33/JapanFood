using Application.DTOs.Inventory;
using Application.DTOs.Menu;
using Application.DTOs.Vouchers;
using Application.Validation.Inventory;
using Application.Validation.Menu;
using Application.Validation.Vouchers;
using Domain.Entities.Kds;
using Domain.Entities.Vouchers;
using Domain.Exceptions;
using Xunit;

namespace APIAuth.ValidationTests;

public class NewValidationRuleTests
{
    #region Category Validation Tests
    [Fact]
    public async Task CreateCategory_ValidRequest_PassesValidation()
    {
        var rule = new CreateCategoryValidationRule();
        var request = new CreateCategoryRequestDto
        {
            CategoryCode = "SUSHI",
            CategoryName = "Sushi & Sashimi",
            Description = "Fresh Japanese sushi and sashimi",
            DisplayOrder = 1
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Fact]
    public async Task CreateCategory_NullRequest_ThrowsBusinessException()
    {
        var rule = new CreateCategoryValidationRule();
        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(null!));
        Assert.Contains("không được để trống", ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task CreateCategory_EmptyCode_ThrowsBusinessException(string? code)
    {
        var rule = new CreateCategoryValidationRule();
        var request = new CreateCategoryRequestDto
        {
            CategoryCode = code!,
            CategoryName = "Ramen",
            DisplayOrder = 1
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Mã danh mục không được để trống", ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public async Task CreateCategory_EmptyName_ThrowsBusinessException(string? name)
    {
        var rule = new CreateCategoryValidationRule();
        var request = new CreateCategoryRequestDto
        {
            CategoryCode = "RAMEN",
            CategoryName = name!,
            DisplayOrder = 1
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Tên danh mục không được để trống", ex.Message);
    }

    [Fact]
    public async Task CreateCategory_NegativeDisplayOrder_ThrowsBusinessException()
    {
        var rule = new CreateCategoryValidationRule();
        var request = new CreateCategoryRequestDto
        {
            CategoryCode = "RAMEN",
            CategoryName = "Ramen Noodles",
            DisplayOrder = -1
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Thứ tự hiển thị không được âm", ex.Message);
    }

    [Fact]
    public async Task UpdateCategory_ValidRequest_PassesValidation()
    {
        var rule = new UpdateCategoryValidationRule();
        var request = new UpdateCategoryRequestDto
        {
            CategoryName = "Updated Category",
            Description = "Updated description",
            DisplayOrder = 2
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Fact]
    public async Task UpdateCategory_EmptyName_ThrowsBusinessException()
    {
        var rule = new UpdateCategoryValidationRule();
        var request = new UpdateCategoryRequestDto
        {
            CategoryName = "   ",
            DisplayOrder = 0
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Tên danh mục không được để trống", ex.Message);
    }
    #endregion

    #region MenuItem Validation Tests
    [Fact]
    public async Task CreateMenuItem_ValidRequest_PassesValidation()
    {
        var rule = new CreateMenuItemValidationRule();
        var request = new CreateMenuItemRequestDto
        {
            CategoryId = 1,
            Code = "SUSHI-01",
            Name = "Salmon Nigiri",
            JapaneseName = "サーモンにぎり",
            Description = "Fresh salmon over seasoned sushi rice",
            BasePrice = 65000,
            KitchenStation = KitchenStationType.ColdDessertStation,
            EstimatedPrepMinutes = 10,
            IsKitchenItem = true
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public async Task CreateMenuItem_InvalidCategoryId_ThrowsBusinessException(int categoryId)
    {
        var rule = new CreateMenuItemValidationRule();
        var request = new CreateMenuItemRequestDto
        {
            CategoryId = categoryId,
            Code = "DISH-01",
            Name = "Miso Soup",
            BasePrice = 30000
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Mã danh mục không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task CreateMenuItem_NegativePrice_ThrowsBusinessException()
    {
        var rule = new CreateMenuItemValidationRule();
        var request = new CreateMenuItemRequestDto
        {
            CategoryId = 1,
            Code = "DISH-01",
            Name = "Miso Soup",
            BasePrice = -1000
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Giá món ăn không được âm", ex.Message);
    }

    [Fact]
    public async Task CreateMenuItem_InvalidEstimatedPrepMinutes_ThrowsBusinessException()
    {
        var rule = new CreateMenuItemValidationRule();
        var request = new CreateMenuItemRequestDto
        {
            CategoryId = 1,
            Code = "DISH-01",
            Name = "Slow Cook Pork",
            BasePrice = 120000,
            EstimatedPrepMinutes = 200
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Thời gian chế biến dự kiến", ex.Message);
    }

    [Fact]
    public async Task UpdateMenuItem_ValidRequest_PassesValidation()
    {
        var rule = new UpdateMenuItemValidationRule();
        var request = new UpdateMenuItemRequestDto
        {
            Name = "Spicy Ramen",
            JapaneseName = "辛いラーメン",
            Description = "Very delicious",
            BasePrice = 85000,
            EstimatedPrepMinutes = 15
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Fact]
    public async Task UpdateMenuItem_NegativePrice_ThrowsBusinessException()
    {
        var rule = new UpdateMenuItemValidationRule();
        var request = new UpdateMenuItemRequestDto
        {
            Name = "Spicy Ramen",
            BasePrice = -500
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Giá món ăn không được âm", ex.Message);
    }
    #endregion

    #region Voucher Validation Tests
    [Fact]
    public async Task CreateVoucher_ValidPercentageRequest_PassesValidation()
    {
        var rule = new CreateVoucherValidationRule();
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "SUMMER20",
            DiscountType = DiscountType.Percentage,
            DiscountValue = 20,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(30),
            MinOrderAmount = 100000,
            MaxDiscountAmount = 50000,
            UsageLimit = 100,
            UsagePerUserLimit = 2
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Fact]
    public async Task CreateVoucher_PercentageExceeds100_ThrowsBusinessException()
    {
        var rule = new CreateVoucherValidationRule();
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "INVALID150",
            DiscountType = DiscountType.Percentage,
            DiscountValue = 150,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(7)
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("không được vượt quá 100%", ex.Message);
    }

    [Fact]
    public async Task CreateVoucher_EndDateBeforeStartDate_ThrowsBusinessException()
    {
        var rule = new CreateVoucherValidationRule();
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "TIMETRAVEL",
            DiscountType = DiscountType.FixedAmount,
            DiscountValue = 50000,
            StartDate = DateTime.UtcNow.AddDays(10),
            EndDate = DateTime.UtcNow.AddDays(5)
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("phải sau ngày bắt đầu", ex.Message);
    }

    [Fact]
    public async Task CreateVoucher_NegativeMinOrderAmount_ThrowsBusinessException()
    {
        var rule = new CreateVoucherValidationRule();
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "DISC10",
            DiscountType = DiscountType.FixedAmount,
            DiscountValue = 10000,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(7),
            MinOrderAmount = -5000
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("không được âm", ex.Message);
    }
    #endregion

    #region Inventory Validation Tests
    [Fact]
    public async Task RestockItem_ValidRequest_PassesValidation()
    {
        var rule = new RestockItemValidationRule();
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 1,
            Quantity = 50,
            UnitCost = 25000,
            Reason = "Nhập hàng từ nhà cung cấp Hải Sản Xanh"
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public async Task RestockItem_InvalidQuantity_ThrowsBusinessException(decimal qty)
    {
        var rule = new RestockItemValidationRule();
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 1,
            Quantity = qty,
            UnitCost = 25000,
            Reason = "Nhập hàng định kỳ"
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("phải lớn hơn 0", ex.Message);
    }

    [Fact]
    public async Task RestockItem_NegativeUnitCost_ThrowsBusinessException()
    {
        var rule = new RestockItemValidationRule();
        var request = new RestockItemRequestDto
        {
            InventoryItemId = 1,
            Quantity = 10,
            UnitCost = -100,
            Reason = "Nhập hàng định kỳ"
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("không được âm", ex.Message);
    }

    [Fact]
    public async Task DeductStock_ValidRequest_PassesValidation()
    {
        var rule = new DeductStockValidationRule();
        var request = new DeductStockRequestDto
        {
            InventoryItemId = 1,
            Quantity = 5,
            Reason = "Hao hụt cuối ngày ca sáng"
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Fact]
    public async Task DeductStock_EmptyReason_ThrowsBusinessException()
    {
        var rule = new DeductStockValidationRule();
        var request = new DeductStockRequestDto
        {
            InventoryItemId = 1,
            Quantity = 5,
            Reason = "  "
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Lý do xuất kho không được để trống", ex.Message);
    }
    #endregion
}
