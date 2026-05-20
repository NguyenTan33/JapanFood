using Application.DTOs.Kds;
using Application.Interfaces.Repositories;
using Domain.Entities.Kds;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class KitchenQueryRepository : IKitchenQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public KitchenQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<List<KitchenTicketDto>> GetActiveKitchenTicketsByStationAsync(
        KitchenStationType stationType,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        var tickets = await _context.KitchenTickets
            .AsNoTracking()
            .AsSplitQuery()
            .Where(k => (k.Status == KitchenTicketStatus.Pending || k.Status == KitchenTicketStatus.Cooking)
                     && k.Items.Any(i => i.Station != null && i.Station.StationType == stationType && i.Status != KitchenItemStatus.Cancelled))
            .OrderBy(k => k.CreatedAt) // FIFO: First-In First-Out
            .Select(k => new
            {
                Ticket = k,
                Items = k.Items
                    .Where(i => i.Station != null && i.Station.StationType == stationType && i.Status != KitchenItemStatus.Cancelled)
                    .ToList()
            })
            .ToListAsync(ct);

        return tickets.Select(t =>
        {
            var ticketElapsed = Math.Round((now - t.Ticket.CreatedAt).TotalMinutes, 1);
            var itemDtos = t.Items.Select(i =>
            {
                var itemElapsed = Math.Round((now - (i.CookingStartTime ?? t.Ticket.CreatedAt)).TotalMinutes, 1);
                var isOverdue = ticketElapsed >= 15.0;
                var warningColor = isOverdue ? "OVERDUE_RED" : (ticketElapsed >= 10.0 ? "WARNING_YELLOW" : "NORMAL");

                return new KitchenTicketItemDto
                {
                    TicketItemId = i.Id,
                    ItemName = i.MenuItemName,
                    Quantity = i.Quantity,
                    Status = i.Status.ToString(),
                    ModifiersSummary = i.ModifiersSummary,
                    SpecialInstructions = t.Ticket.Notes,
                    CookingStartTime = i.CookingStartTime,
                    ElapsedMinutes = itemElapsed,
                    IsOverdue = isOverdue,
                    WarningColor = warningColor
                };
            }).ToList();

            return new KitchenTicketDto
            {
                TicketId = t.Ticket.Id,
                TicketNumber = t.Ticket.TicketNumber,
                TableName = t.Ticket.TableName,
                Status = t.Ticket.Status.ToString(),
                IsRush = t.Ticket.IsRush,
                Notes = t.Ticket.Notes,
                CreatedAt = t.Ticket.CreatedAt,
                ElapsedMinutes = ticketElapsed,
                HasOverdueItems = itemDtos.Any(x => x.IsOverdue),
                Items = itemDtos
            };
        }).ToList();
    }

    public async Task<List<OverdueKitchenAlertDto>> GetOverdueKitchenAlertsAsync(
        int thresholdMinutes = 15,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var thresholdTime = now.AddMinutes(-thresholdMinutes);

        var overdueItems = await _context.KitchenTicketItems
            .AsNoTracking()
            .Where(i => (i.Status == KitchenItemStatus.Pending || i.Status == KitchenItemStatus.Cooking)
                     && i.Ticket != null
                     && (i.Ticket.Status == KitchenTicketStatus.Pending || i.Ticket.Status == KitchenTicketStatus.Cooking)
                     && i.Ticket.CreatedAt <= thresholdTime)
            .OrderBy(i => i.Ticket!.CreatedAt)
            .Select(i => new
            {
                TicketItem = i,
                Ticket = i.Ticket!,
                Station = i.Station,
                Order = i.Ticket!.OrderId
            })
            .ToListAsync(ct);

        return overdueItems.Select(x =>
        {
            var elapsed = Math.Round((now - x.Ticket.CreatedAt).TotalMinutes, 1);
            return new OverdueKitchenAlertDto
            {
                TicketItemId = x.TicketItem.Id,
                TicketNumber = x.Ticket.TicketNumber,
                TableId = null,
                TableName = x.Ticket.TableName,
                OrderId = x.Ticket.OrderId,
                OrderNumber = $"ORD-{x.Ticket.OrderId}",
                MenuItemName = x.TicketItem.MenuItemName,
                Quantity = x.TicketItem.Quantity,
                StationId = x.TicketItem.StationId,
                StationName = x.Station?.Name ?? "Bếp",
                ElapsedMinutes = elapsed,
                Status = x.TicketItem.Status.ToString(),
                AlertMessage = $"Món '{x.TicketItem.MenuItemName}' (x{x.TicketItem.Quantity}) tại bàn '{x.Ticket.TableName}' đã chờ {elapsed} phút tại trạm '{x.Station?.Name ?? "Bếp"}', cần ưu tiên chế biến!"
            };
        }).ToList();
    }

    public async Task<KitchenItemsResponseDto> GetKitchenItemsAsync(
        string tab = "unfinished",
        int? tableId = null,
        string? search = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;

        // Mặc định lọc lịch sử Hoàn thành / Hủy theo Ngày hôm nay (múi giờ Việt Nam UTC+7) để tránh tải hàng ngàn bản ghi cũ
        var vnTodayStartUtc = now.AddHours(7).Date.AddHours(-7);
        var effectiveFrom = fromDate ?? vnTodayStartUtc;
        var effectiveTo = toDate ?? (fromDate.HasValue ? fromDate.Value.AddDays(1) : vnTodayStartUtc.AddDays(1));

        var unfinishedItems = await _context.KitchenTicketItems
            .AsNoTracking()
            .Include(i => i.Ticket)
            .Where(i => i.Status == KitchenItemStatus.Pending || i.Status == KitchenItemStatus.Cooking)
            .OrderBy(i => i.Id)
            .ToListAsync(ct);

        var historyItems = await _context.KitchenTicketItems
            .AsNoTracking()
            .Include(i => i.Ticket)
            .Where(i => (i.Status == KitchenItemStatus.Ready
                      || i.Status == KitchenItemStatus.Served
                      || i.Status == KitchenItemStatus.Cancelled)
                     && ((i.ReadyTime ?? i.ServedTime ?? i.Ticket!.CreatedAt) >= effectiveFrom)
                     && ((i.ReadyTime ?? i.ServedTime ?? i.Ticket!.CreatedAt) < effectiveTo))
            .OrderByDescending(i => i.Id)
            .Take(500)
            .ToListAsync(ct);

        // Helper to count distinct card groups for a given list and status filter
        static int CountGrouped(IEnumerable<KitchenTicketItem> source, Func<KitchenTicketItem, bool> predicate)
        {
            return source
                .Where(predicate)
                .GroupBy(x => new
                {
                    OrderId = x.Ticket?.OrderId ?? 0,
                    TableName = (x.Ticket?.TableName ?? string.Empty).Trim().ToUpperInvariant(),
                    DishName = (x.MenuItemName ?? string.Empty).Trim().ToUpperInvariant(),
                    Modifiers = (x.ModifiersSummary ?? string.Empty).Trim().ToUpperInvariant(),
                    Status = x.Status
                })
                .Count();
        }

        int unfinishedCount = CountGrouped(unfinishedItems, x => x.Status == KitchenItemStatus.Pending || x.Status == KitchenItemStatus.Cooking);
        int completedCount = CountGrouped(historyItems, x => x.Status == KitchenItemStatus.Ready || x.Status == KitchenItemStatus.Served);
        int cancelledCount = CountGrouped(historyItems, x => x.Status == KitchenItemStatus.Cancelled);
        int overdueCount = CountGrouped(unfinishedItems, x => (x.Status == KitchenItemStatus.Pending || x.Status == KitchenItemStatus.Cooking)
                                                              && (now - (x.Ticket?.CreatedAt ?? now)).TotalMinutes >= 15.0);

        var counts = new KitchenTabCountsDto
        {
            Unfinished = unfinishedCount,
            Completed = completedCount,
            Cancelled = cancelledCount,
            Overdue = overdueCount
        };

        var normalizedTab = (tab ?? "unfinished").Trim().ToLowerInvariant();
        IEnumerable<KitchenTicketItem> filtered;

        if (normalizedTab == "completed")
        {
            filtered = historyItems.Where(x => x.Status == KitchenItemStatus.Ready || x.Status == KitchenItemStatus.Served);
        }
        else if (normalizedTab == "cancelled")
        {
            filtered = historyItems.Where(x => x.Status == KitchenItemStatus.Cancelled);
        }
        else // unfinished
        {
            filtered = unfinishedItems;
        }

        if (tableId.HasValue && tableId.Value > 0)
        {
            var tableNumStr = tableId.Value.ToString();
            filtered = filtered.Where(x => x.Ticket != null && x.Ticket.TableName.Contains(tableNumStr));
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var searchLower = search.Trim().ToLower();
            filtered = filtered.Where(x => x.MenuItemName.ToLower().Contains(searchLower)
                                        || (x.Ticket != null && x.Ticket.TableName.ToLower().Contains(searchLower)));
        }

        var filteredList = filtered.ToList();

        var orderIds = filteredList.Select(x => x.Ticket?.OrderId ?? 0).Distinct().Where(id => id > 0).ToList();
        var orders = orderIds.Count > 0
            ? await _context.Orders
                .AsNoTracking()
                .Where(o => orderIds.Contains(o.Id))
                .ToDictionaryAsync(o => o.Id, ct)
            : new Dictionary<int, Domain.Entities.Menu.Order>();

        var orderItemIds = filteredList.Select(x => x.OrderItemId).Distinct().Where(id => id > 0).ToList();
        var orderItemMap = orderItemIds.Count > 0
            ? await _context.OrderItems
                .AsNoTracking()
                .Where(oi => orderItemIds.Contains(oi.Id))
                .ToDictionaryAsync(oi => oi.Id, ct)
            : new Dictionary<int, Domain.Entities.Menu.OrderItem>();

        var cards = filteredList
            .OrderBy(x => x.Ticket?.CreatedAt ?? now) // FIFO
            .Select(x =>
            {
                var createdAt = x.Ticket?.CreatedAt ?? now;
                var completedAt = x.ReadyTime ?? x.ServedTime;
                var elapsed = Math.Round((now - createdAt).TotalMinutes, 1);
                var isOverdue = (x.Status == KitchenItemStatus.Pending || x.Status == KitchenItemStatus.Cooking) && elapsed >= 15.0;

                string orderNumber = $"ORD-{x.Ticket?.OrderId ?? 0}";
                int? actualTableId = null;
                if (x.Ticket != null && orders.TryGetValue(x.Ticket.OrderId, out var ord))
                {
                    orderNumber = ord.OrderNumber;
                    actualTableId = ord.TableId;
                }

                string? dishNotes = null;
                if (orderItemMap.TryGetValue(x.OrderItemId, out var oi) && !string.IsNullOrWhiteSpace(oi.SpecialInstructions))
                {
                    dishNotes = oi.SpecialInstructions.Trim();
                }
                else if (!string.IsNullOrWhiteSpace(x.Ticket?.Notes))
                {
                    dishNotes = x.Ticket.Notes.Trim();
                }

                return new KitchenItemCardDto
                {
                    TicketItemId = x.Id,
                    TicketId = x.TicketId,
                    OrderId = x.Ticket?.OrderId ?? 0,
                    OrderNumber = orderNumber,
                    TableId = actualTableId,
                    TableName = x.Ticket?.TableName ?? "BÀN",
                    MenuItemId = x.OrderItemId,
                    DishName = x.MenuItemName,
                    Quantity = x.Quantity,
                    ModifiersSummary = x.ModifiersSummary,
                    SpecialInstructions = dishNotes,
                    Status = x.Status.ToString(),
                    CreatedAt = createdAt,
                    CompletedAt = completedAt,
                    CompletedTimeDisplay = completedAt.HasValue ? completedAt.Value.ToLocalTime().ToString("HH:mm") : null,
                    ElapsedMinutes = elapsed,
                    IsOverdue = isOverdue,
                    CancellationReason = x.CancellationReason,
                    PrintCount = 1,
                    LastPrintedAt = createdAt
                };
            })
            .ToList();

        // Gộp các món giống nhau của cùng một bàn/đơn hàng thành 1 thẻ với số lượng tổng (x2, x3, ...)
        var groupedCards = cards
            .GroupBy(c => new
            {
                c.OrderId,
                TableName = (c.TableName ?? string.Empty).Trim().ToUpperInvariant(),
                DishName = (c.DishName ?? string.Empty).Trim().ToUpperInvariant(),
                Modifiers = (c.ModifiersSummary ?? string.Empty).Trim().ToUpperInvariant(),
                Instructions = (c.SpecialInstructions ?? string.Empty).Trim().ToUpperInvariant(),
                Status = c.Status,
                c.IsOverdue
            })
            .Select(g =>
            {
                var first = g.OrderBy(x => x.CreatedAt).First();
                return new KitchenItemCardDto
                {
                    TicketItemId = first.TicketItemId,
                    TicketId = first.TicketId,
                    OrderId = first.OrderId,
                    OrderNumber = first.OrderNumber,
                    TableId = first.TableId,
                    TableName = first.TableName,
                    MenuItemId = first.MenuItemId,
                    DishName = first.DishName,
                    Quantity = g.Sum(x => x.Quantity),
                    ModifiersSummary = first.ModifiersSummary,
                    SpecialInstructions = first.SpecialInstructions,
                    Status = first.Status,
                    CreatedAt = first.CreatedAt,
                    CompletedAt = g.Max(x => x.CompletedAt),
                    CompletedTimeDisplay = first.CompletedTimeDisplay,
                    ElapsedMinutes = g.Max(x => x.ElapsedMinutes),
                    IsOverdue = g.Any(x => x.IsOverdue),
                    CancellationReason = first.CancellationReason,
                    PrintCount = first.PrintCount,
                    LastPrintedAt = first.LastPrintedAt
                };
            });

        var sortedCards = (normalizedTab == "completed" || normalizedTab == "cancelled")
            ? groupedCards.OrderByDescending(x => x.CompletedAt ?? x.CreatedAt).ToList()
            : groupedCards.OrderBy(x => x.CreatedAt).ToList();

        return new KitchenItemsResponseDto
        {
            Counts = counts,
            Items = sortedCards
        };
    }
}
