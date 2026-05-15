using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Operations;

public class ChecklistItemResult : BaseEntity
{
    public int ExecutionId { get; protected set; }
    public int ChecklistItemId { get; protected set; }
    public bool IsPassed { get; protected set; }
    public string? ActualValue { get; protected set; }
    public string? PhotoUrl { get; protected set; }
    public string? Remarks { get; protected set; }

    public virtual ChecklistExecution? Execution { get; protected set; }
    public virtual ChecklistItem? ChecklistItem { get; protected set; }

    protected ChecklistItemResult() { }

    public ChecklistItemResult(int executionId, int checklistItemId, bool isPassed, string? actualValue = null, string? photoUrl = null, string? remarks = null)
    {
        if (checklistItemId <= 0)
            throw new BusinessException("Mã tiêu chí kiểm tra không hợp lệ.");

        ExecutionId = executionId;
        ChecklistItemId = checklistItemId;
        IsPassed = isPassed;
        ActualValue = actualValue?.Trim();
        PhotoUrl = photoUrl?.Trim();
        Remarks = remarks?.Trim();
    }

    public void Update(bool isPassed, string? actualValue, string? photoUrl, string? remarks)
    {
        IsPassed = isPassed;
        ActualValue = actualValue?.Trim();
        PhotoUrl = photoUrl?.Trim();
        Remarks = remarks?.Trim();
    }
}
