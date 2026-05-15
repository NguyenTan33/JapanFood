using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Operations;

public class ChecklistExecution : BaseAuditableEntity
{
    public int ChecklistId { get; protected set; }
    public DateTime ShiftDate { get; protected set; }
    public string ShiftName { get; protected set; } = string.Empty;
    public int PerformerUserId { get; protected set; }
    public string PerformerSignature { get; protected set; } = string.Empty;
    public DateTime PerformedAt { get; protected set; } = DateTime.UtcNow;
    public int? ManagerUserId { get; protected set; }
    public string? ManagerSignature { get; protected set; }
    public DateTime? ApprovedAt { get; protected set; }
    public ChecklistStatus Status { get; protected set; } = ChecklistStatus.InProgress;
    public string? ManagerNotes { get; protected set; }

    public virtual ShiftChecklist? Checklist { get; protected set; }
    public virtual User? PerformerUser { get; protected set; }
    public virtual User? ManagerUser { get; protected set; }

    private readonly List<ChecklistItemResult> _results = new();
    public virtual IReadOnlyCollection<ChecklistItemResult> Results => _results.AsReadOnly();

    protected ChecklistExecution() { }

    public ChecklistExecution(int checklistId, DateTime shiftDate, string shiftName, int performerUserId)
    {
        if (checklistId <= 0)
            throw new BusinessException("Mã danh mục kiểm tra không hợp lệ.");
        if (string.IsNullOrWhiteSpace(shiftName))
            throw new BusinessException("Tên ca làm việc không được để trống.");
        if (performerUserId <= 0)
            throw new BusinessException("Mã nhân viên thực hiện không hợp lệ.");

        ChecklistId = checklistId;
        ShiftDate = shiftDate.Date;
        ShiftName = shiftName.Trim();
        PerformerUserId = performerUserId;
        CreatedByUserId = performerUserId;
        Status = ChecklistStatus.InProgress;
        PerformedAt = DateTime.UtcNow;
        CreatedAt = DateTime.UtcNow;
    }

    public ChecklistItemResult RecordItemResult(int checklistItemId, bool isPassed, string? actualValue = null, string? photoUrl = null, string? remarks = null)
    {
        if (Status != ChecklistStatus.InProgress)
            throw new BusinessException($"Không thể ghi nhận kết quả khi bảng kiểm tra đang ở trạng thái '{Status}'.");

        var existing = _results.FirstOrDefault(r => r.ChecklistItemId == checklistItemId);
        if (existing != null)
        {
            existing.Update(isPassed, actualValue, photoUrl, remarks);
            return existing;
        }

        var result = new ChecklistItemResult(Id, checklistItemId, isPassed, actualValue, photoUrl, remarks);
        _results.Add(result);
        return result;
    }

    public void Submit(string performerSignature, IEnumerable<int> mandatoryChecklistItemIds)
    {
        if (Status != ChecklistStatus.InProgress)
            throw new BusinessException($"Chỉ có thể nộp bảng kiểm tra ở trạng thái Đang thực hiện (InProgress). Trạng thái hiện tại: '{Status}'.");
        if (string.IsNullOrWhiteSpace(performerSignature))
            throw new BusinessException("Chữ ký nhân viên thực hiện là bắt buộc để nộp bảng kiểm tra.");

        // Validate that all mandatory items are recorded
        var recordedItemIds = _results.Select(r => r.ChecklistItemId).ToHashSet();
        foreach (var mandatoryId in mandatoryChecklistItemIds)
        {
            if (!recordedItemIds.Contains(mandatoryId))
                throw new BusinessException($"Tiêu chí kiểm tra bắt buộc (Mã: {mandatoryId}) chưa được thực hiện/ghi nhận kết quả.");
        }

        PerformerSignature = performerSignature.Trim();
        Status = ChecklistStatus.Completed;
        PerformedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(int managerUserId, string managerSignature, string? notes = null)
    {
        if (Status != ChecklistStatus.Completed)
            throw new BusinessException($"Chỉ có thể phê duyệt bảng kiểm tra đã hoàn thành (Completed). Trạng thái hiện tại: '{Status}'.");
        if (string.IsNullOrWhiteSpace(managerSignature))
            throw new BusinessException("Chữ ký quản lý phê duyệt là bắt buộc.");
        if (managerUserId <= 0)
            throw new BusinessException("Mã quản lý phê duyệt không hợp lệ.");
        if (managerUserId == PerformerUserId)
            throw new BusinessException("Nhân viên thực hiện không thể tự phê duyệt bảng kiểm tra của chính mình (Yêu cầu kiểm soát kép Dual-Control).");

        Status = ChecklistStatus.Approved;
        ManagerUserId = managerUserId;
        ManagerSignature = managerSignature.Trim();
        ApprovedAt = DateTime.UtcNow;
        ManagerNotes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedByUserId = managerUserId;
    }

    public void Reject(int managerUserId, string reason)
    {
        if (Status != ChecklistStatus.Completed)
            throw new BusinessException($"Không thể từ chối bảng kiểm tra ở trạng thái '{Status}'.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do từ chối là bắt buộc.");

        Status = ChecklistStatus.Rejected;
        ManagerUserId = managerUserId;
        ManagerNotes = reason.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedByUserId = managerUserId;
    }
}
