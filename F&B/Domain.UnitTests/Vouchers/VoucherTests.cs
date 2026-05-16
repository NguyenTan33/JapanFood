using Domain.Entities.Menu;
using Domain.Entities.Vouchers;
using Domain.Exceptions;

namespace Domain.UnitTests.Vouchers;

public class VoucherTests
{
    [Fact]
    public void Constructor_WithValidPercentage_ShouldInitializeCorrectly()
    {
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);
        var voucher = new Voucher("JAPAN20", DiscountType.Percentage, 20m, start, end, minOrderAmount: 200000m, maxDiscountAmount: 50000m, usageLimit: 50, usagePerUserLimit: 2);

        Assert.Equal("JAPAN20", voucher.VoucherCode);
        Assert.Equal(DiscountType.Percentage, voucher.DiscountType);
        Assert.Equal(20m, voucher.DiscountValue);
        Assert.Equal(200000m, voucher.MinOrderAmount);
        Assert.Equal(50000m, voucher.MaxDiscountAmount);
        Assert.Equal(50, voucher.UsageLimit);
        Assert.Equal(0, voucher.UsedCount);
        Assert.Equal(2, voucher.UsagePerUserLimit);
        Assert.True(voucher.IsActive);
    }

    [Fact]
    public void Constructor_PercentageExceeding100_ShouldThrowBusinessException()
    {
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);

        var ex = Assert.Throws<BusinessException>(() =>
            new Voucher("FREE150", DiscountType.Percentage, 150m, start, end));

        Assert.Contains("không được vượt quá 100%", ex.Message);
    }

    [Fact]
    public void CalculateDiscount_WithMaxDiscountCap_ShouldCapDiscount()
    {
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);
        var voucher = new Voucher("JAPAN50", DiscountType.Percentage, 50m, start, end, minOrderAmount: 100000m, maxDiscountAmount: 100000m);

        // SubTotal = 500,000đ -> 50% = 250,000đ, capped at 100,000đ
        var discount = voucher.CalculateDiscount(500000m);
        Assert.Equal(100000m, discount);
    }

    [Fact]
    public void ValidateApplicable_SubTotalBelowMinimum_ShouldThrowBusinessException()
    {
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);
        var voucher = new Voucher("MIN300", DiscountType.FixedAmount, 50000m, start, end, minOrderAmount: 300000m);

        var ex = Assert.Throws<BusinessException>(() => voucher.ValidateApplicable(250000m));
        Assert.Contains("chưa đạt giá trị tối thiểu", ex.Message);
    }

    [Fact]
    public void ValidateApplicable_ExceededPerUserLimit_ShouldThrowBusinessException()
    {
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);
        var voucher = new Voucher("ONCEONLY", DiscountType.FixedAmount, 20000m, start, end, usageLimit: 100, usagePerUserLimit: 1);

        var ex = Assert.Throws<BusinessException>(() => voucher.ValidateApplicable(100000m, userUsageCount: 1));
        Assert.Contains("Hạn mức cho mỗi tài khoản: 1 lần", ex.Message);
    }

    [Fact]
    public void RecordUsage_ValidUsage_ShouldIncrementUsedCountAndAddHistory()
    {
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);
        var voucher = new Voucher("TESTUSE", DiscountType.FixedAmount, 30000m, start, end, usageLimit: 10);

        var usage = voucher.RecordUsage(userId: 1, orderId: 10, discountApplied: 30000m);

        Assert.Equal(1, voucher.UsedCount);
        Assert.Single(voucher.Usages);
        Assert.Equal(1, usage.UserId);
        Assert.Equal(10, usage.OrderId);
        Assert.Equal(30000m, usage.DiscountApplied);
    }

    [Fact]
    public void Order_ApplyVoucher_ShouldRecalculateTotalAmountWithDiscount()
    {
        var order = new Order(OrderType.DineIn, tableId: 1);
        var item = new MenuItem(1, "RMN01", "Tonkotsu Ramen", 150000m);
        order.AddItem(item, 2); // Subtotal = 300,000đ; Tax = 24,000đ; Total = 324,000đ

        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);
        var voucher = new Voucher("DISC50K", DiscountType.FixedAmount, 50000m, start, end);

        order.ApplyVoucher(voucher);

        Assert.Equal(voucher.Id, order.VoucherId);
        Assert.Equal(50000m, order.DiscountAmount);
        // Total = 300,000 + 24,000 - 50,000 = 274,000đ
        Assert.Equal(274000m, order.TotalAmount);
    }

    [Fact]
    public void RecordUsage_WhenMinOrderAmountExceedsDiscountApplied_WithOrderSubTotal_ShouldSucceed()
    {
        var start = DateTime.UtcNow.AddDays(-1);
        var end = DateTime.UtcNow.AddDays(7);
        var voucher = new Voucher("JAPAN50K", DiscountType.FixedAmount, 50000m, start, end, minOrderAmount: 300000m, usageLimit: 10, usagePerUserLimit: 1);

        var usage = voucher.RecordUsage(userId: 1, orderId: 100, discountApplied: 50000m, userUsageCount: 0, orderSubTotal: 350000m);

        Assert.Equal(1, voucher.UsedCount);
        Assert.Equal(50000m, usage.DiscountApplied);
    }
}
