using Application.DTOs.Kds;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.Ordering;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class KitchenService : IKitchenService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IKitchenQueryRepository _kitchenQueryRepo;
    private readonly ILogger<KitchenService> _logger;

    public KitchenService(
        IUnitOfWork unitOfWork,
        IKitchenQueryRepository kitchenQueryRepo,
        ILogger<KitchenService> logger)
    {
        _unitOfWork = unitOfWork;
        _kitchenQueryRepo = kitchenQueryRepo;
        _logger = logger;
    }

    public async Task<bool> StartCookingItemAsync(int ticketItemId, int cookUserId, CancellationToken ct = default)
    {
        if (cookUserId <= 0)
            throw new BusinessException("Mã đầu bếp không hợp lệ.");

        var item = await _unitOfWork.Context.KitchenTicketItems
            .Include(k => k.Ticket)
                .ThenInclude(t => t!.Items)
            .FirstOrDefaultAsync(i => i.Id == ticketItemId, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy món trong phiếu bếp #{ticketItemId}.");

        item.StartCooking(cookUserId);
        item.Ticket?.SyncStatusFromItems();

        // Synchronize corresponding OrderItem
        var orderItem = await _unitOfWork.Context.OrderItems
            .FirstOrDefaultAsync(oi => oi.Id == item.OrderItemId, ct);
        if (orderItem != null && orderItem.ItemStatus == OrderItemStatus.SentToKitchen)
        {
            orderItem.MarkCooking();
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> MarkItemReadyAsync(int ticketItemId, int cookUserId, CancellationToken ct = default)
    {
        if (cookUserId <= 0)
            throw new BusinessException("Mã đầu bếp không hợp lệ.");

        var item = await _unitOfWork.Context.KitchenTicketItems
            .Include(k => k.Ticket)
                .ThenInclude(t => t!.Items)
            .FirstOrDefaultAsync(i => i.Id == ticketItemId, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy món trong phiếu bếp #{ticketItemId}.");

        item.MarkReady();
        item.Ticket?.SyncStatusFromItems();

        // Synchronize corresponding OrderItem
        var orderItem = await _unitOfWork.Context.OrderItems
            .FirstOrDefaultAsync(oi => oi.Id == item.OrderItemId, ct);
        if (orderItem != null && (orderItem.ItemStatus == OrderItemStatus.Cooking || orderItem.ItemStatus == OrderItemStatus.SentToKitchen))
        {
            orderItem.MarkReady();

            // Check if all items in this order are now ready/served -> mark order ReadyForDispatch for online orders
            var order = await _unitOfWork.Context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == orderItem.OrderId, ct);

            if (order != null && (order.OrderType == OrderType.Takeaway || order.OrderType == OrderType.Delivery))
            {
                var remaining = order.Items.Where(i => i.ItemStatus != OrderItemStatus.Ready && i.ItemStatus != OrderItemStatus.Served && i.ItemStatus != OrderItemStatus.Cancelled).ToList();
                if (!remaining.Any())
                {
                    order.MarkReadyForDispatch();
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> MarkItemServedAsync(int ticketItemId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên phục vụ không hợp lệ.");

        var item = await _unitOfWork.Context.KitchenTicketItems
            .Include(k => k.Ticket)
                .ThenInclude(t => t!.Items)
            .FirstOrDefaultAsync(i => i.Id == ticketItemId, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy món trong phiếu bếp #{ticketItemId}.");

        item.MarkServed();
        item.Ticket?.SyncStatusFromItems();

        // Synchronize corresponding OrderItem
        var orderItem = await _unitOfWork.Context.OrderItems
            .FirstOrDefaultAsync(oi => oi.Id == item.OrderItemId, ct);
        if (orderItem != null && (orderItem.ItemStatus == OrderItemStatus.Ready || orderItem.ItemStatus == OrderItemStatus.Cooking))
        {
            orderItem.MarkServed();
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<CompleteOrReprintResponseDto> CompleteKitchenItemAsync(int ticketItemId, int cookUserId, CancellationToken ct = default)
    {
        if (cookUserId <= 0) cookUserId = 1;

        var item = await _unitOfWork.Context.KitchenTicketItems
            .Include(k => k.Ticket)
                .ThenInclude(t => t!.Items)
            .FirstOrDefaultAsync(i => i.Id == ticketItemId, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy món trong phiếu bếp #{ticketItemId}.");

        var orderId = item.Ticket?.OrderId;
        var relatedItems = new List<KitchenTicketItem> { item };

        if (orderId.HasValue && orderId.Value > 0)
        {
            var duplicates = await _unitOfWork.Context.KitchenTicketItems
                .Include(k => k.Ticket)
                .Where(k => k.Id != item.Id &&
                            k.Ticket != null &&
                            k.Ticket.OrderId == orderId.Value &&
                            k.MenuItemName == item.MenuItemName &&
                            (k.Status == KitchenItemStatus.Pending || k.Status == KitchenItemStatus.Cooking))
                .ToListAsync(ct);

            relatedItems.AddRange(duplicates);
        }

        int totalGroupQuantity = 0;
        foreach (var it in relatedItems)
        {
            totalGroupQuantity += it.Quantity;
            if (it.Status == KitchenItemStatus.Pending)
            {
                it.StartCooking(cookUserId);
            }
            if (it.Status == KitchenItemStatus.Cooking)
            {
                it.MarkReady();
            }
            it.Ticket?.SyncStatusFromItems();

            var orderItem = await _unitOfWork.Context.OrderItems
                .FirstOrDefaultAsync(oi => oi.Id == it.OrderItemId, ct);
            if (orderItem != null && orderItem.ItemStatus != OrderItemStatus.Ready && orderItem.ItemStatus != OrderItemStatus.Served)
            {
                orderItem.MarkReady();
            }
        }

        if (orderId.HasValue && orderId.Value > 0)
        {
            var parentOrder = await _unitOfWork.Context.Orders
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == orderId.Value, ct);

            if (parentOrder != null && (parentOrder.OrderType == OrderType.Takeaway || parentOrder.OrderType == OrderType.Delivery))
            {
                var remaining = parentOrder.Items
                    .Where(i => i.ItemStatus != OrderItemStatus.Ready && i.ItemStatus != OrderItemStatus.Served && i.ItemStatus != OrderItemStatus.Cancelled)
                    .ToList();
                if (!remaining.Any() && parentOrder.Status != OrderStatus.Completed && parentOrder.Status != OrderStatus.Cancelled)
                {
                    parentOrder.MarkReadyForDispatch();
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        var now = DateTime.UtcNow;
        var createdAt = item.Ticket?.CreatedAt ?? now;
        var completedAt = item.ReadyTime ?? now;
        var validOrderId = orderId ?? 0;
        var order = await _unitOfWork.Context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == validOrderId, ct);

        var card = new KitchenItemCardDto
        {
            TicketItemId = item.Id,
            TicketId = item.TicketId,
            OrderId = validOrderId,
            OrderNumber = order?.OrderNumber ?? $"ORD-{validOrderId}",
            TableId = order?.TableId,
            TableName = item.Ticket?.TableName ?? "BÀN",
            MenuItemId = item.OrderItemId,
            DishName = item.MenuItemName,
            Quantity = totalGroupQuantity > 0 ? totalGroupQuantity : item.Quantity,
            ModifiersSummary = item.ModifiersSummary,
            SpecialInstructions = item.Ticket?.Notes,
            Status = item.Status.ToString(),
            CreatedAt = createdAt,
            CompletedAt = completedAt,
            CompletedTimeDisplay = completedAt.ToLocalTime().ToString("HH:mm"),
            ElapsedMinutes = Math.Round((now - createdAt).TotalMinutes, 1),
            IsOverdue = false,
            PrintCount = 1,
            LastPrintedAt = now
        };

        var printTicket = new KdsPrintTicketDto
        {
            RestaurantName = "Sakura Japan Food",
            TableName = item.Ticket?.TableName ?? "BÀN",
            DishName = item.MenuItemName,
            Quantity = item.Quantity,
            ModifiersSummary = item.ModifiersSummary,
            SpecialInstructions = item.Ticket?.Notes,
            OrderedAtDisplay = createdAt.ToLocalTime().ToString("HH:mm"),
            CompletedAtDisplay = completedAt.ToLocalTime().ToString("HH:mm"),
            CopyNumber = 1
        };

        return new CompleteOrReprintResponseDto
        {
            Item = card,
            PrintTicket = printTicket
        };
    }

    public async Task<CompleteOrReprintResponseDto> ReprintKitchenItemAsync(int ticketItemId, CancellationToken ct = default)
    {
        var item = await _unitOfWork.Context.KitchenTicketItems
            .Include(k => k.Ticket)
            .FirstOrDefaultAsync(i => i.Id == ticketItemId, ct);

        if (item == null)
            throw new NotFoundException($"Không tìm thấy món trong phiếu bếp #{ticketItemId}.");

        var now = DateTime.UtcNow;
        var createdAt = item.Ticket?.CreatedAt ?? now;
        var completedAt = item.ReadyTime ?? item.ServedTime;
        var orderId = item.Ticket?.OrderId ?? 0;
        var order = await _unitOfWork.Context.Orders.AsNoTracking().FirstOrDefaultAsync(o => o.Id == orderId, ct);

        var card = new KitchenItemCardDto
        {
            TicketItemId = item.Id,
            TicketId = item.TicketId,
            OrderId = orderId,
            OrderNumber = order?.OrderNumber ?? $"ORD-{orderId}",
            TableId = order?.TableId,
            TableName = item.Ticket?.TableName ?? "BÀN",
            MenuItemId = item.OrderItemId,
            DishName = item.MenuItemName,
            Quantity = item.Quantity,
            ModifiersSummary = item.ModifiersSummary,
            SpecialInstructions = item.Ticket?.Notes,
            Status = item.Status.ToString(),
            CreatedAt = createdAt,
            CompletedAt = completedAt,
            CompletedTimeDisplay = completedAt?.ToLocalTime().ToString("HH:mm"),
            ElapsedMinutes = Math.Round((now - createdAt).TotalMinutes, 1),
            IsOverdue = false,
            PrintCount = 2,
            LastPrintedAt = now
        };

        var printTicket = new KdsPrintTicketDto
        {
            RestaurantName = "Sakura Japan Food",
            TableName = item.Ticket?.TableName ?? "BÀN",
            DishName = item.MenuItemName,
            Quantity = item.Quantity,
            ModifiersSummary = item.ModifiersSummary,
            SpecialInstructions = item.Ticket?.Notes,
            OrderedAtDisplay = createdAt.ToLocalTime().ToString("HH:mm"),
            CompletedAtDisplay = completedAt.HasValue ? completedAt.Value.ToLocalTime().ToString("HH:mm") : now.ToLocalTime().ToString("HH:mm"),
            CopyNumber = 2
        };

        return new CompleteOrReprintResponseDto
        {
            Item = card,
            PrintTicket = printTicket
        };
    }
}
