using APIAuth.Services.Common;
using Application.Services;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class KitchenServiceTests : TestApplicationBase
{
    private readonly KitchenService _service;

    public KitchenServiceTests()
    {
        _service = new KitchenService(
            UnitOfWork,
            KitchenQueryRepo,
            NullLogger<KitchenService>.Instance);
    }

    private async Task<(Order order, OrderItem orderItem, KitchenTicket ticket, KitchenTicketItem ticketItem)> SeedKitchenSetupAsync()
    {
        var station = await SeedKitchenStationAsync(KitchenStationType.NoodleStation, "Bếp Nấu Mì");
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-KITCHEN", "Kitchen Ramen", 120000m, KitchenStationType.NoodleStation);

        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        order.SendToKitchen();
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var orderItem = order.Items.First();

        var ticket = new KitchenTicket(order.Id, "TKT-TEST-01", "TAKEAWAY");
        var ticketItem = ticket.AddItem(orderItem.Id, station.Id, dish.Name, 1, null);
        Context.KitchenTickets.Add(ticket);
        await Context.SaveChangesAsync();

        return (order, orderItem, ticket, ticketItem);
    }

    [Fact]
    public async Task StartCookingItem_ValidItem_UpdatesTicketItemAndOrderItemStatus()
    {
        // Arrange
        var (_, orderItem, ticket, ticketItem) = await SeedKitchenSetupAsync();
        int cookUserId = 7;

        // Act
        var success = await _service.StartCookingItemAsync(ticketItem.Id, cookUserId);

        // Assert
        Assert.True(success);

        var updatedTicketItem = await Context.KitchenTicketItems.FirstOrDefaultAsync(i => i.Id == ticketItem.Id);
        Assert.NotNull(updatedTicketItem);
        Assert.Equal(KitchenItemStatus.Cooking, updatedTicketItem.Status);
        Assert.Equal(cookUserId, updatedTicketItem.CookUserId);

        var updatedOrderItem = await Context.OrderItems.FirstOrDefaultAsync(i => i.Id == orderItem.Id);
        Assert.NotNull(updatedOrderItem);
        Assert.Equal(OrderItemStatus.Cooking, updatedOrderItem.ItemStatus);

        var updatedTicket = await Context.KitchenTickets.FirstOrDefaultAsync(t => t.Id == ticket.Id);
        Assert.NotNull(updatedTicket);
        Assert.Equal(KitchenTicketStatus.Cooking, updatedTicket.Status);
    }

    [Fact]
    public async Task StartCookingItem_InvalidCookUserId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.StartCookingItemAsync(1, 0));
        Assert.Contains("Mã đầu bếp", ex.Message);
    }

    [Fact]
    public async Task StartCookingItem_ItemNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.StartCookingItemAsync(99999, 1));
    }

    [Fact]
    public async Task MarkItemReady_ValidItem_UpdatesTicketItemAndOrderItemStatus()
    {
        // Arrange
        var (_, orderItem, ticket, ticketItem) = await SeedKitchenSetupAsync();
        int cookUserId = 7;
        await _service.StartCookingItemAsync(ticketItem.Id, cookUserId);

        // Act
        var success = await _service.MarkItemReadyAsync(ticketItem.Id, cookUserId);

        // Assert
        Assert.True(success);

        var updatedTicketItem = await Context.KitchenTicketItems.FirstOrDefaultAsync(i => i.Id == ticketItem.Id);
        Assert.NotNull(updatedTicketItem);
        Assert.Equal(KitchenItemStatus.Ready, updatedTicketItem.Status);

        var updatedOrderItem = await Context.OrderItems.FirstOrDefaultAsync(i => i.Id == orderItem.Id);
        Assert.NotNull(updatedOrderItem);
        Assert.Equal(OrderItemStatus.Ready, updatedOrderItem.ItemStatus);

        var updatedTicket = await Context.KitchenTickets.FirstOrDefaultAsync(t => t.Id == ticket.Id);
        Assert.NotNull(updatedTicket);
        Assert.Equal(KitchenTicketStatus.Ready, updatedTicket.Status);
    }

    [Fact]
    public async Task MarkItemReady_InvalidCookUserId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.MarkItemReadyAsync(1, -1));
        Assert.Contains("Mã đầu bếp", ex.Message);
    }

    [Fact]
    public async Task MarkItemReady_ItemNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.MarkItemReadyAsync(99999, 1));
    }

    [Fact]
    public async Task MarkItemServed_ValidItem_UpdatesTicketItemAndOrderItemStatus()
    {
        // Arrange
        var (_, orderItem, ticket, ticketItem) = await SeedKitchenSetupAsync();
        int cookUserId = 7;
        int staffUserId = 12;
        await _service.StartCookingItemAsync(ticketItem.Id, cookUserId);
        await _service.MarkItemReadyAsync(ticketItem.Id, cookUserId);

        // Act
        var success = await _service.MarkItemServedAsync(ticketItem.Id, staffUserId);

        // Assert
        Assert.True(success);

        var updatedTicketItem = await Context.KitchenTicketItems.FirstOrDefaultAsync(i => i.Id == ticketItem.Id);
        Assert.NotNull(updatedTicketItem);
        Assert.Equal(KitchenItemStatus.Served, updatedTicketItem.Status);

        var updatedOrderItem = await Context.OrderItems.FirstOrDefaultAsync(i => i.Id == orderItem.Id);
        Assert.NotNull(updatedOrderItem);
        Assert.Equal(OrderItemStatus.Served, updatedOrderItem.ItemStatus);

        var updatedTicket = await Context.KitchenTickets.FirstOrDefaultAsync(t => t.Id == ticket.Id);
        Assert.NotNull(updatedTicket);
        Assert.Equal(KitchenTicketStatus.Served, updatedTicket.Status);
    }

    [Fact]
    public async Task MarkItemServed_InvalidStaffUserId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.MarkItemServedAsync(1, 0));
        Assert.Contains("Mã nhân viên", ex.Message);
    }

    [Fact]
    public async Task MarkItemServed_ItemNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.MarkItemServedAsync(99999, 1));
    }
}
