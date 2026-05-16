using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Content;

public class BlogPost : BaseAuditableEntity
{
    public string Slug { get; protected set; } = string.Empty;
    public string Title { get; protected set; } = string.Empty;
    public string? Subtitle { get; protected set; }
    public string? JapaneseTitle { get; protected set; }
    public string Category { get; protected set; } = string.Empty;
    public string Excerpt { get; protected set; } = string.Empty;
    public string Content { get; protected set; } = string.Empty;
    public string? CoverImageUrl { get; protected set; }
    public string AuthorName { get; protected set; } = string.Empty;
    public string? AuthorRole { get; protected set; }
    public string? AuthorAvatarUrl { get; protected set; }
    public DateTime PublishedAt { get; protected set; }
    public int ReadTimeMinutes { get; protected set; } = 5;
    public string? Tags { get; protected set; }
    public string? RelatedDishIds { get; protected set; }
    public bool IsPublished { get; protected set; } = true;

    protected BlogPost() { }

    public BlogPost(
        string slug,
        string title,
        string category,
        string excerpt,
        string content,
        string authorName,
        DateTime publishedAt,
        int readTimeMinutes = 5,
        string? subtitle = null,
        string? japaneseTitle = null,
        string? coverImageUrl = null,
        string? authorRole = null,
        string? authorAvatarUrl = null,
        string? tags = null,
        string? relatedDishIds = null,
        bool isPublished = true)
    {
        if (string.IsNullOrWhiteSpace(slug))
            throw new BusinessException("Slug bài viết không được để trống.");
        if (string.IsNullOrWhiteSpace(title))
            throw new BusinessException("Tiêu đề bài viết không được để trống.");
        if (string.IsNullOrWhiteSpace(content))
            throw new BusinessException("Nội dung bài viết không được để trống.");
        if (string.IsNullOrWhiteSpace(authorName))
            throw new BusinessException("Tên tác giả không được để trống.");
        if (readTimeMinutes <= 0)
            throw new BusinessException("Thời gian đọc phải lớn hơn 0.");

        Slug = slug.Trim().ToLowerInvariant();
        Title = title.Trim();
        Subtitle = subtitle?.Trim();
        JapaneseTitle = japaneseTitle?.Trim();
        Category = category.Trim();
        Excerpt = excerpt.Trim();
        Content = content.Trim();
        CoverImageUrl = coverImageUrl?.Trim();
        AuthorName = authorName.Trim();
        AuthorRole = authorRole?.Trim();
        AuthorAvatarUrl = authorAvatarUrl?.Trim();
        PublishedAt = publishedAt;
        ReadTimeMinutes = readTimeMinutes;
        Tags = tags;
        RelatedDishIds = relatedDishIds;
        IsPublished = isPublished;
    }

    public void UpdateDetails(
        string title,
        string category,
        string excerpt,
        string content,
        string authorName,
        DateTime publishedAt,
        int readTimeMinutes,
        string? subtitle,
        string? japaneseTitle,
        string? coverImageUrl,
        string? authorRole,
        string? authorAvatarUrl,
        string? tags,
        string? relatedDishIds,
        bool isPublished)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new BusinessException("Tiêu đề bài viết không được để trống.");
        if (string.IsNullOrWhiteSpace(content))
            throw new BusinessException("Nội dung bài viết không được để trống.");
        if (string.IsNullOrWhiteSpace(authorName))
            throw new BusinessException("Tên tác giả không được để trống.");
        if (readTimeMinutes <= 0)
            throw new BusinessException("Thời gian đọc phải lớn hơn 0.");

        Title = title.Trim();
        Subtitle = subtitle?.Trim();
        JapaneseTitle = japaneseTitle?.Trim();
        Category = category.Trim();
        Excerpt = excerpt.Trim();
        Content = content.Trim();
        CoverImageUrl = coverImageUrl?.Trim();
        AuthorName = authorName.Trim();
        AuthorRole = authorRole?.Trim();
        AuthorAvatarUrl = authorAvatarUrl?.Trim();
        PublishedAt = publishedAt;
        ReadTimeMinutes = readTimeMinutes;
        Tags = tags;
        RelatedDishIds = relatedDishIds;
        IsPublished = isPublished;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Publish() => IsPublished = true;
    public void Unpublish() => IsPublished = false;
}
