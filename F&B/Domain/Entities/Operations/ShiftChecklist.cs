using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Operations;

public class ShiftChecklist : BaseAuditableEntity
{
    public ShiftType ChecklistType { get; protected set; }
    public string Title { get; protected set; } = string.Empty;
    public string? Description { get; protected set; }
    public bool IsActive { get; protected set; } = true;

    private readonly List<ChecklistItem> _items = new();
    public virtual IReadOnlyCollection<ChecklistItem> Items => _items.AsReadOnly();

    protected ShiftChecklist() { }

    public ShiftChecklist(ShiftType checklistType, string title, string? description = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new BusinessException("Tiêu đề danh mục kiểm tra không được để trống.");

        ChecklistType = checklistType;
        Title = title.Trim();
        Description = description?.Trim();
        IsActive = true;
    }

    public ChecklistItem AddItem(string section, string description, bool isMandatory, int displayOrder, string? expectedStandard = null)
    {
        var item = new ChecklistItem(Id, section, description, isMandatory, displayOrder, expectedStandard);
        _items.Add(item);
        return item;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
