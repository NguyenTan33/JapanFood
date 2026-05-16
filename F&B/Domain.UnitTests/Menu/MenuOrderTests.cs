using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Domain.UnitTests.Menu;

public class MenuOrderTests
{
    private static (MenuItem item, ModifierGroup noodleGroup, ModifierGroup toppingGroup) CreateSampleRamenMenuItem()
    {
        var category = new Category("RAMEN", "Mì Ramen", "Các món ramen trứ danh", 1);
        var menuItem = new MenuItem(
            categoryId: 1,
            code: "RAMEN-TONKOTSU",
            name: "Tonkotsu Special Ramen",
            basePrice: 120_000m,
            japaneseName: "豚骨ラーメン",
            description: "Nước dùng hầm xương heo 18 tiếng đậm đà",
            kitchenStation: KitchenStationType.NoodleStation,
            estimatedPrepMinutes: 8);
        category.AddMenuItem(menuItem);

        // Required single-choice modifier group: Noodle firmness
        var noodleGroup = new ModifierGroup("MOD-NOODLE", "Độ cứng sợi mì", minSelection: 1, maxSelection: 1);
        var optKatame = new ModifierOption(1, "OPT-KATAME", "Katame (Cứng)", 0m, isDefault: false);
        var optFutsu = new ModifierOption(1, "OPT-FUTSU", "Futsu (Vừa)", 0m, isDefault: true);
        var optYawarakame = new ModifierOption(1, "OPT-YAWARAKAME", "Yawarakame (Mềm)", 0m, isDefault: false);
        noodleGroup.AddOption(optKatame);
        noodleGroup.AddOption(optFutsu);
        noodleGroup.AddOption(optYawarakame);

        // Optional multi-choice modifier group: Extra toppings
        var toppingGroup = new ModifierGroup("MOD-TOPPING", "Topping thêm", minSelection: 0, maxSelection: 5);
        var optChashu = new ModifierOption(2, "OPT-CHASHU", "Thịt Chashu (2 miếng)", 30_000m);
        var optTamago = new ModifierOption(2, "OPT-TAMAGO", "Trứng ngâm tương Nitamago", 15_000m);
        var optNori = new ModifierOption(2, "OPT-NORI", "Rong biển Nori (3 lá)", 10_000m);
        toppingGroup.AddOption(optChashu);
        toppingGroup.AddOption(optTamago);
        toppingGroup.AddOption(optNori);

        menuItem.AddModifierGroup(noodleGroup, 1);
        menuItem.AddModifierGroup(toppingGroup, 2);

        return (menuItem, noodleGroup, toppingGroup);
    }

    #region Category & MenuItem Creation Tests

    [Fact]
    public void Category_WithValidData_ShouldCreateCategory()
    {
        var category = new Category("APPETIZER", "Khai vị", "Món khai vị truyền thống Nhật Bản", 2);

        Assert.Equal("APPETIZER", category.CategoryCode);
        Assert.Equal("Khai vị", category.CategoryName);
        Assert.True(category.IsActive);
        Assert.Empty(category.MenuItems);
    }

    [Theory]
    [InlineData("", "Món chính")]
    [InlineData(null, "Món chính")]
    [InlineData("MAIN", "")]
    [InlineData("MAIN", null)]
    public void Category_WithEmptyCodeOrName_ShouldThrowBusinessException(string? code, string? name)
    {
        Assert.Throws<BusinessException>(() => new Category(code!, name!));
    }

    [Fact]
    public void MenuItem_WithValidData_ShouldInitializeCorrectly()
    {
        var item = new MenuItem(
            categoryId: 1,
            code: "SIDE-GYOZA",
            name: "Gyoza Chiên Giòn (6 viên)",
            basePrice: 55_000m,
            japaneseName: "焼き餃子",
            kitchenStation: KitchenStationType.FryGrillStation,
            estimatedPrepMinutes: 6);

        Assert.Equal("SIDE-GYOZA", item.Code);
        Assert.Equal("Gyoza Chiên Giòn (6 viên)", item.Name);
        Assert.Equal(55_000m, item.BasePrice);
        Assert.True(item.IsAvailable);
        Assert.True(item.IsKitchenItem);
        Assert.Equal(KitchenStationType.FryGrillStation, item.KitchenStation);
        Assert.Equal(6, item.EstimatedPrepMinutes);
    }

    [Theory]
    [InlineData(-1000)]
    [InlineData(-50_000)]
    public void MenuItem_WithNegativeBasePrice_ShouldThrowBusinessException(decimal price)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new MenuItem(1, "TEST", "Test Item", price));
        Assert.Contains("Giá món ăn không được âm", ex.Message);
    }

    [Fact]
    public void MenuItem_UpdatePrice_WithNegativePrice_ShouldThrowBusinessException()
    {
        var item = new MenuItem(1, "TEST", "Test Item", 50_000m);
        var ex = Assert.Throws<BusinessException>(() => item.UpdatePrice(-500m));
        Assert.Contains("Giá món ăn không được âm", ex.Message);
    }

    [Fact]
    public void Category_AddMenuItem_WithDuplicateCode_ShouldThrowBusinessException()
    {
        var category = new Category("BEV", "Đồ uống");
        var item1 = new MenuItem(1, "BEV-TEA", "Trà gạo rang Genmaicha", 25_000m);
        var item2 = new MenuItem(1, "bev-tea", "Trà xanh Sencha", 30_000m);

        category.AddMenuItem(item1);
        var ex = Assert.Throws<BusinessException>(() => category.AddMenuItem(item2));
        Assert.Contains("đã tồn tại trong danh mục", ex.Message);
    }

    #endregion

    #region ModifierGroup & ModifierOption Tests

    [Fact]
    public void ModifierGroup_Invariants_MinAndMaxSelection()
    {
        // Valid required single choice
        var group = new ModifierGroup("MOD-SPICE", "Độ cay", minSelection: 1, maxSelection: 1);
        Assert.True(group.IsRequired);
        Assert.False(group.IsMultiple);

        // Invalid: min < 0
        var ex1 = Assert.Throws<BusinessException>(() => new ModifierGroup("G1", "Group 1", minSelection: -1, maxSelection: 2));
        Assert.Contains("tối thiểu không được nhỏ hơn 0", ex1.Message);

        // Invalid: max < min
        var ex2 = Assert.Throws<BusinessException>(() => new ModifierGroup("G2", "Group 2", minSelection: 3, maxSelection: 2));
        Assert.Contains("tối đa phải lớn hơn hoặc bằng số tối thiểu", ex2.Message);

        // Invalid: max <= 0
        var ex3 = Assert.Throws<BusinessException>(() => new ModifierGroup("G3", "Group 3", minSelection: 0, maxSelection: 0));
        Assert.Contains("lớn hơn 0", ex3.Message);
    }

    [Fact]
    public void ModifierOption_WithNegativePriceAdjustment_ShouldThrowBusinessException()
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new ModifierOption(1, "OPT-NEG", "Negative Option", priceAdjustment: -10_000m));
        Assert.Contains("Phụ thu tùy chọn không được âm", ex.Message);
    }

    [Fact]
    public void ModifierGroup_AddOption_DuplicateOptionCode_ShouldThrowBusinessException()
    {
        var group = new ModifierGroup("BROTH", "Độ đậm nước dùng", 1, 1);
        var opt1 = new ModifierOption(1, "KOTTERI", "Kotteri (Đậm đà)");
        var opt2 = new ModifierOption(1, "kotteri", "Kotteri Đậm");

        group.AddOption(opt1);
        var ex = Assert.Throws<BusinessException>(() => group.AddOption(opt2));
        Assert.Contains("đã tồn tại trong nhóm", ex.Message);
    }

    [Fact]
    public void MenuItem_AddDuplicateModifierGroup_ShouldThrowBusinessException()
    {
        var item = new MenuItem(1, "RAMEN-1", "Shoyu Ramen", 100_000m);
        var group = new ModifierGroup("MOD-NOODLE", "Độ cứng sợi mì", 1, 1);

        item.AddModifierGroup(group);
        var ex = Assert.Throws<BusinessException>(() => item.AddModifierGroup(group));
        Assert.Contains("đã tồn tại cho món", ex.Message);
    }

    #endregion

    #region Order Creation & Invariants Tests

    [Fact]
    public void Order_DineInWithoutTable_ShouldThrowBusinessException()
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new Order(OrderType.DineIn, tableId: null, guestCount: 2));
        Assert.Contains("Đơn ăn tại quán (DineIn) bắt buộc phải có thông tin bàn", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Order_WithZeroOrNegativeGuestCount_ShouldThrowBusinessException(int count)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new Order(OrderType.Takeaway, guestCount: count));
        Assert.Contains("Số lượng khách phải lớn hơn 0", ex.Message);
    }

    [Fact]
    public void Order_AddItem_WithValidModifiers_ShouldCalculateTotalsCorrectly()
    {
        // Arrange
        var (menuItem, noodleGroup, toppingGroup) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.DineIn, tableId: 5, guestCount: 2);

        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU"); // 0 VND
        var optChashu = toppingGroup.Options.First(o => o.OptionCode == "OPT-CHASHU"); // +30,000 VND
        var optTamago = toppingGroup.Options.First(o => o.OptionCode == "OPT-TAMAGO"); // +15,000 VND

        var selectedMods = new List<(ModifierOption option, int quantity)>
        {
            (optFutsu, 1),
            (optChashu, 2), // 2 * 30,000 = 60,000
            (optTamago, 1)  // 1 * 15,000 = 15,000
        };

        // Act: Add 2 bowls of ramen
        // Each bowl: Base 120,000 + Modifiers 75,000 = 195,000
        // 2 bowls: 390,000 SubTotal
        var item = order.AddItem(menuItem, quantity: 2, selectedMods, "Ít hành lá");

        // Assert
        Assert.Equal(120_000m, item.UnitPrice);
        Assert.Equal(75_000m, item.ModifiersPrice);
        Assert.Equal(390_000m, item.TotalPrice);
        Assert.Equal(3, item.Modifiers.Count);

        Assert.Equal(390_000m, order.SubTotal);
        // VAT 8%: 390,000 * 0.08 = 31,200
        Assert.Equal(31_200m, order.TaxAmount);
        // Total: 390,000 + 31,200 = 421,200
        Assert.Equal(421_200m, order.TotalAmount);
    }

    [Fact]
    public void Order_AddItem_OmittingRequiredModifier_ShouldThrowBusinessException()
    {
        var (menuItem, _, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);

        // Noodle firmness has MinSelection = 1; we provide empty modifiers
        var ex = Assert.Throws<BusinessException>(() =>
            order.AddItem(menuItem, quantity: 1, selectedModifiers: null));
        Assert.Contains("Bắt buộc phải chọn nhóm 'Độ cứng sợi mì'", ex.Message);
    }

    [Fact]
    public void Order_AddItem_ExceedingMaxSelection_ShouldThrowBusinessException()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);

        var optKatame = noodleGroup.Options.First(o => o.OptionCode == "OPT-KATAME");
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        // Noodle group has MaxSelection = 1; choosing both should fail
        var selected = new List<(ModifierOption option, int quantity)>
        {
            (optKatame, 1),
            (optFutsu, 1)
        };

        var ex = Assert.Throws<BusinessException>(() =>
            order.AddItem(menuItem, quantity: 1, selectedModifiers: selected));
        Assert.Contains("vượt quá tối đa (1)", ex.Message);
    }

    [Fact]
    public void Order_AddItem_WhenOptionUnavailable_ShouldThrowBusinessException()
    {
        var (menuItem, noodleGroup, toppingGroup) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);

        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");
        var optChashu = toppingGroup.Options.First(o => o.OptionCode == "OPT-CHASHU");
        optChashu.SetAvailability(false); // Out of stock

        var selected = new List<(ModifierOption, int)>
        {
            (optFutsu, 1),
            (optChashu, 1)
        };

        var ex = Assert.Throws<BusinessException>(() =>
            order.AddItem(menuItem, quantity: 1, selectedModifiers: selected));
        Assert.Contains("hiện không khả dụng", ex.Message);
    }

    [Fact]
    public void Order_AddItem_WhenOptionBelongsToDifferentGroup_ShouldThrowBusinessException()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);

        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");
        var unrelatedOption = new ModifierOption(999, "OPT-UNRELATED", "Unrelated Option", 10_000m);

        var selected = new List<(ModifierOption, int)>
        {
            (optFutsu, 1),
            (unrelatedOption, 1)
        };

        var ex = Assert.Throws<BusinessException>(() =>
            order.AddItem(menuItem, quantity: 1, selectedModifiers: selected));
        Assert.Contains("không thuộc bất kỳ nhóm tùy chọn nào của món", ex.Message);
    }

    [Fact]
    public void ApplyDiscount_ValidAndInvalidThresholds()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });
        // SubTotal: 120,000, Tax: 9,600, Gross: 129,600

        // Negative discount throws
        var ex1 = Assert.Throws<BusinessException>(() => order.ApplyDiscount(-1000m));
        Assert.Contains("Số tiền giảm giá không được âm", ex1.Message);

        // Discount exceeding gross throws
        var ex2 = Assert.Throws<BusinessException>(() => order.ApplyDiscount(130_000m));
        Assert.Contains("không được vượt quá tổng hóa đơn", ex2.Message);

        // Valid discount
        order.ApplyDiscount(29_600m);
        Assert.Equal(29_600m, order.DiscountAmount);
        Assert.Equal(100_000m, order.TotalAmount);
    }

    [Fact]
    public void SendToKitchen_TransitionsOrderToInPreparationAndItemsToSentToKitchen()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        var item = order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });
        Assert.Equal(OrderItemStatus.Pending, item.ItemStatus);
        Assert.Equal(OrderStatus.Pending, order.Status);

        order.SendToKitchen();

        Assert.Equal(OrderItemStatus.SentToKitchen, item.ItemStatus);
        Assert.Equal(OrderStatus.InPreparation, order.Status);
    }

    [Fact]
    public void CancelItem_ReducesTotalsAndMarksItemCancelled()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        var item1 = order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });
        var item2 = order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });
        Assert.Equal(240_000m, order.SubTotal);

        // Cancel item2
        item2.Cancel("Khách đổi ý không ăn tô thứ hai");
        order.RecalculateTotals();

        Assert.Equal(OrderItemStatus.Cancelled, item2.ItemStatus);
        Assert.Equal(120_000m, order.SubTotal);
    }

    [Fact]
    public void CompleteOrder_WhenItemsUnserved_ShouldThrowBusinessException()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });

        var ex = Assert.Throws<BusinessException>(() => order.CompleteOrder());
        Assert.Contains("vẫn còn 1 món chưa phục vụ hoàn tất", ex.Message);
    }

    [Fact]
    public void CompleteOrder_WhenAllItemsServed_ShouldSucceed()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        var item = order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });
        item.MarkSentToKitchen();
        item.MarkCooking();
        item.MarkReady();
        item.MarkServed();

        order.CompleteOrder();

        Assert.Equal(OrderStatus.Completed, order.Status);
        Assert.NotNull(order.CompletedAt);
    }

    [Fact]
    public void CancelOrder_WhenActive_ShouldCancelAllItemsAndSetStatus()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        var item = order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });

        order.CancelOrder("Khách có việc gấp phải về");

        Assert.Equal(OrderStatus.Cancelled, order.Status);
        Assert.Equal(OrderItemStatus.Cancelled, item.ItemStatus);
        Assert.Contains("Khách có việc gấp", order.Notes);
    }

    [Fact]
    public void CancelOrder_WhenAlreadyCompleted_ShouldThrowBusinessException()
    {
        var (menuItem, noodleGroup, _) = CreateSampleRamenMenuItem();
        var order = new Order(OrderType.Takeaway, guestCount: 1);
        var optFutsu = noodleGroup.Options.First(o => o.OptionCode == "OPT-FUTSU");

        var item = order.AddItem(menuItem, 1, new[] { (optFutsu, 1) });
        item.MarkSentToKitchen();
        item.MarkCooking();
        item.MarkReady();
        item.MarkServed();
        order.CompleteOrder();

        var ex = Assert.Throws<BusinessException>(() => order.CancelOrder("Too late"));
        Assert.Contains("Không thể hủy đơn hàng đã hoàn tất thanh toán", ex.Message);
    }

    #endregion
}
