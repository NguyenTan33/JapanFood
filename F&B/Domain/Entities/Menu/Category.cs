using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Menu;

public class Category : BaseAuditableEntity
{
    public string CategoryCode { get; protected set; } = string.Empty;
    public string CategoryName { get; protected set; } = string.Empty;
    public string? JapaneseName { get; protected set; }
    public string? Description { get; protected set; }
    public string? IconName { get; protected set; }
    public string? ImageUrl { get; protected set; }
    public int DisplayOrder { get; protected set; }
    public bool IsActive { get; protected set; } = true;

    private readonly List<MenuItem> _menuItems = new();
    public virtual IReadOnlyCollection<MenuItem> MenuItems => _menuItems.AsReadOnly();

    protected Category() { }

    public Category(
        string categoryCode,
        string categoryName,
        string? description = null,
        int displayOrder = 0,
        string? japaneseName = null,
        string? iconName = null,
        string? imageUrl = null)
    {
        if (string.IsNullOrWhiteSpace(categoryCode))
            throw new BusinessException("Mã danh mục không được để trống.");
        if (string.IsNullOrWhiteSpace(categoryName))
            throw new BusinessException("Tên danh mục không được để trống.");

        CategoryCode = categoryCode.Trim().ToUpperInvariant();
        CategoryName = categoryName.Trim();
        Description = description?.Trim();
        DisplayOrder = displayOrder;
        JapaneseName = japaneseName?.Trim();
        IconName = iconName?.Trim();
        ImageUrl = imageUrl?.Trim();
        IsActive = true;
    }

    public void UpdateInfo(string categoryName, string? description = null, int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(categoryName))
            throw new BusinessException("Tên danh mục không được để trống.");

        CategoryName = categoryName.Trim();
        Description = description?.Trim();
        DisplayOrder = displayOrder;
    }

    public void UpdateVisuals(string? japaneseName, string? iconName, string? imageUrl)
    {
        JapaneseName = japaneseName?.Trim();
        IconName = iconName?.Trim();
        ImageUrl = imageUrl?.Trim();
    }

    public void AddMenuItem(MenuItem item)
    {
        ArgumentNullException.ThrowIfNull(item);
        if (_menuItems.Any(m => m.Code.Equals(item.Code, StringComparison.OrdinalIgnoreCase)))
            throw new BusinessException($"Món ăn với mã '{item.Code}' đã tồn tại trong danh mục {CategoryName}.");

        _menuItems.Add(item);
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
