using System.Text.Json;
using Application.Common.Extensions;
using Application.Common.Models;
using Application.DTOs.Menu;
using Application.Interfaces.Repositories;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class MenuQueryRepository : IMenuQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public MenuQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<List<CategoryMenuDto>> GetCategoriesWithActiveDishesAsync(CancellationToken ct = default)
    {
        var rawCategories = await _context.Categories
            .AsNoTracking()
            .AsSplitQuery()
            .Where(c => c.IsActive)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new
            {
                c.Id,
                c.CategoryCode,
                c.CategoryName,
                c.JapaneseName,
                c.Description,
                c.IconName,
                c.ImageUrl,
                c.DisplayOrder,
                c.IsActive,
                Dishes = c.MenuItems
                    .Where(m => m.IsAvailable)
                    .OrderBy(m => m.BasePrice)
                    .Select(m => new
                    {
                        m.Id,
                        m.Code,
                        m.Name,
                        m.JapaneseName,
                        m.Slug,
                        m.Description,
                        m.BasePrice,
                        m.OriginalPrice,
                        m.ImageUrl,
                        m.Tags,
                        m.Ingredients,
                        m.SpiceLevel,
                        m.Calories,
                        m.EstimatedPrepMinutes,
                        m.IsFeatured,
                        m.IsAvailable,
                        AverageRating = _context.MenuItemReviews
                            .Where(r => r.MenuItemId == m.Id && r.IsApproved)
                            .Select(r => (double?)r.Rating)
                            .Average() ?? 5.0,
                        TotalReviews = _context.MenuItemReviews
                            .Count(r => r.MenuItemId == m.Id && r.IsApproved),
                        ModifierGroups = m.ModifierGroups
                            .Where(mg => mg.ModifierGroup.IsActive)
                            .OrderBy(mg => mg.DisplayOrder)
                            .Select(mg => new ModifierGroupDto
                            {
                                GroupId = mg.ModifierGroup.Id,
                                GroupCode = mg.ModifierGroup.GroupCode,
                                GroupName = mg.ModifierGroup.GroupName,
                                IsRequired = mg.ModifierGroup.MinSelection > 0,
                                MinSelection = mg.ModifierGroup.MinSelection,
                                MaxSelection = mg.ModifierGroup.MaxSelection,
                                Options = mg.ModifierGroup.Options
                                    .Where(o => o.IsAvailable)
                                    .OrderBy(o => o.DisplayOrder)
                                    .Select(o => new ModifierOptionDto
                                    {
                                        OptionId = o.Id,
                                        OptionCode = o.OptionCode,
                                        OptionName = o.OptionName,
                                        PriceAdjustment = o.PriceAdjustment,
                                        IsDefault = o.IsDefault,
                                        IsAvailable = o.IsAvailable
                                    }).ToList()
                            }).ToList()
                    }).ToList()
            })
            .ToListAsync(ct);

        return rawCategories.Select(c => new CategoryMenuDto
        {
            CategoryId = c.Id,
            CategoryCode = c.CategoryCode,
            CategoryName = c.CategoryName,
            JapaneseName = c.JapaneseName,
            Description = c.Description,
            IconName = c.IconName,
            ImageUrl = c.ImageUrl,
            DisplayOrder = c.DisplayOrder,
            IsActive = c.IsActive,
            Dishes = c.Dishes.Select(m => new DishSummaryDto
            {
                DishId = m.Id,
                Code = m.Code,
                Name = m.Name,
                JapaneseName = m.JapaneseName,
                Slug = m.Slug,
                Description = m.Description,
                ShortDescription = BuildShortDescription(m.Description),
                BasePrice = m.BasePrice,
                OriginalPrice = m.OriginalPrice,
                ImageUrl = m.ImageUrl,
                Tags = ParseStringList(m.Tags),
                Ingredients = ParseStringList(m.Ingredients),
                SpiceLevel = m.SpiceLevel,
                Calories = m.Calories,
                EstimatedPrepMinutes = m.EstimatedPrepMinutes,
                IsFeatured = m.IsFeatured,
                IsAvailable = m.IsAvailable,
                AverageRating = Math.Round(m.AverageRating, 1),
                TotalReviews = m.TotalReviews,
                ModifierGroups = m.ModifierGroups
            }).ToList()
        }).ToList();
    }

    public async Task<PagedResult<DishCardDto>> GetPagedDishesAsync(
        DishFilterQueryDto filter,
        CancellationToken ct = default)
    {
        var query = _context.MenuItems
            .AsNoTracking()
            .AsSplitQuery();

        if (!filter.IncludeUnavailable)
        {
            query = query.Where(m => m.IsAvailable && m.Category.IsActive);
        }

        if (filter.CategoryId.HasValue && filter.CategoryId.Value > 0)
        {
            query = query.Where(m => m.CategoryId == filter.CategoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.CategoryCode))
        {
            var normalizedCatCode = filter.CategoryCode.Trim().ToUpperInvariant();
            query = query.Where(m => m.Category.CategoryCode.ToUpper() == normalizedCatCode);
        }

        if (filter.IsFeatured.HasValue)
        {
            query = query.Where(m => m.IsFeatured == filter.IsFeatured.Value);
        }

        if (filter.MinPrice.HasValue)
        {
            query = query.Where(m => m.BasePrice >= filter.MinPrice.Value);
        }

        if (filter.MaxPrice.HasValue)
        {
            query = query.Where(m => m.BasePrice <= filter.MaxPrice.Value);
        }

        if (!string.IsNullOrWhiteSpace(filter.Keyword))
        {
            var term = filter.Keyword.Trim().ToLower();
            query = query.Where(m => m.Name.ToLower().Contains(term)
                                  || (m.JapaneseName != null && m.JapaneseName.ToLower().Contains(term))
                                  || m.Code.ToLower().Contains(term)
                                  || (m.Description != null && m.Description.ToLower().Contains(term))
                                  || (m.Tags != null && m.Tags.ToLower().Contains(term)));
        }

        if (!string.IsNullOrWhiteSpace(filter.Tag))
        {
            var tagTerm = filter.Tag.Trim().ToLower();
            query = query.Where(m => m.Tags != null && m.Tags.ToLower().Contains(tagTerm));
        }

        // Dynamic Sorting BEFORE paging (Always include .ThenBy(m => m.Id) for deterministic split-query paging)
        query = filter.SortBy?.ToLower() switch
        {
            "price_desc" => query.OrderByDescending(m => m.BasePrice).ThenBy(m => m.Id),
            "price_asc" => query.OrderBy(m => m.BasePrice).ThenBy(m => m.Id),
            "name_desc" => query.OrderByDescending(m => m.Name).ThenBy(m => m.Id),
            "name_asc" => query.OrderBy(m => m.Name).ThenBy(m => m.Id),
            "featured" => query.OrderByDescending(m => m.IsFeatured).ThenBy(m => m.BasePrice).ThenBy(m => m.Id),
            "rating_desc" => query
                .OrderByDescending(m => _context.MenuItemReviews
                    .Where(r => r.MenuItemId == m.Id && r.IsApproved)
                    .Select(r => (double?)r.Rating)
                    .Average() ?? 5.0)
                .ThenByDescending(m => m.IsFeatured)
                .ThenBy(m => m.BasePrice)
                .ThenBy(m => m.Id),
            "popular" => query
                .OrderByDescending(m => _context.MenuItemReviews
                    .Count(r => r.MenuItemId == m.Id && r.IsApproved))
                .ThenByDescending(m => m.IsFeatured)
                .ThenBy(m => m.BasePrice)
                .ThenBy(m => m.Id),
            _ => query.OrderBy(m => m.BasePrice).ThenBy(m => m.Id)
        };

        var totalCount = await query.CountAsync(ct);

        var rawItems = await query
            .ApplyPaging(filter.Page, filter.PageSize)
            .Select(m => new
            {
                m.Id,
                m.CategoryId,
                CategoryCode = m.Category.CategoryCode,
                CategoryName = m.Category.CategoryName,
                m.Code,
                m.Name,
                m.JapaneseName,
                m.Slug,
                m.Description,
                m.BasePrice,
                m.OriginalPrice,
                m.ImageUrl,
                m.Tags,
                m.Ingredients,
                m.SpiceLevel,
                m.Calories,
                m.EstimatedPrepMinutes,
                m.IsFeatured,
                m.IsAvailable,
                AverageRating = _context.MenuItemReviews
                    .Where(r => r.MenuItemId == m.Id && r.IsApproved)
                    .Select(r => (double?)r.Rating)
                    .Average() ?? 5.0,
                TotalReviews = _context.MenuItemReviews
                    .Count(r => r.MenuItemId == m.Id && r.IsApproved),
                ModifierGroups = m.ModifierGroups
                    .Where(mg => mg.ModifierGroup.IsActive)
                    .OrderBy(mg => mg.DisplayOrder)
                    .Select(mg => new ModifierGroupDto
                    {
                        GroupId = mg.ModifierGroup.Id,
                        GroupCode = mg.ModifierGroup.GroupCode,
                        GroupName = mg.ModifierGroup.GroupName,
                        IsRequired = mg.ModifierGroup.MinSelection > 0,
                        MinSelection = mg.ModifierGroup.MinSelection,
                        MaxSelection = mg.ModifierGroup.MaxSelection,
                        Options = mg.ModifierGroup.Options
                            .Where(o => o.IsAvailable)
                            .OrderBy(o => o.DisplayOrder)
                            .Select(o => new ModifierOptionDto
                            {
                                OptionId = o.Id,
                                OptionCode = o.OptionCode,
                                OptionName = o.OptionName,
                                PriceAdjustment = o.PriceAdjustment,
                                IsDefault = o.IsDefault,
                                IsAvailable = o.IsAvailable
                            }).ToList()
                    }).ToList()
            })
            .ToListAsync(ct);

        var items = rawItems.Select(m => new DishCardDto
        {
            DishId = m.Id,
            CategoryId = m.CategoryId,
            CategoryCode = m.CategoryCode,
            CategoryName = m.CategoryName,
            Code = m.Code,
            Name = m.Name,
            JapaneseName = m.JapaneseName,
            Slug = m.Slug,
            Description = m.Description,
            ShortDescription = BuildShortDescription(m.Description),
            BasePrice = m.BasePrice,
            OriginalPrice = m.OriginalPrice,
            ImageUrl = m.ImageUrl,
            Tags = ParseStringList(m.Tags),
            Ingredients = ParseStringList(m.Ingredients),
            SpiceLevel = m.SpiceLevel,
            Calories = m.Calories,
            EstimatedPrepMinutes = m.EstimatedPrepMinutes,
            IsFeatured = m.IsFeatured,
            IsAvailable = m.IsAvailable,
            AverageRating = Math.Round(m.AverageRating, 1),
            TotalReviews = m.TotalReviews,
            ModifierGroups = m.ModifierGroups
        }).ToList();

        return new PagedResult<DishCardDto>(items, totalCount, filter.Page, filter.PageSize);
    }

    public async Task<DishDetailDto?> GetDishDetailByCodeAsync(string code, CancellationToken ct = default)
    {
        var normalizedCode = code.Trim().ToUpper();
        var normalizedSlug = code.Trim().ToLower();

        var raw = await _context.MenuItems
            .AsNoTracking()
            .AsSplitQuery()
            .Where(m => (m.Code.ToUpper() == normalizedCode || (m.Slug != null && m.Slug.ToLower() == normalizedSlug)) && m.IsAvailable)
            .Select(m => new
            {
                m.Id,
                m.CategoryId,
                CategoryCode = m.Category.CategoryCode,
                CategoryName = m.Category.CategoryName,
                m.Code,
                m.Name,
                m.JapaneseName,
                m.Slug,
                m.Description,
                m.BasePrice,
                m.OriginalPrice,
                m.ImageUrl,
                m.Tags,
                m.Ingredients,
                m.SpiceLevel,
                m.Calories,
                m.EstimatedPrepMinutes,
                m.IsFeatured,
                m.IsAvailable,
                AverageRating = _context.MenuItemReviews
                    .Where(r => r.MenuItemId == m.Id && r.IsApproved)
                    .Select(r => (double?)r.Rating)
                    .Average() ?? 5.0,
                TotalReviews = _context.MenuItemReviews
                    .Count(r => r.MenuItemId == m.Id && r.IsApproved),
                ModifierGroups = m.ModifierGroups
                    .Where(mg => mg.ModifierGroup.IsActive)
                    .OrderBy(mg => mg.DisplayOrder)
                    .Select(mg => new ModifierGroupDto
                    {
                        GroupId = mg.ModifierGroup.Id,
                        GroupCode = mg.ModifierGroup.GroupCode,
                        GroupName = mg.ModifierGroup.GroupName,
                        IsRequired = mg.ModifierGroup.MinSelection > 0,
                        MinSelection = mg.ModifierGroup.MinSelection,
                        MaxSelection = mg.ModifierGroup.MaxSelection,
                        Options = mg.ModifierGroup.Options
                            .Where(o => o.IsAvailable)
                            .OrderBy(o => o.DisplayOrder)
                            .Select(o => new ModifierOptionDto
                            {
                                OptionId = o.Id,
                                OptionCode = o.OptionCode,
                                OptionName = o.OptionName,
                                PriceAdjustment = o.PriceAdjustment,
                                IsDefault = o.IsDefault,
                                IsAvailable = o.IsAvailable
                            }).ToList()
                    }).ToList()
            })
            .FirstOrDefaultAsync(ct);

        if (raw == null)
            return null;

        return new DishDetailDto
        {
            DishId = raw.Id,
            CategoryId = raw.CategoryId,
            CategoryCode = raw.CategoryCode,
            CategoryName = raw.CategoryName,
            Code = raw.Code,
            Name = raw.Name,
            JapaneseName = raw.JapaneseName,
            Slug = raw.Slug,
            Description = raw.Description,
            BasePrice = raw.BasePrice,
            OriginalPrice = raw.OriginalPrice,
            ImageUrl = raw.ImageUrl,
            Tags = ParseStringList(raw.Tags),
            Ingredients = ParseStringList(raw.Ingredients),
            SpiceLevel = raw.SpiceLevel,
            Calories = raw.Calories,
            EstimatedPrepMinutes = raw.EstimatedPrepMinutes,
            IsFeatured = raw.IsFeatured,
            IsAvailable = raw.IsAvailable,
            AverageRating = Math.Round(raw.AverageRating, 1),
            TotalReviews = raw.TotalReviews,
            ModifierGroups = raw.ModifierGroups
        };
    }

    public async Task<List<string>> CheckDishAvailabilityAsync(List<int> dishIds, CancellationToken ct = default)
    {
        if (dishIds == null || !dishIds.Any())
            return new List<string>();

        return await _context.MenuItems
            .AsNoTracking()
            .Where(m => dishIds.Contains(m.Id) && !m.IsAvailable)
            .Select(m => m.Name)
            .ToListAsync(ct);
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
                // Fallback to comma-separated
            }
        }

        return trimmed
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
    }

    private static string? BuildShortDescription(string? description)
    {
        if (string.IsNullOrWhiteSpace(description))
            return null;

        var trimmed = description.Trim();
        return trimmed.Length <= 140 ? trimmed : $"{trimmed[..137]}...";
    }
}
