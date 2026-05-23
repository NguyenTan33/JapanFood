using Application.Interfaces.Repositories;
using Domain.Entities.Menu;
using Domain.Exceptions;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class InventoryQueryRepository : IInventoryQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public InventoryQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task DeductInventoryForCompletedOrderAsync(
        int orderId,
        int staffUserId,
        CancellationToken ct = default)
    {
        // 1. Verify order exists
        var order = await _context.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng ID {orderId}.");

        // 2. Fetch order items not cancelled
        var orderItems = await _context.OrderItems
            .AsNoTracking()
            .Where(i => i.OrderId == orderId && i.ItemStatus != OrderItemStatus.Cancelled)
            .Select(i => new { i.MenuItemId, i.Quantity })
            .ToListAsync(ct);

        if (!orderItems.Any())
            return;

        var menuItemIds = orderItems.Select(x => x.MenuItemId).Distinct().ToList();

        // 3. Fetch Recipe BOM including gross wastage requirements
        var recipes = await _context.RecipeBOMs
            .AsNoTracking()
            .Where(r => menuItemIds.Contains(r.MenuItemId))
            .ToListAsync(ct);

        if (!recipes.Any())
            return;

        // 4. Calculate total required deduction per inventory item
        var deductions = new Dictionary<int, decimal>();
        foreach (var item in orderItems)
        {
            var itemRecipes = recipes.Where(r => r.MenuItemId == item.MenuItemId);
            foreach (var bom in itemRecipes)
            {
                decimal totalQtyNeeded = bom.CalculateGrossRequirement() * item.Quantity;
                if (deductions.ContainsKey(bom.InventoryItemId))
                {
                    deductions[bom.InventoryItemId] += totalQtyNeeded;
                }
                else
                {
                    deductions[bom.InventoryItemId] = totalQtyNeeded;
                }
            }
        }

        // 5. Track and deduct stock with concurrency safety
        var inventoryItemIds = deductions.Keys.ToList();
        var inventoryItems = await _context.InventoryItems
            .Where(inv => inventoryItemIds.Contains(inv.Id))
            .ToListAsync(ct);

        var reason = $"Xuất kho định lượng BOM cho đơn hàng #{order.OrderNumber} (NV: #{staffUserId})";

        foreach (var invItem in inventoryItems)
        {
            if (deductions.TryGetValue(invItem.Id, out decimal qtyToDeduct))
            {
                invItem.DeductStock(qtyToDeduct, reason);
            }
        }

        await _context.SaveChangesAsync(ct);
    }
}
