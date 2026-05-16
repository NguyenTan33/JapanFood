using Domain.Entities.Menu;
using Domain.Entities.Ordering;
using Domain.Exceptions;

namespace Domain.UnitTests.Ordering;

public class CartItemTests
{
    [Fact]
    public void Constructor_ValidInput_ShouldCreateCartItem()
    {
        var cartItem = new CartItem(userId: 1, menuItemId: 5, quantity: 2, "Ít hành");

        Assert.Equal(1, cartItem.UserId);
        Assert.Equal(5, cartItem.MenuItemId);
        Assert.Equal(2, cartItem.Quantity);
        Assert.Equal("Ít hành", cartItem.SpecialInstructions);
        Assert.Empty(cartItem.Modifiers);
    }

    [Fact]
    public void UpdateQuantity_ZeroOrNegative_ShouldThrowBusinessException()
    {
        var cartItem = new CartItem(userId: 1, menuItemId: 5, quantity: 1);

        var ex = Assert.Throws<BusinessException>(() => cartItem.UpdateQuantity(0));
        Assert.Contains("phải lớn hơn 0", ex.Message);
    }

    [Fact]
    public void UpdateQuantity_GreaterThan50_ShouldThrowBusinessException()
    {
        var cartItem = new CartItem(userId: 1, menuItemId: 5, quantity: 1);

        var ex = Assert.Throws<BusinessException>(() => cartItem.UpdateQuantity(51));
        Assert.Contains("không được vượt quá 50", ex.Message);
    }

    [Fact]
    public void Constructor_QuantityGreaterThan50_ShouldThrowBusinessException()
    {
        var ex = Assert.Throws<BusinessException>(() => new CartItem(1, 5, 51));
        Assert.Contains("không được vượt quá 50", ex.Message);
    }

    [Fact]
    public void AddModifier_ShouldAddOrUpdateModifierQuantity()
    {
        var cartItem = new CartItem(userId: 1, menuItemId: 5, quantity: 1);
        var opt = new ModifierOption(1, "OPT_EGG", "Thêm trứng ngâm tương", 15000m);

        cartItem.AddModifier(opt, 1);
        Assert.Single(cartItem.Modifiers);

        cartItem.AddModifier(opt, 2);
        Assert.Single(cartItem.Modifiers);
        Assert.Equal(3, cartItem.Modifiers.First().Quantity);
    }
}
