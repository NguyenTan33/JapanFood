using Domain.Entities.Kds;

namespace Application.DTOs.Menu;

public class CategoryMenuDto
{
    public int CategoryId { get; set; }
    public string CategoryCode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public int DishCount => Dishes.Count;
    public List<DishSummaryDto> Dishes { get; set; } = new();
}

public class DishSummaryDto
{
    public int DishId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Slug { get; set; }
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public decimal BasePrice { get; set; }
    public decimal? OriginalPrice { get; set; }
    public string? ImageUrl { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<string> Ingredients { get; set; } = new();
    public int SpiceLevel { get; set; }
    public int? Calories { get; set; }
    public int EstimatedPrepMinutes { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsAvailable { get; set; } = true;
    public double AverageRating { get; set; } = 5.0;
    public int TotalReviews { get; set; }
    public List<ModifierGroupDto> ModifierGroups { get; set; } = new();
}

public class DishCardDto
{
    public int DishId { get; set; }
    public int CategoryId { get; set; }
    public string CategoryCode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Slug { get; set; }
    public string? Description { get; set; }
    public string? ShortDescription { get; set; }
    public decimal BasePrice { get; set; }
    public decimal? OriginalPrice { get; set; }
    public string? ImageUrl { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<string> Ingredients { get; set; } = new();
    public int SpiceLevel { get; set; }
    public int? Calories { get; set; }
    public int EstimatedPrepMinutes { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsAvailable { get; set; } = true;
    public double AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public List<ModifierGroupDto> ModifierGroups { get; set; } = new();
}

public class DishDetailDto
{
    public int DishId { get; set; }
    public int CategoryId { get; set; }
    public string CategoryCode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Slug { get; set; }
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public decimal? OriginalPrice { get; set; }
    public string? ImageUrl { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<string> Ingredients { get; set; } = new();
    public int SpiceLevel { get; set; }
    public int? Calories { get; set; }
    public int EstimatedPrepMinutes { get; set; }
    public bool IsFeatured { get; set; }
    public bool IsAvailable { get; set; } = true;
    public double AverageRating { get; set; }
    public int TotalReviews { get; set; }
    public List<ModifierGroupDto> ModifierGroups { get; set; } = new();
}

public class ModifierGroupDto
{
    public int GroupId { get; set; }
    public string GroupCode { get; set; } = string.Empty;
    public string GroupName { get; set; } = string.Empty;
    public bool IsRequired { get; set; }
    public int MinSelection { get; set; }
    public int MaxSelection { get; set; }
    public List<ModifierOptionDto> Options { get; set; } = new();
}

public class ModifierOptionDto
{
    public int OptionId { get; set; }
    public string OptionCode { get; set; } = string.Empty;
    public string OptionName { get; set; } = string.Empty;
    public decimal PriceAdjustment { get; set; }
    public bool IsDefault { get; set; }
    public bool IsAvailable { get; set; } = true;
}

public class DishFilterQueryDto
{
    public int? CategoryId { get; set; }
    public string? CategoryCode { get; set; }
    public string? Tag { get; set; }
    public decimal? MinPrice { get; set; }
    public decimal? MaxPrice { get; set; }
    public bool? IsFeatured { get; set; }
    public string? Keyword { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 12;
    public string? SortBy { get; set; } = "price_asc";
    public bool IncludeUnavailable { get; set; } = false;
}

public class CreateCategoryRequestDto
{
    public string CategoryCode { get; set; } = string.Empty;
    public string CategoryName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayOrder { get; set; }
}

public class UpdateCategoryRequestDto
{
    public string CategoryName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public string? IconName { get; set; }
    public string? ImageUrl { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateMenuItemRequestDto
{
    public int CategoryId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal BasePrice { get; set; }
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public KitchenStationType KitchenStation { get; set; } = KitchenStationType.NoodleStation;
    public int EstimatedPrepMinutes { get; set; } = 10;
    public bool IsKitchenItem { get; set; } = true;
}

public class UpdateMenuItemRequestDto
{
    public int? CategoryId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public decimal BasePrice { get; set; }
    public int EstimatedPrepMinutes { get; set; } = 10;
    public string? ImageUrl { get; set; }
}
