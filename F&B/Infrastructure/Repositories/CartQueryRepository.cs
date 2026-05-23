using Application.DTOs.Cart;
using Application.Interfaces.Repositories;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class CartQueryRepository : ICartQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public CartQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<CartViewDto> GetUserCartAsync(int userId, CancellationToken ct = default)
    {
        var items = await _context.CartItems
            .AsNoTracking()
            .AsSplitQuery()
            .Where(c => c.UserId == userId)
            .Select(c => new CartItemDto
            {
                CartItemId = c.Id,
                MenuItemId = c.MenuItemId,
                DishCode = c.MenuItem != null ? c.MenuItem.Code : string.Empty,
                ItemName = c.MenuItem != null ? c.MenuItem.Name : string.Empty,
                JapaneseName = c.MenuItem != null ? c.MenuItem.JapaneseName : null,
                ImageUrl = c.MenuItem != null ? c.MenuItem.ImageUrl : null,
                BasePrice = c.MenuItem != null ? c.MenuItem.BasePrice : 0m,
                Quantity = c.Quantity,
                SpecialInstructions = c.SpecialInstructions,
                Modifiers = c.Modifiers.Select(m => new CartItemModifierDto
                {
                    ModifierOptionId = m.ModifierOptionId,
                    OptionName = m.ModifierOption != null ? m.ModifierOption.OptionName : string.Empty,
                    PriceAdjustment = m.ModifierOption != null ? m.ModifierOption.PriceAdjustment : 0m,
                    Quantity = m.Quantity
                }).ToList()
            })
            .ToListAsync(ct);

        decimal subTotal = items.Sum(i => (i.BasePrice + i.Modifiers.Sum(m => m.PriceAdjustment * m.Quantity)) * i.Quantity);

        return new CartViewDto
        {
            Items = items,
            SubTotal = subTotal
        };
    }
}
