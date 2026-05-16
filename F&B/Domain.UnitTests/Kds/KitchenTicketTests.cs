using Domain.Entities.Kds;
using Domain.Exceptions;

namespace Domain.UnitTests.Kds;

public class KitchenTicketTests
{
    #region KitchenStation Tests

    [Fact]
    public void KitchenStation_WithValidData_ShouldCreateStation()
    {
        var station = new KitchenStation("Trạm Mì Ramen", KitchenStationType.NoodleStation, "Nấu mì và chan nước dùng", 1);

        Assert.Equal("Trạm Mì Ramen", station.Name);
        Assert.Equal(KitchenStationType.NoodleStation, station.StationType);
        Assert.Equal("Nấu mì và chan nước dùng", station.Description);
        Assert.Equal(1, station.DisplayOrder);
        Assert.True(station.IsActive);
        Assert.Empty(station.TicketItems);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void KitchenStation_WithEmptyName_ShouldThrowBusinessException(string? name)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new KitchenStation(name!, KitchenStationType.FryGrillStation));
        Assert.Contains("Tên trạm bếp không được để trống", ex.Message);
    }

    [Fact]
    public void KitchenStation_ActivateAndDeactivate_ShouldToggleState()
    {
        var station = new KitchenStation("Trạm Pha Chế", KitchenStationType.BeverageStation);
        Assert.True(station.IsActive);

        station.Deactivate();
        Assert.False(station.IsActive);

        station.Activate();
        Assert.True(station.IsActive);
    }

    #endregion

    #region KitchenTicket Constructor & Invariants

    [Fact]
    public void KitchenTicket_WithValidData_ShouldInitializeCorrectly()
    {
        var ticket = new KitchenTicket(
            orderId: 101,
            ticketNumber: "KDS-001",
            tableName: "Bàn T-01",
            notes: "Khách ăn cay ít",
            isRush: true);

        Assert.Equal(101, ticket.OrderId);
        Assert.Equal("KDS-001", ticket.TicketNumber);
        Assert.Equal("Bàn T-01", ticket.TableName);
        Assert.Equal(KitchenTicketStatus.Pending, ticket.Status);
        Assert.True(ticket.IsRush);
        Assert.Equal("Khách ăn cay ít", ticket.Notes);
        Assert.Null(ticket.ReadyAt);
        Assert.Null(ticket.ServedAt);
        Assert.Empty(ticket.Items);
    }

    [Theory]
    [InlineData(0, "TICK-1", "Table 1")]
    [InlineData(-1, "TICK-1", "Table 1")]
    [InlineData(10, "", "Table 1")]
    [InlineData(10, "TICK-1", "")]
    public void KitchenTicket_WithInvalidParameters_ShouldThrowBusinessException(int orderId, string ticketNumber, string tableName)
    {
        Assert.Throws<BusinessException>(() => new KitchenTicket(orderId, ticketNumber, tableName));
    }

    [Fact]
    public void KitchenTicket_AddItem_WhenActive_ShouldAddItem()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(orderItemId: 5, stationId: 1, menuItemName: "Tonkotsu Ramen", quantity: 2, modifiersSummary: "Mì cứng, Nước đậm");

        Assert.Single(ticket.Items);
        Assert.Equal(5, item.OrderItemId);
        Assert.Equal(1, item.StationId);
        Assert.Equal("Tonkotsu Ramen", item.MenuItemName);
        Assert.Equal(2, item.Quantity);
        Assert.Equal("Mì cứng, Nước đậm", item.ModifiersSummary);
        Assert.Equal(KitchenItemStatus.Pending, item.Status);
    }

    #endregion

    #region KitchenTicketItem Sequential State Machine & Cook Assignment

    [Fact]
    public void KitchenTicketItem_SequentialTransition_Pending_To_Cooking_To_Ready_To_Served()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Shoyu Ramen", 1, null);

        // 1. Pending -> Cooking (with cookUserId)
        item.StartCooking(cookUserId: 42);
        Assert.Equal(KitchenItemStatus.Cooking, item.Status);
        Assert.Equal(42, item.CookUserId);
        Assert.NotNull(item.CookingStartTime);

        // 2. Cooking -> Ready
        item.MarkReady();
        Assert.Equal(KitchenItemStatus.Ready, item.Status);
        Assert.NotNull(item.ReadyTime);

        // 3. Ready -> Served
        item.MarkServed();
        Assert.Equal(KitchenItemStatus.Served, item.Status);
        Assert.NotNull(item.ServedTime);
    }

    [Fact]
    public void StartCooking_WhenNotPending_ShouldThrowBusinessException()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Shoyu Ramen", 1, null);
        item.StartCooking(42);

        // Already cooking, calling StartCooking again must throw
        var ex = Assert.Throws<BusinessException>(() => item.StartCooking(43));
        Assert.Contains("Không thể bắt đầu nấu món ở trạng thái 'Cooking'", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void StartCooking_WithInvalidCookUserId_ShouldThrowBusinessException(int cookId)
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Shoyu Ramen", 1, null);

        var ex = Assert.Throws<BusinessException>(() => item.StartCooking(cookId));
        Assert.Contains("Mã đầu bếp không hợp lệ", ex.Message);
    }

    [Fact]
    public void MarkReady_WhenNotCooking_ShouldThrowBusinessException()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Shoyu Ramen", 1, null);

        // Item is still Pending, skipping Cooking to Ready must throw
        var ex = Assert.Throws<BusinessException>(() => item.MarkReady());
        Assert.Contains("Món phải đang được nấu (Cooking)", ex.Message);
    }

    [Fact]
    public void MarkServed_WhenNotReady_ShouldThrowBusinessException()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Shoyu Ramen", 1, null);
        item.StartCooking(10);

        // Item is Cooking, skipping Ready to Served must throw
        var ex = Assert.Throws<BusinessException>(() => item.MarkServed());
        Assert.Contains("Món phải ở trạng thái Đã nấu xong (Ready)", ex.Message);
    }

    [Fact]
    public void Cancel_WhenServed_ShouldThrowBusinessException()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Shoyu Ramen", 1, null);
        item.StartCooking(10);
        item.MarkReady();
        item.MarkServed();

        var ex = Assert.Throws<BusinessException>(() => item.Cancel("Khách không ăn"));
        Assert.Contains("Không thể hủy món ăn đã phục vụ cho khách", ex.Message);
    }

    [Fact]
    public void Cancel_WithEmptyReason_ShouldThrowBusinessException()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Shoyu Ramen", 1, null);

        var ex = Assert.Throws<BusinessException>(() => item.Cancel("   "));
        Assert.Contains("Lý do hủy món là bắt buộc", ex.Message);
    }

    [Fact]
    public void ReassignStation_WhenPending_ShouldSucceed()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Gyoza", 1, null);

        item.ReassignStation(newStationId: 2);
        Assert.Equal(2, item.StationId);
    }

    [Fact]
    public void ReassignStation_WhenCookingOrReady_ShouldThrowBusinessException()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Gyoza", 1, null);
        item.StartCooking(5);

        var ex = Assert.Throws<BusinessException>(() => item.ReassignStation(3));
        Assert.Contains("Không thể đổi trạm bếp khi món đã ở trạng thái 'Cooking'", ex.Message);
    }

    #endregion

    #region KitchenTicket SyncStatus & Cancellation

    [Fact]
    public void SyncStatusFromItems_WhenAnyCooking_TicketStatusShouldBeCooking()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item1 = ticket.AddItem(1, 1, "Ramen", 1, null);
        var item2 = ticket.AddItem(2, 2, "Gyoza", 1, null);

        item1.StartCooking(1);
        ticket.SyncStatusFromItems();

        Assert.Equal(KitchenTicketStatus.Cooking, ticket.Status);
    }

    [Fact]
    public void SyncStatusFromItems_WhenAllItemsReadyOrServed_TicketStatusShouldBeReady()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item1 = ticket.AddItem(1, 1, "Ramen", 1, null);
        var item2 = ticket.AddItem(2, 2, "Gyoza", 1, null);

        item1.StartCooking(1);
        item1.MarkReady();

        item2.StartCooking(2);
        item2.MarkReady();

        ticket.SyncStatusFromItems();

        Assert.Equal(KitchenTicketStatus.Ready, ticket.Status);
        Assert.NotNull(ticket.ReadyAt);
    }

    [Fact]
    public void SyncStatusFromItems_WhenAllItemsServedOrCancelled_TicketStatusShouldBeServed()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item1 = ticket.AddItem(1, 1, "Ramen", 1, null);
        var item2 = ticket.AddItem(2, 2, "Gyoza", 1, null);

        item1.StartCooking(1);
        item1.MarkReady();
        item1.MarkServed();

        item2.Cancel("Hết nguyên liệu gyoza");

        ticket.SyncStatusFromItems();

        Assert.Equal(KitchenTicketStatus.Served, ticket.Status);
        Assert.NotNull(ticket.ServedAt);
    }

    [Fact]
    public void CancelTicket_WhenServed_ShouldThrowBusinessException()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item = ticket.AddItem(1, 1, "Ramen", 1, null);
        item.StartCooking(1);
        item.MarkReady();
        item.MarkServed();
        ticket.SyncStatusFromItems();

        var ex = Assert.Throws<BusinessException>(() => ticket.CancelTicket("Wrong order"));
        Assert.Contains("Không thể hủy phiếu bếp đã phục vụ hoàn tất", ex.Message);
    }

    [Fact]
    public void CancelTicket_WhenActive_ShouldCancelTicketAndPendingItems()
    {
        var ticket = new KitchenTicket(1, "T-101", "Bàn 01");
        var item1 = ticket.AddItem(1, 1, "Ramen", 1, null);
        var item2 = ticket.AddItem(2, 2, "Gyoza", 1, null);

        ticket.CancelTicket("Khách hủy bàn");

        Assert.Equal(KitchenTicketStatus.Cancelled, ticket.Status);
        Assert.Equal(KitchenItemStatus.Cancelled, item1.Status);
        Assert.Equal(KitchenItemStatus.Cancelled, item2.Status);
    }

    #endregion
}
