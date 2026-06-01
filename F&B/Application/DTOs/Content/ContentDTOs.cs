namespace Application.DTOs.Content;

public class BranchOpeningHoursDto
{
    public string? Lunch { get; set; }
    public string? Dinner { get; set; }
    public string? Note { get; set; }
}

public class BranchParkingInfoDto
{
    public string? Motorbike { get; set; }
    public string? Car { get; set; }
}

public class BranchDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string Address { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Hotline { get; set; }
    public string? Email { get; set; }
    public BranchOpeningHoursDto OpeningHours { get; set; } = new();
    public BranchParkingInfoDto ParkingInfo { get; set; } = new();
    public string? MapEmbedUrl { get; set; }
    public string? MapDirectionsUrl { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsMainBranch { get; set; }
    public int DisplayOrder { get; set; }
}

public class BlogAuthorDto
{
    public string Name { get; set; } = string.Empty;
    public string? Role { get; set; }
    public string? Avatar { get; set; }
}

public class BlogPostDto
{
    public int Id { get; set; }
    public string Slug { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Subtitle { get; set; }
    public string? JapaneseSubtitle { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Excerpt { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string? CoverImageUrl { get; set; }
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorRole { get; set; }
    public string? AuthorAvatarUrl { get; set; }
    public BlogAuthorDto Author { get; set; } = new();
    public DateTime PublishedAt { get; set; }
    public int ReadTimeMinutes { get; set; }
    public List<string> Tags { get; set; } = new();
    public List<int> RelatedDishIds { get; set; } = new();
}

public class SocialLinksDto
{
    public string? Facebook { get; set; }
    public string? Instagram { get; set; }
}

public class RestaurantInfoDto
{
    public string BrandName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Slogan { get; set; }
    public string Hotline { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public SocialLinksDto SocialLinks { get; set; } = new();
    public string BankName { get; set; } = string.Empty;
    public string BankId { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string? BankBranch { get; set; }
    public string DefaultQrTemplate { get; set; } = "compact2";
}
