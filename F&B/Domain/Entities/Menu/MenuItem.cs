using Domain.Entities.Common;
using Domain.Entities.Inventory;
using Domain.Entities.Kds;
using Domain.Exceptions;

namespace Domain.Entities.Menu;

public class MenuItem : BaseAuditableEntity
{
    public int CategoryId { get; protected set; }
    public string Code { get; protected set; } = string.Empty;
    public string Name { get; protected set; } = string.Empty;
    public string? JapaneseName { get; protected set; }
    public string? Slug { get; protected set; }
    public string? Description { get; protected set; }
    public decimal BasePrice { get; protected set; }
    public decimal? OriginalPrice { get; protected set; }
    public string? ImageUrl { get; protected set; }
    public string? Tags { get; protected set; }
    public string? Ingredients { get; protected set; }
    public int SpiceLevel { get; protected set; } = 0;
    public int? Calories { get; protected set; }
    public bool IsFeatured { get; protected set; } = false;
    public bool IsAvailable { get; protected set; } = true;
    public bool IsKitchenItem { get; protected set; } = true;
    public KitchenStationType KitchenStation { get; protected set; } = KitchenStationType.NoodleStation;
    public int EstimatedPrepMinutes { get; protected set; } = 10;

    // Navigation
    public virtual Category Category { get; protected set; } = null!;
    private readonly List<MenuItemModifierGroup> _modifierGroups = new();
    public virtual IReadOnlyCollection<MenuItemModifierGroup> ModifierGroups => _modifierGroups.AsReadOnly();
    private readonly List<RecipeBOM> _recipes = new();
    public virtual IReadOnlyCollection<RecipeBOM> Recipes => _recipes.AsReadOnly();

    protected MenuItem() { }

    public MenuItem(
        int categoryId,
        string code,
        string name,
        decimal basePrice,
        string? japaneseName = null,
        string? description = null,
        KitchenStationType kitchenStation = KitchenStationType.NoodleStation,
        int estimatedPrepMinutes = 10,
        bool isKitchenItem = true)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new BusinessException("Mã món ăn không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên món ăn không được để trống.");
        if (basePrice < 0)
            throw new BusinessException("Giá món ăn không được âm.");
        if (estimatedPrepMinutes < 0)
            throw new BusinessException("Thời gian chế biến dự kiến không hợp lệ.");

        CategoryId = categoryId;
        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        BasePrice = basePrice;
        JapaneseName = japaneseName?.Trim();
        Description = description?.Trim();
        KitchenStation = kitchenStation;
        EstimatedPrepMinutes = estimatedPrepMinutes;
        IsKitchenItem = isKitchenItem;
        IsAvailable = true;
    }

    public void UpdatePrice(decimal newPrice)
    {
        if (newPrice < 0)
            throw new BusinessException("Giá món ăn không được âm.");
        BasePrice = newPrice;
    }

    public void SetAvailability(bool isAvailable) => IsAvailable = isAvailable;

    public void UpdateDetails(string name, string? japaneseName, string? description, decimal basePrice, int estimatedPrepMinutes, string? imageUrl = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên món ăn không được để trống.");
        if (basePrice < 0)
            throw new BusinessException("Giá món ăn không được âm.");
        if (estimatedPrepMinutes < 0)
            throw new BusinessException("Thời gian chế biến dự kiến không hợp lệ.");

        Name = name.Trim();
        JapaneseName = japaneseName?.Trim();
        Description = description?.Trim();
        BasePrice = basePrice;
        EstimatedPrepMinutes = estimatedPrepMinutes;
        if (imageUrl != null)
            ImageUrl = imageUrl;
    }

    public void ChangeCategory(int categoryId)
    {
        if (categoryId > 0)
            CategoryId = categoryId;
    }

    public void SetFeatured(bool isFeatured) => IsFeatured = isFeatured;

    public void UpdateCatalogDetails(
        int categoryId,
        string name,
        string? japaneseName,
        string? slug,
        string? description,
        decimal basePrice,
        decimal? originalPrice,
        string? imageUrl,
        KitchenStationType kitchenStation,
        int estimatedPrepMinutes,
        bool isKitchenItem,
        bool isFeatured,
        bool isAvailable,
        string? tags = null,
        string? ingredients = null,
        int spiceLevel = 0,
        int? calories = null)
    {
        if (categoryId <= 0)
            throw new BusinessException("Mã danh mục không hợp lệ.");
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên món ăn không được để trống.");
        if (basePrice < 0)
            throw new BusinessException("Giá món ăn không được âm.");
        if (originalPrice.HasValue && originalPrice.Value < 0)
            throw new BusinessException("Giá gốc món ăn không được âm.");
        if (estimatedPrepMinutes < 0)
            throw new BusinessException("Thời gian chế biến dự kiến không hợp lệ.");
        if (spiceLevel < 0)
            throw new BusinessException("Độ cay không được âm.");
        if (calories.HasValue && calories.Value < 0)
            throw new BusinessException("Lượng calo không được âm.");

        CategoryId = categoryId;
        Name = name.Trim();
        JapaneseName = japaneseName?.Trim();
        Slug = slug?.Trim().ToLowerInvariant();
        Description = description?.Trim();
        BasePrice = basePrice;
        OriginalPrice = originalPrice;
        ImageUrl = imageUrl?.Trim();
        KitchenStation = kitchenStation;
        EstimatedPrepMinutes = estimatedPrepMinutes;
        IsKitchenItem = isKitchenItem;
        IsFeatured = isFeatured;
        IsAvailable = isAvailable;
        Tags = tags;
        Ingredients = ingredients;
        SpiceLevel = spiceLevel;
        Calories = calories;
    }

    public void AddModifierGroup(ModifierGroup modifierGroup, int displayOrder = 0)
    {
        ArgumentNullException.ThrowIfNull(modifierGroup);
        if (_modifierGroups.Any(mg =>
            (mg.ModifierGroupId != 0 && mg.ModifierGroupId == modifierGroup.Id) ||
            (mg.ModifierGroup != null && mg.ModifierGroup == modifierGroup) ||
            (mg.ModifierGroup != null && !string.IsNullOrEmpty(mg.ModifierGroup.GroupCode) &&
             mg.ModifierGroup.GroupCode.Equals(modifierGroup.GroupCode, StringComparison.OrdinalIgnoreCase))))
        {
            throw new BusinessException($"Nhóm tùy chọn '{modifierGroup.GroupName}' đã tồn tại cho món {Name}.");
        }

        _modifierGroups.Add(new MenuItemModifierGroup(Id, modifierGroup.Id, displayOrder, modifierGroup));
    }

    public void AddRecipe(RecipeBOM recipe)
    {
        ArgumentNullException.ThrowIfNull(recipe);
        if (_recipes.Any(r =>
            (r.InventoryItemId != 0 && r.InventoryItemId == recipe.InventoryItemId) ||
            (r.InventoryItem != null && recipe.InventoryItem != null && r.InventoryItem == recipe.InventoryItem)))
        {
            throw new BusinessException($"Nguyên liệu ID {recipe.InventoryItemId} đã tồn tại trong định lượng món {Name}.");
        }

        _recipes.Add(recipe);
    }
}
