using Application.Common.Extensions;
using Application.Common.Models;
using Application.DTOs.Ordering;
using Application.Interfaces.Repositories;
using Domain.Entities.Menu;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class OrderQueryRepository : IOrderQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public OrderQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<OrderDetailViewDto?> GetOrderWithDetailsByIdAsync(
        int orderId,
        CancellationToken ct = default)
    {
        return await _context.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Where(o => o.Id == orderId)
            .Select(o => new OrderDetailViewDto
            {
                OrderId = o.Id,
                UserId = o.UserId,
                OrderNumber = o.OrderNumber,
                Status = o.Status.ToString(),
                OrderType = o.OrderType.ToString(),
                GuestCount = o.GuestCount,
                SubTotal = o.SubTotal,
                TaxAmount = o.TaxAmount,
                DiscountAmount = o.DiscountAmount,
                DeliveryFee = o.DeliveryFee,
                TotalAmount = o.TotalAmount,
                DepositRate = o.PaymentMethod == OrderPaymentMethod.Cod50Deposit ? 0.5m : 1.0m,
                DepositAmount = o.DepositAmount > 0 ? o.DepositAmount : (o.PaymentMethod == OrderPaymentMethod.Cod50Deposit ? Math.Round(o.TotalAmount * 0.5m, 0) : o.TotalAmount),
                RemainingCodAmount = o.PaymentMethod == OrderPaymentMethod.Cod50Deposit
                    ? (o.RemainingCodAmount > 0 ? o.RemainingCodAmount : Math.Max(0m, o.TotalAmount - Math.Round(o.TotalAmount * 0.5m, 0)))
                    : 0m,
                PaymentMethod = o.PaymentMethod.HasValue ? o.PaymentMethod.Value.ToString() : null,
                DeliveryAddress = o.DeliveryAddress,
                RecipientName = o.RecipientName,
                RecipientPhone = o.RecipientPhone,
                Notes = o.Notes,
                CreatedAt = o.CreatedAt,
                CompletedAt = o.CompletedAt,
                TableNumber = o.Table != null ? o.Table.TableNumber : null,
                AreaName = o.Table != null ? o.Table.Area.AreaName : null,
                VoucherCode = o.Voucher != null ? o.Voucher.VoucherCode : null,
                Items = o.Items
                    .Where(i => i.ItemStatus != OrderItemStatus.Cancelled)
                    .Select(i => new OrderItemViewDto
                    {
                        OrderItemId = i.Id,
                        MenuItemId = i.MenuItemId,
                        DishCode = i.MenuItem.Code,
                        ItemName = i.MenuItem.Name,
                        ImageUrl = i.MenuItem.ImageUrl,
                        UnitPrice = i.UnitPrice,
                        Quantity = i.Quantity,
                        ModifiersPrice = i.ModifiersPrice,
                        TotalPrice = (i.UnitPrice + i.ModifiersPrice) * i.Quantity,
                        ItemStatus = i.ItemStatus.ToString(),
                        SpecialInstructions = i.SpecialInstructions,
                        Modifiers = i.Modifiers.Select(m => new OrderItemModifierViewDto
                        {
                            ModifierOptionName = m.ModifierOptionName,
                            PriceAdjustment = m.PriceAdjustment,
                            Quantity = m.Quantity
                        }).ToList()
                    }).ToList(),
                PaymentTransactions = o.PaymentTransactions
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => new PaymentTransactionViewDto
                    {
                        TransactionNumber = p.TransactionNumber,
                        Gateway = p.Gateway.ToString(),
                        Status = p.Status.ToString(),
                        Amount = p.Amount,
                        GatewayTransactionId = p.GatewayTransactionId,
                        PaidAt = p.PaidAt
                    }).ToList()
            })
            .FirstOrDefaultAsync(ct);
    }

    public async Task<PagedResult<OrderDetailViewDto>> GetUserOrderHistoryAsync(
        int userId,
        OrderStatus? status = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default)
    {
        var query = _context.Orders
            .AsNoTracking()
            .AsSplitQuery()
            .Where(o => o.UserId == userId);

        if (status.HasValue)
        {
            query = query.Where(o => o.Status == status.Value);
        }

        if (fromDate.HasValue)
        {
            query = query.Where(o => o.CreatedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(o => o.CreatedAt <= toDate.Value);
        }

        query = query.OrderByDescending(o => o.CreatedAt);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .ApplyPaging(page, pageSize)
            .Select(o => new OrderDetailViewDto
            {
                OrderId = o.Id,
                UserId = o.UserId,
                OrderNumber = o.OrderNumber,
                Status = o.Status.ToString(),
                OrderType = o.OrderType.ToString(),
                GuestCount = o.GuestCount,
                SubTotal = o.SubTotal,
                TaxAmount = o.TaxAmount,
                DiscountAmount = o.DiscountAmount,
                DeliveryFee = o.DeliveryFee,
                TotalAmount = o.TotalAmount,
                DepositRate = o.PaymentMethod == OrderPaymentMethod.Cod50Deposit ? 0.5m : 1.0m,
                DepositAmount = o.DepositAmount > 0 ? o.DepositAmount : (o.PaymentMethod == OrderPaymentMethod.Cod50Deposit ? Math.Round(o.TotalAmount * 0.5m, 0) : o.TotalAmount),
                RemainingCodAmount = o.PaymentMethod == OrderPaymentMethod.Cod50Deposit
                    ? (o.RemainingCodAmount > 0 ? o.RemainingCodAmount : Math.Max(0m, o.TotalAmount - Math.Round(o.TotalAmount * 0.5m, 0)))
                    : 0m,
                PaymentMethod = o.PaymentMethod.HasValue ? o.PaymentMethod.Value.ToString() : null,
                DeliveryAddress = o.DeliveryAddress,
                RecipientName = o.RecipientName,
                RecipientPhone = o.RecipientPhone,
                Notes = o.Notes,
                CreatedAt = o.CreatedAt,
                CompletedAt = o.CompletedAt,
                TableNumber = o.Table != null ? o.Table.TableNumber : null,
                AreaName = o.Table != null ? o.Table.Area.AreaName : null,
                VoucherCode = o.Voucher != null ? o.Voucher.VoucherCode : null,
                Items = o.Items
                    .Where(i => i.ItemStatus != OrderItemStatus.Cancelled)
                    .Select(i => new OrderItemViewDto
                    {
                        OrderItemId = i.Id,
                        MenuItemId = i.MenuItemId,
                        DishCode = i.MenuItem.Code,
                        ItemName = i.MenuItem.Name,
                        ImageUrl = i.MenuItem.ImageUrl,
                        UnitPrice = i.UnitPrice,
                        Quantity = i.Quantity,
                        ModifiersPrice = i.ModifiersPrice,
                        TotalPrice = (i.UnitPrice + i.ModifiersPrice) * i.Quantity,
                        ItemStatus = i.ItemStatus.ToString(),
                        SpecialInstructions = i.SpecialInstructions,
                        Modifiers = i.Modifiers.Select(m => new OrderItemModifierViewDto
                        {
                            ModifierOptionName = m.ModifierOptionName,
                            PriceAdjustment = m.PriceAdjustment,
                            Quantity = m.Quantity
                        }).ToList()
                    }).ToList(),
                PaymentTransactions = o.PaymentTransactions
                    .OrderByDescending(p => p.CreatedAt)
                    .Select(p => new PaymentTransactionViewDto
                    {
                        TransactionNumber = p.TransactionNumber,
                        Gateway = p.Gateway.ToString(),
                        Status = p.Status.ToString(),
                        Amount = p.Amount,
                        GatewayTransactionId = p.GatewayTransactionId,
                        PaidAt = p.PaidAt
                    }).ToList()
            })
            .ToListAsync(ct);

        var orderIds = items.Select(i => i.OrderId).ToList();
        if (orderIds.Any())
        {
            var reviewedOrderIds = await _context.MenuItemReviews
                .AsNoTracking()
                .Where(r => r.UserId == userId && orderIds.Contains(r.OrderId))
                .Select(r => r.OrderId)
                .Distinct()
                .ToListAsync(ct);

            var reviewedSet = new HashSet<int>(reviewedOrderIds);
            foreach (var item in items)
            {
                item.IsReviewed = reviewedSet.Contains(item.OrderId);
            }
        }

        return new PagedResult<OrderDetailViewDto>(items, totalCount, page, pageSize);
    }

    public async Task<List<RevenueReportPointDto>> GetRevenueReportAsync(
        DateTime fromDate,
        DateTime toDate,
        CancellationToken ct = default)
    {
        return await _context.Orders
            .AsNoTracking()
            .Where(o => o.Status == OrderStatus.Completed
                     && o.CompletedAt.HasValue
                     && o.CompletedAt.Value >= fromDate
                     && o.CompletedAt.Value <= toDate)
            .GroupBy(o => o.CompletedAt!.Value.Date)
            .Select(g => new RevenueReportPointDto
            {
                Date = g.Key,
                TotalOrders = g.Count(),
                TotalRevenue = g.Sum(o => o.TotalAmount),
                TotalTax = g.Sum(o => o.TaxAmount),
                TotalDiscount = g.Sum(o => o.DiscountAmount),
                NetSales = g.Sum(o => o.SubTotal)
            })
            .OrderBy(r => r.Date)
            .ToListAsync(ct);
    }

    public async Task<List<TopDishReportDto>> GetTopSellingDishesAsync(
        int topCount = 5,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var query = _context.OrderItems
            .AsNoTracking()
            .Where(i => i.Order.Status == OrderStatus.Completed
                     && i.ItemStatus != OrderItemStatus.Cancelled);

        if (fromDate.HasValue)
        {
            query = query.Where(i => i.Order.CompletedAt >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(i => i.Order.CompletedAt <= toDate.Value);
        }

        return await query
            .GroupBy(i => new { i.MenuItemId, i.MenuItem.Name, i.MenuItem.Code, i.MenuItem.ImageUrl })
            .Select(g => new TopDishReportDto
            {
                MenuItemId = g.Key.MenuItemId,
                ItemCode = g.Key.Code,
                ItemName = g.Key.Name,
                ImageUrl = g.Key.ImageUrl,
                TotalQuantitySold = g.Sum(i => i.Quantity),
                TotalRevenue = g.Sum(i => (i.UnitPrice + i.ModifiersPrice) * i.Quantity)
            })
            .OrderByDescending(d => d.TotalQuantitySold)
            .Take(topCount)
            .ToListAsync(ct);
    }

    public async Task<DetailedRevenueReportDto> GetDetailedRevenueReportAsync(
        DateTime? fromDate,
        DateTime? toDate,
        int? year,
        int? month,
        int? tableId,
        int? menuItemId,
        CancellationToken ct = default,
        int? categoryId = null)
    {
        DateTime start;
        DateTime end;

        if (year.HasValue && month.HasValue)
        {
            start = new DateTime(year.Value, month.Value, 1, 0, 0, 0, DateTimeKind.Utc);
            end = start.AddMonths(1).AddTicks(-1);
        }
        else if (year.HasValue)
        {
            start = new DateTime(year.Value, 1, 1, 0, 0, 0, DateTimeKind.Utc);
            end = start.AddYears(1).AddTicks(-1);
        }
        else
        {
            start = fromDate ?? DateTime.UtcNow.Date.AddDays(-30);
            end = toDate ?? DateTime.UtcNow;
        }

        var ordersQuery = _context.Orders
            .AsNoTracking()
            .Where(o => o.Status == OrderStatus.Completed
                     && o.CompletedAt.HasValue
                     && o.CompletedAt.Value >= start
                     && o.CompletedAt.Value <= end);

        if (tableId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.TableId == tableId.Value);
        }

        if (menuItemId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.Items.Any(i => i.MenuItemId == menuItemId.Value));
        }

        if (categoryId.HasValue)
        {
            ordersQuery = ordersQuery.Where(o => o.Items.Any(i => i.MenuItem != null && i.MenuItem.CategoryId == categoryId.Value));
        }

        var orders = await ordersQuery
            .Include(o => o.Table)
            .Include(o => o.Items)
                .ThenInclude(i => i.MenuItem)
            .Include(o => o.Items)
                .ThenInclude(i => i.Modifiers)
            .OrderByDescending(o => o.CompletedAt)
            .ToListAsync(ct);

        var totalRevenue = orders.Sum(o => o.TotalAmount);
        var netSales = orders.Sum(o => o.SubTotal);
        var totalTax = orders.Sum(o => o.TaxAmount);
        var totalDiscount = orders.Sum(o => o.DiscountAmount);
        var totalOrders = orders.Count;

        var cashRevenue = orders
            .Where(o => o.PaymentMethod == OrderPaymentMethod.Cash)
            .Sum(o => o.TotalAmount);
        var transferRevenue = orders
            .Where(o => o.PaymentMethod != OrderPaymentMethod.Cash)
            .Sum(o => o.TotalAmount);

        var chartPoints = orders
            .GroupBy(o => o.CompletedAt!.Value.Date)
            .Select(g => new RevenueReportPointDto
            {
                Date = g.Key,
                TotalOrders = g.Count(),
                TotalRevenue = g.Sum(o => o.TotalAmount),
                TotalTax = g.Sum(o => o.TaxAmount),
                TotalDiscount = g.Sum(o => o.DiscountAmount),
                NetSales = g.Sum(o => o.SubTotal)
            })
            .OrderBy(p => p.Date)
            .ToList();

        var soldItems = new List<SoldDishItemReportDto>();
        foreach (var o in orders)
        {
            foreach (var item in o.Items)
            {
                if (menuItemId.HasValue && item.MenuItemId != menuItemId.Value) continue;
                if (categoryId.HasValue && item.MenuItem?.CategoryId != categoryId.Value) continue;
                if (item.ItemStatus == OrderItemStatus.Cancelled) continue;

                soldItems.Add(new SoldDishItemReportDto
                {
                    OrderId = o.Id,
                    OrderNumber = o.OrderNumber,
                    TableNumber = o.Table?.TableNumber ?? (o.OrderType == OrderType.Takeaway ? "Mang về" : "Giao hàng"),
                    MenuItemId = item.MenuItemId,
                    DishName = item.MenuItem?.Name ?? $"Món #{item.MenuItemId}",
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    TotalPrice = item.TotalPrice,
                    ModifiersSummary = item.Modifiers != null && item.Modifiers.Any()
                        ? string.Join(", ", item.Modifiers.Select(m => m.ModifierOptionName))
                        : null,
                    CompletedAt = o.CompletedAt!.Value,
                    PaymentMethod = o.PaymentMethod?.ToString() ?? "CASH"
                });
            }
        }

        var totalDishesSold = soldItems.Sum(i => i.Quantity);

        var topDishes = soldItems
            .GroupBy(i => new { i.MenuItemId, i.DishName })
            .Select(g => new TopDishReportDto
            {
                MenuItemId = g.Key.MenuItemId,
                ItemName = g.Key.DishName,
                TotalQuantitySold = g.Sum(i => i.Quantity),
                TotalRevenue = g.Sum(i => i.TotalPrice)
            })
            .OrderByDescending(t => t.TotalRevenue)
            .Take(10)
            .ToList();

        return new DetailedRevenueReportDto
        {
            TotalRevenue = totalRevenue,
            NetSales = netSales,
            TotalTax = totalTax,
            TotalDiscount = totalDiscount,
            TotalOrders = totalOrders,
            TotalDishesSold = totalDishesSold,
            CashRevenue = cashRevenue,
            TransferRevenue = transferRevenue,
            ChartPoints = chartPoints,
            SoldItems = soldItems,
            TopDishes = topDishes
        };
    }
}
