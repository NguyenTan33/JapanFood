using Application.DTOs.Menu;
using Domain.Entities.Inventory;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.Ordering;
using Domain.Entities.Payment;
using Domain.Entities.Reservations;
using Domain.Entities.Reviews;
using Domain.Entities.TableManagement;
using Domain.Entities.Vouchers;
using Infrastructure.Data;
using Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace APIAuth.QueryTests;

public class QueryRepositoryTests
{
    private JapanFoodDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<JapanFoodDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new JapanFoodDbContext(options);
    }

    [Fact]
    public async Task MenuQueryRepository_GetCategoriesAndDishes_WorksCorrectly()
    {
        using var context = CreateDbContext();

        var cat = new Category("RAMEN", "Ramen & Noodles", "Thực đơn Ramen Nhật", 1);
        var dish = new MenuItem(cat.Id, "RAMEN-01", "Tonkotsu Ramen", 120000m, "豚骨ラーメン", "Nước hầm xương 18 tiếng");
        cat.AddMenuItem(dish);

        context.Categories.Add(cat);
        await context.SaveChangesAsync();

        var repo = new MenuQueryRepository(context);

        // 1. GetCategoriesWithActiveDishesAsync
        var categories = await repo.GetCategoriesWithActiveDishesAsync();
        Assert.Single(categories);
        Assert.Equal("RAMEN", categories[0].CategoryCode);
        Assert.Single(categories[0].Dishes);
        Assert.Equal("Tonkotsu Ramen", categories[0].Dishes[0].Name);

        // 2. GetPagedDishesAsync
        var paged = await repo.GetPagedDishesAsync(new DishFilterQueryDto { Keyword = "Tonkotsu" });
        Assert.Equal(1, paged.TotalCount);
        Assert.Equal("RAMEN-01", paged.Items[0].Code);

        // 3. GetDishDetailByCodeAsync
        var detail = await repo.GetDishDetailByCodeAsync("RAMEN-01");
        Assert.NotNull(detail);
        Assert.Equal(120000m, detail.BasePrice);

        // 4. CheckDishAvailabilityAsync
        var unavailable = await repo.CheckDishAvailabilityAsync(new List<int> { dish.Id });
        Assert.Empty(unavailable);
    }

    [Fact]
    public async Task TableReservationQueryRepository_IntervalOverlapAlgorithm_ExcludesBookedTables()
    {
        using var context = CreateDbContext();

        var area = new TableArea("MAIN", "Sảnh chính");
        context.TableAreas.Add(area);
        await context.SaveChangesAsync();

        var table1 = new Table(area.Id, "T-01", 4, 2);
        var table2 = new Table(area.Id, "T-02", 4, 2);
        context.Tables.AddRange(table1, table2);
        await context.SaveChangesAsync();

        var now = DateTime.UtcNow.Date.AddDays(1).AddHours(18); // 18:00 tomorrow

        // Table 1 is booked from 18:00 to 20:00 (120 mins)
        var res1 = new Reservation("Yamada", "0901234567", null, 4, now);
        res1.AssignTable(table1.Id);
        res1.Confirm(1);

        context.Reservations.Add(res1);
        await context.SaveChangesAsync();

        var repo = new TableReservationQueryRepository(context);

        // Test 1: Query at 18:30 (overlaps with Table 1) -> only Table 2 available
        var availableAt1830 = await repo.FindAvailableTablesAsync(now.AddMinutes(30), durationMinutes: 120, guestCount: 3);
        Assert.Single(availableAt1830);
        Assert.Equal("T-02", availableAt1830[0].TableNumber);

        // Test 2: Query at 21:00 (after 20:00, no overlap) -> both Table 1 & Table 2 available
        var availableAt2100 = await repo.FindAvailableTablesAsync(now.AddHours(3), durationMinutes: 120, guestCount: 3);
        Assert.Equal(2, availableAt2100.Count);
    }

    [Fact]
    public async Task VoucherQueryRepository_ValidatesRulesAccurately()
    {
        using var context = CreateDbContext();

        var validVoucher = new Voucher(
            "JAPAN20",
            DiscountType.Percentage,
            20m, // 20%
            DateTime.UtcNow.AddDays(-1),
            DateTime.UtcNow.AddDays(5),
            minOrderAmount: 200000m,
            maxDiscountAmount: 50000m,
            usageLimit: 10,
            usagePerUserLimit: 1);

        var expiredVoucher = new Voucher(
            "EXPIRED",
            DiscountType.FixedAmount,
            30000m,
            DateTime.UtcNow.AddDays(-10),
            DateTime.UtcNow.AddDays(-1),
            minOrderAmount: 100000m);

        context.Vouchers.AddRange(validVoucher, expiredVoucher);
        await context.SaveChangesAsync();

        var repo = new VoucherQueryRepository(context);

        // 1. Expired voucher test
        var expiredResult = await repo.GetActiveVoucherByCodeAsync("EXPIRED", 250000m, 1);
        Assert.False(expiredResult.IsValid);
        Assert.Contains("hết hạn", expiredResult.ErrorMessage);

        // 2. Subtotal below minimum test
        var lowAmountResult = await repo.GetActiveVoucherByCodeAsync("JAPAN20", 150000m, 1);
        Assert.False(lowAmountResult.IsValid);
        Assert.Contains("tối thiểu", lowAmountResult.ErrorMessage);

        // 3. Valid voucher test with max discount cap (20% of 400.000 = 80.000, capped at 50.000)
        var validResult = await repo.GetActiveVoucherByCodeAsync("JAPAN20", 400000m, 1);
        Assert.True(validResult.IsValid);
        Assert.Equal(50000m, validResult.DiscountAmount);
    }

    [Fact]
    public async Task DishReviewQueryRepository_CanUserReviewDish_ValidatesProperly()
    {
        using var context = CreateDbContext();

        var cat = new Category("SUSHI", "Sushi");
        var dish = new MenuItem(cat.Id, "SUSHI-05", "Nigiri", 100000m);
        cat.AddMenuItem(dish);
        context.Categories.Add(cat);
        await context.SaveChangesAsync();

        var order = new Order(OrderType.Takeaway, null, userId: 10, null, 1);
        var item = order.AddItem(dish, quantity: 1);
        item.MarkSentToKitchen();
        item.MarkCooking();
        item.MarkReady();
        item.MarkServed();
        order.CompleteOrder();

        context.Orders.Add(order);
        await context.SaveChangesAsync();

        var repo = new DishReviewQueryRepository(context);

        // 1. Should be able to review
        var canReview = await repo.CanUserReviewDishAsync(userId: 10, menuItemId: dish.Id, orderId: order.Id);
        Assert.True(canReview);

        // 2. Should NOT be able to review for dish not in order
        var cannotReviewDish = await repo.CanUserReviewDishAsync(userId: 10, menuItemId: 999, orderId: order.Id);
        Assert.False(cannotReviewDish);

        // 3. User reviews dish, then should not be able to review again
        var review = new MenuItemReview(userId: 10, menuItemId: dish.Id, orderId: order.Id, rating: 5, comment: "Rất ngon!");
        context.MenuItemReviews.Add(review);
        await context.SaveChangesAsync();

        var canReviewAgain = await repo.CanUserReviewDishAsync(userId: 10, menuItemId: dish.Id, orderId: order.Id);
        Assert.False(canReviewAgain);
    }

    [Fact]
    public async Task CartQueryRepository_CalculatesSubtotalWithModifiersCorrectly()
    {
        using var context = CreateDbContext();

        var cat = new Category("SUSHI", "Sushi");
        var dish = new MenuItem(cat.Id, "SUSHI-01", "Sake Nigiri", 50000m);
        cat.AddMenuItem(dish);
        context.Categories.Add(cat);
        await context.SaveChangesAsync();

        var modGroup = new ModifierGroup("WASABI", "Lượng Wasabi", 0, 1);
        var modOption = new ModifierOption(modGroup.Id, "WASABI-EXTRA", "Thêm Wasabi tươi", 10000m);
        modGroup.AddOption(modOption);
        context.ModifierGroups.Add(modGroup);
        await context.SaveChangesAsync();

        var cartItem = new CartItem(userId: 1, menuItemId: dish.Id, quantity: 2);
        cartItem.AddModifier(modOption, quantity: 1);
        context.CartItems.Add(cartItem);
        await context.SaveChangesAsync();

        var repo = new CartQueryRepository(context);
        var cartView = await repo.GetUserCartAsync(userId: 1);

        Assert.Single(cartView.Items);
        // (50.000 + 10.000) * 2 = 120.000
        Assert.Equal(120000m, cartView.SubTotal);
    }

    [Fact]
    public async Task InventoryQueryRepository_DeductInventoryForCompletedOrder_DeductsAccurately()
    {
        using var context = CreateDbContext();

        var uom = new UnitOfMeasure("GRAM", "Gram");
        context.UnitsOfMeasure.Add(uom);
        await context.SaveChangesAsync();

        var invItem = new InventoryItem("SALMON-01", "Cá hồi phi lê", "Hải sản", uom.Id, minimumStock: 500, unitCost: 400);
        invItem.AddStock(5000, 400, "Nhập kho ban đầu");
        context.InventoryItems.Add(invItem);
        await context.SaveChangesAsync();

        var cat = new Category("SASHIMI", "Sashimi");
        var dish = new MenuItem(cat.Id, "SASHIMI-01", "Sashimi Cá Hồi", 150000m);
        cat.AddMenuItem(dish);
        context.Categories.Add(cat);
        await context.SaveChangesAsync();

        // 1 portion sashimi requires 100g salmon with 10% wastage -> Gross = 110g
        var bom = new RecipeBOM(dish.Id, invItem.Id, quantityRequired: 100m, uom.Id, wastagePercentage: 10m);
        dish.AddRecipe(bom);
        context.RecipeBOMs.Add(bom);
        await context.SaveChangesAsync();

        var order = new Order(OrderType.Takeaway, null, 1, null, 1);
        var orderItem = order.AddItem(dish, quantity: 2);
        orderItem.MarkSentToKitchen();
        orderItem.MarkCooking();
        orderItem.MarkReady();
        orderItem.MarkServed();
        order.CompleteOrder();
        context.Orders.Add(order);
        await context.SaveChangesAsync();

        var repo = new InventoryQueryRepository(context);
        await repo.DeductInventoryForCompletedOrderAsync(order.Id, staffUserId: 1);

        var updatedInv = await context.InventoryItems.FindAsync(invItem.Id);
        Assert.NotNull(updatedInv);
        // Deducted: 2 * 110g = 220g -> Remaining: 5000 - 220 = 4780g
        Assert.Equal(4780m, updatedInv.CurrentStock);
    }
}
