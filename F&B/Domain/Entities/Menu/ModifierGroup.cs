using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Menu;

public class ModifierGroup : BaseAuditableEntity
{
    public string GroupCode { get; protected set; } = string.Empty;
    public string GroupName { get; protected set; } = string.Empty;
    public string? Description { get; protected set; }
    public int MinSelection { get; protected set; } = 0;
    public int MaxSelection { get; protected set; } = 1;
    public bool IsRequired => MinSelection > 0;
    public bool IsMultiple => MaxSelection > 1;
    public int DisplayOrder { get; protected set; }
    public bool IsActive { get; protected set; } = true;

    private readonly List<ModifierOption> _options = new();
    public virtual IReadOnlyCollection<ModifierOption> Options => _options.AsReadOnly();

    protected ModifierGroup() { }

    public ModifierGroup(
        string groupCode,
        string groupName,
        int minSelection = 0,
        int maxSelection = 1,
        string? description = null,
        int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(groupCode))
            throw new BusinessException("Mã nhóm tùy chọn không được để trống.");
        if (string.IsNullOrWhiteSpace(groupName))
            throw new BusinessException("Tên nhóm tùy chọn không được để trống.");
        if (minSelection < 0)
            throw new BusinessException("Số lượng lựa chọn tối thiểu không được nhỏ hơn 0.");
        if (maxSelection < minSelection || maxSelection <= 0)
            throw new BusinessException("Số lượng lựa chọn tối đa phải lớn hơn hoặc bằng số tối thiểu và lớn hơn 0.");

        GroupCode = groupCode.Trim().ToUpperInvariant();
        GroupName = groupName.Trim();
        MinSelection = minSelection;
        MaxSelection = maxSelection;
        Description = description?.Trim();
        DisplayOrder = displayOrder;
        IsActive = true;
    }

    public void UpdateRules(int minSelection, int maxSelection)
    {
        if (minSelection < 0)
            throw new BusinessException("Số lượng lựa chọn tối thiểu không được nhỏ hơn 0.");
        if (maxSelection < minSelection || maxSelection <= 0)
            throw new BusinessException("Số lượng lựa chọn tối đa phải lớn hơn hoặc bằng số tối thiểu và lớn hơn 0.");

        MinSelection = minSelection;
        MaxSelection = maxSelection;
    }

    public void UpdateDetails(string groupName, int minSelection, int maxSelection, string? description = null, int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(groupName))
            throw new BusinessException("Tên nhóm tùy chọn không được để trống.");

        UpdateRules(minSelection, maxSelection);
        GroupName = groupName.Trim();
        Description = description?.Trim();
        DisplayOrder = displayOrder;
    }

    public void AddOption(ModifierOption option)
    {
        ArgumentNullException.ThrowIfNull(option);
        if (_options.Any(o => o.OptionCode.Equals(option.OptionCode, StringComparison.OrdinalIgnoreCase)))
            throw new BusinessException($"Tùy chọn '{option.OptionCode}' đã tồn tại trong nhóm {GroupName}.");

        _options.Add(option);
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
