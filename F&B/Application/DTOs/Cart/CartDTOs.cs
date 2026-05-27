namespace Application.DTOs.Cart;

public class CartViewDto
{
    public List<CartItemDto> Items { get; set; } = new();
    public decimal SubTotal { get; set; }
    public int TotalItemCount => Items.Sum(i => i.Quantity);
}

public class CartItemDto
{
    public int CartItemId { get; set; }
    public int MenuItemId { get; set; }
    public string DishCode { get; set; } = string.Empty;
    public string ItemName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? ImageUrl { get; set; }
    public decimal BasePrice { get; set; }
    public int Quantity { get; set; }
    public string? SpecialInstructions { get; set; }
    public List<CartItemModifierDto> Modifiers { get; set; } = new();
    public decimal ItemTotalPrice => (BasePrice + Modifiers.Sum(m => m.PriceAdjustment * m.Quantity)) * Quantity;
}

public class CartItemModifierDto
{
    public int ModifierOptionId { get; set; }
    public string OptionName { get; set; } = string.Empty;
    public decimal PriceAdjustment { get; set; }
    public int Quantity { get; set; } = 1;
}

public class AddToCartRequestDto
{
    public int UserId { get; set; }
    public int MenuItemId { get; set; }
    public int Quantity { get; set; } = 1;
    public string? SpecialInstructions { get; set; }
    public List<int> ModifierOptionIds { get; set; } = new();
}
