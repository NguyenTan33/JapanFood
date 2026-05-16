using Domain.Entities.TableManagement;
using Domain.Exceptions;

namespace Domain.UnitTests.TableManagement;

public class TableTests
{
    #region TableArea Tests

    [Fact]
    public void TableArea_WithValidData_ShouldCreateArea()
    {
        var area = new TableArea("YATAI", "Quầy Bar Yatai", "Khu vực ngồi quầy bar ngắm đầu bếp nấu ramen", 1);

        Assert.Equal("YATAI", area.AreaCode);
        Assert.Equal("Quầy Bar Yatai", area.AreaName);
        Assert.Equal("Khu vực ngồi quầy bar ngắm đầu bếp nấu ramen", area.Description);
        Assert.Equal(1, area.DisplayOrder);
        Assert.True(area.IsActive);
        Assert.Empty(area.Tables);
    }

    [Theory]
    [InlineData("", "Tầng 1")]
    [InlineData("   ", "Tầng 1")]
    [InlineData(null, "Tầng 1")]
    public void TableArea_WithEmptyAreaCode_ShouldThrowBusinessException(string? code, string name)
    {
        var ex = Assert.Throws<BusinessException>(() => new TableArea(code!, name));
        Assert.Contains("Mã khu vực không được để trống", ex.Message);
    }

    [Theory]
    [InlineData("FLOOR1", "")]
    [InlineData("FLOOR1", "   ")]
    [InlineData("FLOOR1", null)]
    public void TableArea_WithEmptyAreaName_ShouldThrowBusinessException(string code, string? name)
    {
        var ex = Assert.Throws<BusinessException>(() => new TableArea(code, name!));
        Assert.Contains("Tên khu vực không được để trống", ex.Message);
    }

    [Fact]
    public void TableArea_AddTable_ShouldAddAndEnforceUniqueTableNumber()
    {
        var area = new TableArea("VIP", "VIP Tatami", "Phòng VIP phong cách chiếu Tatami", 4);
        var table1 = new Table(1, "VIP-01", 6, 2);
        var table2 = new Table(1, "VIP-02", 8, 4);

        area.AddTable(table1);
        area.AddTable(table2);

        Assert.Equal(2, area.Tables.Count);

        // Duplicate table number in same area
        var duplicateTable = new Table(1, "vip-01", 4, 1);
        var ex = Assert.Throws<BusinessException>(() => area.AddTable(duplicateTable));
        Assert.Contains("đã tồn tại trong khu vực", ex.Message);
    }

    [Fact]
    public void TableArea_ActivateAndDeactivate_ShouldToggleStatus()
    {
        var area = new TableArea("FLOOR2", "Tầng 2", "Khu vực tầng 2 thoáng đãng", 3);
        Assert.True(area.IsActive);

        area.Deactivate();
        Assert.False(area.IsActive);

        area.Activate();
        Assert.True(area.IsActive);
    }

    #endregion

    #region Table Constructor & Validation Tests

    [Fact]
    public void Table_WithValidParameters_ShouldCreateEmptyActiveTable()
    {
        var table = new Table(areaId: 1, tableNumber: "T-01", capacity: 4, minCapacity: 2);

        Assert.Equal(1, table.AreaId);
        Assert.Equal("T-01", table.TableNumber);
        Assert.Equal(4, table.Capacity);
        Assert.Equal(2, table.MinCapacity);
        Assert.Equal(TableStatus.Empty, table.Status);
        Assert.True(table.IsActive);
        Assert.Null(table.CurrentOrderId);
        Assert.Null(table.MergedIntoTableId);
        Assert.Empty(table.MergedChildren);
    }

    [Theory]
    [InlineData("", 4, 1)]
    [InlineData("   ", 4, 1)]
    [InlineData(null, 4, 1)]
    public void Table_WithEmptyNumber_ShouldThrowBusinessException(string? number, int cap, int minCap)
    {
        var ex = Assert.Throws<BusinessException>(() => new Table(1, number!, cap, minCap));
        Assert.Contains("Số bàn không được để trống", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Table_WithZeroOrNegativeCapacity_ShouldThrowBusinessException(int cap)
    {
        var ex = Assert.Throws<BusinessException>(() => new Table(1, "T-01", cap));
        Assert.Contains("Sức chứa của bàn phải lớn hơn 0", ex.Message);
    }

    [Theory]
    [InlineData(4, 0)]
    [InlineData(4, -1)]
    [InlineData(4, 5)] // minCapacity > capacity
    public void Table_WithInvalidMinCapacity_ShouldThrowBusinessException(int cap, int minCap)
    {
        var ex = Assert.Throws<BusinessException>(() => new Table(1, "T-01", cap, minCap));
        Assert.Contains("Sức chứa tối thiểu không hợp lệ", ex.Message);
    }

    #endregion

    #region Table Lifecycle State Machine Tests

    [Fact]
    public void Table_Lifecycle_Empty_To_Serving_To_Cleaning_To_Empty()
    {
        var table = new Table(1, "T-01", 4);
        Assert.Equal(TableStatus.Empty, table.Status);

        // Empty -> Serving
        table.Occupy(orderId: 1001, guestCount: 4);
        Assert.Equal(TableStatus.Serving, table.Status);
        Assert.Equal(1001, table.CurrentOrderId);

        // Serving -> Cleaning
        table.ReleaseToCleaning();
        Assert.Equal(TableStatus.Cleaning, table.Status);
        Assert.Null(table.CurrentOrderId);

        // Cleaning -> Empty
        table.CompleteCleaning();
        Assert.Equal(TableStatus.Empty, table.Status);
    }

    [Fact]
    public void Table_Reserve_And_CancelReservation_ShouldWork()
    {
        var table = new Table(1, "T-01", 4);

        table.Reserve();
        Assert.Equal(TableStatus.Reserved, table.Status);

        table.CancelReservation();
        Assert.Equal(TableStatus.Empty, table.Status);
    }

    [Fact]
    public void Occupy_WithCapacityPlusGraceAllowance_ShouldSucceed()
    {
        var table = new Table(1, "T-01", 4);

        // Capacity is 4, allowance is +2 -> guestCount up to 6 is allowed
        table.Occupy(orderId: 100, guestCount: 6);
        Assert.Equal(TableStatus.Serving, table.Status);
    }

    [Fact]
    public void Occupy_ExceedingCapacityPlusGraceAllowance_ShouldThrowBusinessException()
    {
        var table = new Table(1, "T-01", 4);

        // Capacity 4 + 2 = 6, 7 should throw
        var ex = Assert.Throws<BusinessException>(() => table.Occupy(orderId: 100, guestCount: 7));
        Assert.Contains("vượt quá sức chứa tối đa của bàn", ex.Message);
    }

    [Theory]
    [InlineData(0, 2)]
    [InlineData(-1, 2)]
    [InlineData(100, 0)]
    [InlineData(100, -2)]
    public void Occupy_WithInvalidOrderIdOrGuestCount_ShouldThrowBusinessException(int orderId, int guests)
    {
        var table = new Table(1, "T-01", 4);
        Assert.Throws<BusinessException>(() => table.Occupy(orderId, guests));
    }

    [Fact]
    public void Occupy_WhenAlreadyServingOrCleaning_ShouldThrowBusinessException()
    {
        var table = new Table(1, "T-01", 4);
        table.Occupy(100, 3);

        var exServing = Assert.Throws<BusinessException>(() => table.Occupy(101, 2));
        Assert.Contains("đang có khách phục vụ", exServing.Message);

        table.ReleaseToCleaning();
        var exCleaning = Assert.Throws<BusinessException>(() => table.Occupy(102, 2));
        Assert.Contains("đang chờ dọn dẹp vệ sinh", exCleaning.Message);
    }

    [Fact]
    public void ReleaseToCleaning_WhenNotServing_ShouldThrowBusinessException()
    {
        var table = new Table(1, "T-01", 4);
        var ex = Assert.Throws<BusinessException>(() => table.ReleaseToCleaning());
        Assert.Contains("Chỉ có thể giải phóng bàn đang phục vụ", ex.Message);
    }

    [Fact]
    public void CompleteCleaning_WhenNotCleaning_ShouldThrowBusinessException()
    {
        var table = new Table(1, "T-01", 4);
        var ex = Assert.Throws<BusinessException>(() => table.CompleteCleaning());
        Assert.Contains("không ở trạng thái Chờ dọn dẹp", ex.Message);
    }

    [Fact]
    public void Reserve_WhenNotCleanOrNotAvailable_ShouldThrowBusinessException()
    {
        var table = new Table(1, "T-01", 4);
        table.Occupy(100, 2);

        var ex = Assert.Throws<BusinessException>(() => table.Reserve());
        Assert.Contains("Chỉ có thể đặt trước bàn trống", ex.Message);
    }

    #endregion

    #region Table Merge & Split Tests

    [Fact]
    public void MergeTable_WhenMasterAndSecondaryEmpty_ShouldPreMergeTables()
    {
        var master = new Table(1, "T-01", 4);
        var secondary = new Table(1, "T-02", 4);

        master.MergeTable(secondary);

        Assert.Single(master.MergedChildren);
        Assert.Contains(secondary, master.MergedChildren);
        Assert.Equal(master, secondary.MergedIntoTable);
        Assert.Equal(TableStatus.Empty, secondary.Status);
        Assert.Equal(8, master.GetTotalEffectiveCapacity());
    }

    [Fact]
    public void MergeTable_WhenMasterServing_SecondaryShouldJoinServingSession()
    {
        var master = new Table(1, "T-01", 4);
        var secondary = new Table(1, "T-02", 2);

        master.Occupy(orderId: 501, guestCount: 4);
        master.MergeTable(secondary);

        Assert.Equal(TableStatus.Serving, secondary.Status);
        Assert.Equal(501, secondary.CurrentOrderId);
        Assert.Single(master.MergedChildren);
        Assert.Equal(6, master.GetTotalEffectiveCapacity());
    }

    [Fact]
    public void MergeTable_CannotMergeTableIntoItself()
    {
        var table = new Table(1, "T-01", 4);
        var ex = Assert.Throws<BusinessException>(() => table.MergeTable(table));
        Assert.Contains("Không thể gộp một bàn vào chính nó", ex.Message);
    }

    [Fact]
    public void MergeTable_WhenEitherTableInCleaning_ShouldThrowBusinessException()
    {
        var master = new Table(1, "T-01", 4);
        var secondary = new Table(1, "T-02", 4);

        master.Occupy(1, 2);
        master.ReleaseToCleaning();

        var ex = Assert.Throws<BusinessException>(() => master.MergeTable(secondary));
        Assert.Contains("Không thể gộp bàn khi có bàn đang chờ dọn dẹp vệ sinh", ex.Message);
    }

    [Fact]
    public void MergeTable_WhenSecondaryAlreadyMerged_ShouldThrowBusinessException()
    {
        var master1 = new Table(1, "T-01", 4);
        var master2 = new Table(1, "T-02", 4);
        var child = new Table(1, "T-03", 2);

        master1.MergeTable(child);

        var ex = Assert.Throws<BusinessException>(() => master2.MergeTable(child));
        Assert.Contains("đã được gộp vào một bàn khác", ex.Message);
    }

    [Fact]
    public void MergeTable_WhenMasterIsChildOfAnother_ShouldThrowBusinessException()
    {
        var root = new Table(1, "T-01", 4);
        var mid = new Table(1, "T-02", 4);
        var leaf = new Table(1, "T-03", 2);

        root.MergeTable(mid);

        var ex = Assert.Throws<BusinessException>(() => mid.MergeTable(leaf));
        Assert.Contains("đang được gộp vào bàn khác. Không thể làm bàn chính", ex.Message);
    }

    [Fact]
    public void UnmergeTable_WhenServing_SecondaryShouldTransitionToCleaning()
    {
        var master = new Table(1, "T-01", 4);
        var secondary = new Table(1, "T-02", 2);

        master.Occupy(orderId: 501, guestCount: 4);
        master.MergeTable(secondary);

        master.UnmergeTable(secondary);

        Assert.Empty(master.MergedChildren);
        Assert.Null(secondary.MergedIntoTableId);
        Assert.Null(secondary.MergedIntoTable);
        Assert.Null(secondary.CurrentOrderId);
        Assert.Equal(TableStatus.Cleaning, secondary.Status);
    }

    [Fact]
    public void UnmergeTable_WhenBothEmpty_SecondaryShouldTransitionToEmpty()
    {
        var master = new Table(1, "T-01", 4);
        var secondary = new Table(1, "T-02", 2);

        master.MergeTable(secondary);
        master.UnmergeTable(secondary);

        Assert.Equal(TableStatus.Empty, secondary.Status);
        Assert.Null(secondary.MergedIntoTableId);
    }

    [Fact]
    public void UnmergeTable_WhenSecondaryNotChild_ShouldThrowBusinessException()
    {
        var master = new Table(1, "T-01", 4);
        var unrelated = new Table(1, "T-99", 2);

        var ex = Assert.Throws<BusinessException>(() => master.UnmergeTable(unrelated));
        Assert.Contains("không thuộc danh sách bàn gộp", ex.Message);
    }

    [Fact]
    public void ReleaseToCleaning_WithMergedChildren_ShouldUnmergeAllAndMarkThemCleaning()
    {
        var master = new Table(1, "T-01", 4);
        var child1 = new Table(1, "T-02", 2);
        var child2 = new Table(1, "T-03", 2);

        master.Occupy(orderId: 888, guestCount: 6);
        master.MergeTable(child1);
        master.MergeTable(child2);

        master.ReleaseToCleaning();

        Assert.Equal(TableStatus.Cleaning, master.Status);
        Assert.Empty(master.MergedChildren);
        Assert.Equal(TableStatus.Cleaning, child1.Status);
        Assert.Null(child1.CurrentOrderId);
        Assert.Equal(TableStatus.Cleaning, child2.Status);
        Assert.Null(child2.CurrentOrderId);
    }

    #endregion

    #region Table Transfer Tests

    [Fact]
    public void TransferTo_ValidTransfer_ShouldMoveOrderAndSetSourceToCleaning()
    {
        var source = new Table(1, "T-01", 4);
        var target = new Table(1, "T-02", 4);

        source.Occupy(orderId: 999, guestCount: 3);

        source.TransferTo(target);

        // Target becomes serving with order
        Assert.Equal(TableStatus.Serving, target.Status);
        Assert.Equal(999, target.CurrentOrderId);

        // Source becomes cleaning without order
        Assert.Equal(TableStatus.Cleaning, source.Status);
        Assert.Null(source.CurrentOrderId);
    }

    [Fact]
    public void TransferTo_WithMergedChildren_ShouldUnmergeAndCleanChildren()
    {
        var source = new Table(1, "T-01", 4);
        var child = new Table(1, "T-02", 2);
        var target = new Table(1, "VIP-01", 8);

        source.Occupy(orderId: 777, guestCount: 5);
        source.MergeTable(child);

        source.TransferTo(target);

        Assert.Equal(TableStatus.Serving, target.Status);
        Assert.Equal(777, target.CurrentOrderId);
        Assert.Equal(TableStatus.Cleaning, source.Status);
        Assert.Empty(source.MergedChildren);
        Assert.Equal(TableStatus.Cleaning, child.Status);
        Assert.Null(child.MergedIntoTableId);
    }

    [Fact]
    public void TransferTo_WhenSourceNotServing_ShouldThrowBusinessException()
    {
        var source = new Table(1, "T-01", 4);
        var target = new Table(1, "T-02", 4);

        var ex = Assert.Throws<BusinessException>(() => source.TransferTo(target));
        Assert.Contains("không có đơn hàng đang phục vụ để chuyển", ex.Message);
    }

    [Fact]
    public void TransferTo_WhenTargetNotOccupiedOrCleaning_ShouldThrowBusinessException()
    {
        var source = new Table(1, "T-01", 4);
        var targetServing = new Table(1, "T-02", 4);

        source.Occupy(10, 2);
        targetServing.Occupy(11, 2);

        var ex = Assert.Throws<BusinessException>(() => source.TransferTo(targetServing));
        Assert.Contains("không trống", ex.Message);
    }

    [Fact]
    public void TransferTo_CannotTransferToSelf()
    {
        var table = new Table(1, "T-01", 4);
        table.Occupy(10, 2);

        var ex = Assert.Throws<BusinessException>(() => table.TransferTo(table));
        Assert.Contains("Không thể chuyển bàn sang chính nó", ex.Message);
    }

    #endregion

    #region Admin Update / Activate / Deactivate Tests

    [Fact]
    public void UpdateDetails_ValidInputs_ShouldUpdateTableFields()
    {
        var table = new Table(1, "t-01", 4, 1);
        table.UpdateDetails(2, " vip-02 ", 8, 2);

        Assert.Equal(2, table.AreaId);
        Assert.Equal("VIP-02", table.TableNumber);
        Assert.Equal(8, table.Capacity);
        Assert.Equal(2, table.MinCapacity);
    }

    [Fact]
    public void UpdateDetails_MovingAreaWhileServing_ShouldThrowBusinessException()
    {
        var table = new Table(1, "T-01", 4, 1);
        table.Occupy(orderId: 50, guestCount: 2);

        var ex = Assert.Throws<BusinessException>(() => table.UpdateDetails(2, "T-01", 4, 1));
        Assert.Contains("đang có khách phục vụ", ex.Message);
    }

    [Fact]
    public void Deactivate_And_Activate_ShouldToggleIsActiveUnlessServingOrMerged()
    {
        var table = new Table(1, "T-01", 4, 1);
        table.Deactivate();
        Assert.False(table.IsActive);

        table.Activate();
        Assert.True(table.IsActive);

        table.Occupy(100, 2);
        var ex = Assert.Throws<BusinessException>(() => table.Deactivate());
        Assert.Contains("đang phục vụ", ex.Message);
    }

    #endregion
}
