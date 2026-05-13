using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Kds;

public class KitchenStation : BaseAuditableEntity
{
    public string Name { get; protected set; } = string.Empty;
    public KitchenStationType StationType { get; protected set; }
    public string? Description { get; protected set; }
    public bool IsActive { get; protected set; } = true;
    public int DisplayOrder { get; protected set; } = 0;

    private readonly List<KitchenTicketItem> _ticketItems = new();
    public virtual IReadOnlyCollection<KitchenTicketItem> TicketItems => _ticketItems.AsReadOnly();

    protected KitchenStation() { }

    public KitchenStation(string name, KitchenStationType stationType, string? description = null, int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên trạm bếp không được để trống.");

        Name = name.Trim();
        StationType = stationType;
        Description = description?.Trim();
        DisplayOrder = displayOrder >= 0 ? displayOrder : 0;
        IsActive = true;
    }

    public void UpdateInfo(string name, string? description, int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên trạm bếp không được để trống.");

        Name = name.Trim();
        Description = description?.Trim();
        DisplayOrder = displayOrder >= 0 ? displayOrder : 0;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
