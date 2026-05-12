using Domain.Entities.Common;

namespace Domain.Entities.Menu;

public class MenuItemModifierGroup : BaseEntity
{
    public int MenuItemId { get; protected set; }
    public int ModifierGroupId { get; protected set; }
    public int DisplayOrder { get; protected set; }

    public virtual MenuItem MenuItem { get; protected set; } = null!;
    public virtual ModifierGroup ModifierGroup { get; protected set; } = null!;

    protected MenuItemModifierGroup() { }

    public MenuItemModifierGroup(int menuItemId, int modifierGroupId, int displayOrder = 0, ModifierGroup? modifierGroup = null)
    {
        MenuItemId = menuItemId;
        ModifierGroupId = modifierGroupId;
        DisplayOrder = displayOrder;
        if (modifierGroup != null)
        {
            ModifierGroup = modifierGroup;
            if (modifierGroupId == 0 && modifierGroup.Id != 0)
            {
                ModifierGroupId = modifierGroup.Id;
            }
        }
    }

    public MenuItemModifierGroup(MenuItem menuItem, ModifierGroup modifierGroup, int displayOrder = 0)
    {
        MenuItem = menuItem ?? throw new ArgumentNullException(nameof(menuItem));
        MenuItemId = menuItem.Id;
        ModifierGroup = modifierGroup ?? throw new ArgumentNullException(nameof(modifierGroup));
        ModifierGroupId = modifierGroup.Id;
        DisplayOrder = displayOrder;
    }
}
