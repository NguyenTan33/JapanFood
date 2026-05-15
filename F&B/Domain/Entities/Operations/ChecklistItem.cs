using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Operations;

public class ChecklistItem : BaseEntity
{
    public int ChecklistId { get; protected set; }
    public string Section { get; protected set; } = string.Empty;
    public string Description { get; protected set; } = string.Empty;
    public bool IsMandatory { get; protected set; } = true;
    public int DisplayOrder { get; protected set; } = 0;
    public string? ExpectedStandard { get; protected set; }

    public virtual ShiftChecklist? Checklist { get; protected set; }

    protected ChecklistItem() { }

    public ChecklistItem(int checklistId, string section, string description, bool isMandatory = true, int displayOrder = 0, string? expectedStandard = null)
    {
        if (string.IsNullOrWhiteSpace(section))
            throw new BusinessException("Khu vực/Hạng mục kiểm tra không được để trống.");
        if (string.IsNullOrWhiteSpace(description))
            throw new BusinessException("Mô tả tiêu chí kiểm tra không được để trống.");

        ChecklistId = checklistId;
        Section = section.Trim();
        Description = description.Trim();
        IsMandatory = isMandatory;
        DisplayOrder = displayOrder >= 0 ? displayOrder : 0;
        ExpectedStandard = expectedStandard?.Trim();
    }
}
