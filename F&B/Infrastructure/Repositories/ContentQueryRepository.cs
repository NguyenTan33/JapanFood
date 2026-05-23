using System.Text.Json;
using Application.DTOs.Content;
using Application.Interfaces.Repositories;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class ContentQueryRepository : IContentQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public ContentQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<List<BranchDto>> GetActiveBranchesAsync(CancellationToken ct = default)
    {
        return await _context.Branches
            .AsNoTracking()
            .Where(b => b.IsActive)
            .OrderBy(b => b.DisplayOrder)
            .Select(b => new BranchDto
            {
                Id = b.Id,
                Code = b.Code,
                Name = b.Name,
                JapaneseName = b.JapaneseName,
                Address = b.Address,
                District = b.District,
                City = b.City,
                Phone = b.Phone,
                Hotline = b.Hotline,
                Email = b.Email,
                OpeningHours = new BranchOpeningHoursDto
                {
                    Lunch = b.OpeningHoursLunch,
                    Dinner = b.OpeningHoursDinner,
                    Note = b.OpeningHoursNote
                },
                ParkingInfo = new BranchParkingInfoDto
                {
                    Motorbike = b.ParkingMotorbike,
                    Car = b.ParkingCar
                },
                MapEmbedUrl = b.MapEmbedUrl,
                MapDirectionsUrl = b.MapDirectionsUrl,
                ImageUrl = b.ImageUrl,
                IsMainBranch = b.IsMainBranch,
                DisplayOrder = b.DisplayOrder
            })
            .ToListAsync(ct);
    }

    public async Task<List<BlogPostDto>> GetPublishedBlogsAsync(string? category = null, CancellationToken ct = default)
    {
        var query = _context.BlogPosts
            .AsNoTracking()
            .Where(p => p.IsPublished);

        if (!string.IsNullOrWhiteSpace(category))
        {
            var catTrimmed = category.Trim().ToLower();
            query = query.Where(p => p.Category.ToLower() == catTrimmed);
        }

        var rawPosts = await query
            .OrderByDescending(p => p.PublishedAt)
            .Select(p => new
            {
                p.Id,
                p.Slug,
                p.Title,
                p.Subtitle,
                p.JapaneseTitle,
                p.Category,
                p.Excerpt,
                p.Content,
                p.CoverImageUrl,
                p.AuthorName,
                p.AuthorRole,
                p.AuthorAvatarUrl,
                p.PublishedAt,
                p.ReadTimeMinutes,
                p.Tags,
                p.RelatedDishIds
            })
            .ToListAsync(ct);

        return rawPosts.Select(p => new BlogPostDto
        {
            Id = p.Id,
            Slug = p.Slug,
            Title = p.Title,
            Subtitle = p.Subtitle,
            JapaneseSubtitle = p.JapaneseTitle,
            Category = p.Category,
            Excerpt = p.Excerpt,
            Content = p.Content,
            CoverImageUrl = p.CoverImageUrl,
            AuthorName = p.AuthorName,
            AuthorRole = p.AuthorRole,
            AuthorAvatarUrl = p.AuthorAvatarUrl,
            Author = new BlogAuthorDto
            {
                Name = p.AuthorName,
                Role = p.AuthorRole,
                Avatar = p.AuthorAvatarUrl
            },
            PublishedAt = p.PublishedAt,
            ReadTimeMinutes = p.ReadTimeMinutes,
            Tags = ParseStringList(p.Tags),
            RelatedDishIds = ParseIntList(p.RelatedDishIds)
        }).ToList();
    }

    public async Task<BlogPostDto?> GetBlogBySlugAsync(string slug, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(slug))
            return null;

        var normalizedSlug = slug.Trim().ToLowerInvariant();
        var raw = await _context.BlogPosts
            .AsNoTracking()
            .Where(p => p.IsPublished && p.Slug.ToLower() == normalizedSlug)
            .Select(p => new
            {
                p.Id,
                p.Slug,
                p.Title,
                p.Subtitle,
                p.JapaneseTitle,
                p.Category,
                p.Excerpt,
                p.Content,
                p.CoverImageUrl,
                p.AuthorName,
                p.AuthorRole,
                p.AuthorAvatarUrl,
                p.PublishedAt,
                p.ReadTimeMinutes,
                p.Tags,
                p.RelatedDishIds
            })
            .FirstOrDefaultAsync(ct);

        if (raw == null)
            return null;

        return new BlogPostDto
        {
            Id = raw.Id,
            Slug = raw.Slug,
            Title = raw.Title,
            Subtitle = raw.Subtitle,
            JapaneseSubtitle = raw.JapaneseTitle,
            Category = raw.Category,
            Excerpt = raw.Excerpt,
            Content = raw.Content,
            CoverImageUrl = raw.CoverImageUrl,
            AuthorName = raw.AuthorName,
            AuthorRole = raw.AuthorRole,
            AuthorAvatarUrl = raw.AuthorAvatarUrl,
            Author = new BlogAuthorDto
            {
                Name = raw.AuthorName,
                Role = raw.AuthorRole,
                Avatar = raw.AuthorAvatarUrl
            },
            PublishedAt = raw.PublishedAt,
            ReadTimeMinutes = raw.ReadTimeMinutes,
            Tags = ParseStringList(raw.Tags),
            RelatedDishIds = ParseIntList(raw.RelatedDishIds)
        };
    }

    public async Task<RestaurantInfoDto?> GetRestaurantInfoAsync(CancellationToken ct = default)
    {
        return await _context.RestaurantSettings
            .AsNoTracking()
            .OrderBy(s => s.SettingKey == "DEFAULT" ? 0 : 1)
            .Select(s => new RestaurantInfoDto
            {
                BrandName = s.BrandName,
                JapaneseName = s.JapaneseName,
                Slogan = s.Slogan,
                Hotline = s.Hotline,
                Email = s.Email,
                SocialLinks = new SocialLinksDto
                {
                    Facebook = s.FacebookUrl,
                    Instagram = s.InstagramUrl
                },
                BankName = s.BankName,
                BankId = s.BankId,
                AccountNumber = s.AccountNumber,
                AccountName = s.AccountName,
                BankBranch = s.BankBranch,
                DefaultQrTemplate = s.DefaultQrTemplate
            })
            .FirstOrDefaultAsync(ct);
    }

    private static List<string> ParseStringList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new List<string>();

        var trimmed = json.Trim();
        if (trimmed.StartsWith('['))
        {
            try
            {
                return JsonSerializer.Deserialize<List<string>>(trimmed) ?? new List<string>();
            }
            catch
            {
            }
        }

        return trimmed
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
    }

    private static List<int> ParseIntList(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new List<int>();

        var trimmed = json.Trim();
        if (trimmed.StartsWith('['))
        {
            try
            {
                return JsonSerializer.Deserialize<List<int>>(trimmed) ?? new List<int>();
            }
            catch
            {
            }
        }

        var result = new List<int>();
        foreach (var part in trimmed.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (int.TryParse(part, out var id))
                result.Add(id);
        }

        return result;
    }
}
