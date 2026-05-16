using Domain.Entities.Operations;
using Domain.Exceptions;

namespace Domain.UnitTests.Operations;

public class ShiftChecklistTests
{
    #region ShiftChecklist & ChecklistItem Creation Tests

    [Theory]
    [InlineData(ShiftType.MorningOpening, "Mở ca sáng")]
    [InlineData(ShiftType.ShiftHandover, "Giao ca")]
    [InlineData(ShiftType.KitchenClosing, "Đóng ca vệ sinh bếp")]
    [InlineData(ShiftType.FoodSafety, "An toàn thực phẩm")]
    [InlineData(ShiftType.CashRegisterClosing, "Chốt két thu ngân")]
    public void ShiftChecklist_WithAllShiftTypes_ShouldInitialize(ShiftType type, string title)
    {
        var checklist = new ShiftChecklist(type, title);

        Assert.Equal(type, checklist.ChecklistType);
        Assert.Equal(title, checklist.Title);
        Assert.True(checklist.IsActive);
        Assert.Empty(checklist.Items);
    }

    [Fact]
    public void ShiftChecklist_AddItem_ShouldAddItem()
    {
        var checklist = new ShiftChecklist(ShiftType.MorningOpening, "Mở ca sáng");
        var item = checklist.AddItem(
            section: "Bếp Nấu",
            description: "Kiểm tra nhiệt độ nước dùng Tonkotsu đạt tối thiểu 85°C",
            isMandatory: true,
            displayOrder: 1,
            expectedStandard: ">= 85°C");

        Assert.Single(checklist.Items);
        Assert.Equal("Bếp Nấu", item.Section);
        Assert.Equal("Kiểm tra nhiệt độ nước dùng Tonkotsu đạt tối thiểu 85°C", item.Description);
        Assert.True(item.IsMandatory);
        Assert.Equal(1, item.DisplayOrder);
        Assert.Equal(">= 85°C", item.ExpectedStandard);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void ShiftChecklist_WithEmptyTitle_ShouldThrowBusinessException(string? title)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new ShiftChecklist(ShiftType.MorningOpening, title!));
        Assert.Contains("Tiêu đề danh mục kiểm tra không được để trống", ex.Message);
    }

    [Fact]
    public void ShiftChecklist_ActivateAndDeactivate_ShouldToggleState()
    {
        var checklist = new ShiftChecklist(ShiftType.MorningOpening, "Mở ca sáng");
        Assert.True(checklist.IsActive);

        checklist.Deactivate();
        Assert.False(checklist.IsActive);

        checklist.Activate();
        Assert.True(checklist.IsActive);
    }

    [Theory]
    [InlineData("", "Mô tả")]
    [InlineData("Khu vực", "")]
    public void ChecklistItem_WithEmptySectionOrDescription_ShouldThrowBusinessException(string section, string desc)
    {
        Assert.Throws<BusinessException>(() =>
            new ChecklistItem(checklistId: 1, section: section, description: desc));
    }

    #endregion

    #region ChecklistExecution & Mandatory Items Validation Tests

    [Fact]
    public void ChecklistExecution_WithValidParameters_ShouldInitializeInProgress()
    {
        var execution = new ChecklistExecution(
            checklistId: 1,
            shiftDate: DateTime.UtcNow,
            shiftName: "Ca Sáng (06:00 - 14:00)",
            performerUserId: 10);

        Assert.Equal(1, execution.ChecklistId);
        Assert.Equal(DateTime.UtcNow.Date, execution.ShiftDate);
        Assert.Equal("Ca Sáng (06:00 - 14:00)", execution.ShiftName);
        Assert.Equal(10, execution.PerformerUserId);
        Assert.Equal(ChecklistStatus.InProgress, execution.Status);
        Assert.Empty(execution.Results);
    }

    [Theory]
    [InlineData(0, "Ca Sáng", 1)]
    [InlineData(1, "", 1)]
    [InlineData(1, "Ca Sáng", 0)]
    public void ChecklistExecution_WithInvalidParameters_ShouldThrowBusinessException(int checklistId, string shiftName, int performerId)
    {
        Assert.Throws<BusinessException>(() =>
            new ChecklistExecution(checklistId, DateTime.UtcNow, shiftName, performerId));
    }

    [Fact]
    public void Submit_WhenAllMandatoryItemsPassed_ShouldTransitionToCompleted()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);

        const int m1Id = 101;
        const int m2Id = 102;
        const int optId = 103;

        // Record results for both mandatory items (and optional item)
        execution.RecordItemResult(m1Id, isPassed: true, actualValue: "88°C");
        execution.RecordItemResult(m2Id, isPassed: true, actualValue: "-20°C / 3°C");
        execution.RecordItemResult(optId, isPassed: true, actualValue: "Đã bật đèn và bổ sung hũ gia vị");

        // Submit with performer signature
        var mandatoryIds = new[] { m1Id, m2Id };
        execution.Submit("Yamada Kenji", mandatoryIds);

        Assert.Equal(ChecklistStatus.Completed, execution.Status);
        Assert.Equal("Yamada Kenji", execution.PerformerSignature);
        Assert.Equal(3, execution.Results.Count);
    }

    [Fact]
    public void Submit_WhenMandatoryItemMissing_ShouldThrowBusinessException()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);

        const int m1Id = 101;
        const int m2Id = 102;

        // Record only m1, m2 is missing
        execution.RecordItemResult(m1Id, isPassed: true, actualValue: "88°C");

        var mandatoryIds = new[] { m1Id, m2Id };
        var ex = Assert.Throws<BusinessException>(() =>
            execution.Submit("Yamada Kenji", mandatoryIds));
        Assert.Contains("Tiêu chí kiểm tra bắt buộc", ex.Message);
        Assert.Contains("chưa được thực hiện", ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Submit_WithEmptyPerformerSignature_ShouldThrowBusinessException(string? signature)
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);
        execution.RecordItemResult(101, isPassed: true);

        var ex = Assert.Throws<BusinessException>(() =>
            execution.Submit(signature!, new[] { 101 }));
        Assert.Contains("Chữ ký nhân viên thực hiện là bắt buộc", ex.Message);
    }

    [Fact]
    public void RecordItemResult_WhenNotInProgress_ShouldThrowBusinessException()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);
        execution.RecordItemResult(101, isPassed: true);
        execution.Submit("Signature", new[] { 101 });

        // Status is now Completed
        var ex = Assert.Throws<BusinessException>(() =>
            execution.RecordItemResult(101, isPassed: false));
        Assert.Contains("Không thể ghi nhận kết quả khi bảng kiểm tra đang ở trạng thái 'Completed'", ex.Message);
    }

    [Fact]
    public void RecordItemResult_UpdateExistingResult_ShouldUpdateValues()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);

        execution.RecordItemResult(101, isPassed: false, actualValue: "70°C", remarks: "Nước chưa đủ nóng");
        Assert.Single(execution.Results);
        Assert.False(execution.Results.First().IsPassed);

        // Update same item result
        execution.RecordItemResult(101, isPassed: true, actualValue: "86°C", remarks: "Đã đun thêm 15p");
        Assert.Single(execution.Results);
        Assert.True(execution.Results.First().IsPassed);
        Assert.Equal("86°C", execution.Results.First().ActualValue);
    }

    #endregion

    #region Manager Dual Control Approval & Rejection Tests

    [Fact]
    public void Approve_WithDualControlManager_ShouldTransitionToApproved()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);
        execution.RecordItemResult(101, isPassed: true);
        execution.Submit("Staff Yamada", new[] { 101 });

        // Manager approval by different user (Dual Control)
        execution.Approve(managerUserId: 2, managerSignature: "Manager Sato", notes: "Đã kiểm tra đối soát đạt chuẩn 5S");

        Assert.Equal(ChecklistStatus.Approved, execution.Status);
        Assert.Equal(2, execution.ManagerUserId);
        Assert.Equal("Manager Sato", execution.ManagerSignature);
        Assert.Equal("Đã kiểm tra đối soát đạt chuẩn 5S", execution.ManagerNotes);
        Assert.NotNull(execution.ApprovedAt);
    }

    [Fact]
    public void Approve_WhenSameUserAsPerformer_ShouldViolateDualControlAndThrowBusinessException()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);
        execution.RecordItemResult(101, isPassed: true);
        execution.Submit("Staff Yamada", new[] { 101 });

        // Performer attempts to approve their own checklist
        var ex = Assert.Throws<BusinessException>(() =>
            execution.Approve(managerUserId: 10, managerSignature: "Staff Yamada"));
        Assert.Contains("Yêu cầu kiểm soát kép Dual-Control", ex.Message);
        Assert.Contains("không thể tự phê duyệt bảng kiểm tra của chính mình", ex.Message);
    }

    [Fact]
    public void Approve_WhenNotCompleted_ShouldThrowBusinessException()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);

        // Still in progress
        var ex = Assert.Throws<BusinessException>(() =>
            execution.Approve(managerUserId: 2, managerSignature: "Manager Sato"));
        Assert.Contains("Chỉ có thể phê duyệt bảng kiểm tra đã hoàn thành (Completed)", ex.Message);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Approve_WithEmptyManagerSignature_ShouldThrowBusinessException(string? signature)
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);
        execution.RecordItemResult(101, isPassed: true);
        execution.Submit("Staff Yamada", new[] { 101 });

        var ex = Assert.Throws<BusinessException>(() =>
            execution.Approve(managerUserId: 2, managerSignature: signature!));
        Assert.Contains("Chữ ký quản lý phê duyệt là bắt buộc", ex.Message);
    }

    [Fact]
    public void Reject_WhenCompleted_ShouldTransitionToRejected()
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);
        execution.RecordItemResult(101, isPassed: true);
        execution.Submit("Staff Yamada", new[] { 101 });

        execution.Reject(managerUserId: 2, reason: "Nhiệt độ nước dùng chưa đạt yêu cầu, cần hầm thêm");

        Assert.Equal(ChecklistStatus.Rejected, execution.Status);
        Assert.Equal(2, execution.ManagerUserId);
        Assert.Equal("Nhiệt độ nước dùng chưa đạt yêu cầu, cần hầm thêm", execution.ManagerNotes);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void Reject_WithEmptyReason_ShouldThrowBusinessException(string? reason)
    {
        var execution = new ChecklistExecution(checklistId: 1, DateTime.UtcNow, "Ca Sáng", performerUserId: 10);
        execution.RecordItemResult(101, isPassed: true);
        execution.Submit("Staff Yamada", new[] { 101 });

        var ex = Assert.Throws<BusinessException>(() =>
            execution.Reject(managerUserId: 2, reason: reason!));
        Assert.Contains("Lý do từ chối là bắt buộc", ex.Message);
    }

    #endregion
}
