using Application.Common.Extensions;
using Application.Common.Models;
using Application.DTOs.Reviews;
using Application.Interfaces.Repositories;
using Domain.Entities.Menu;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class DishReviewQueryRepository : IDishReviewQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public DishReviewQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<bool> CanUserReviewDishAsync(
        int userId,
        int menuItemId,
        int orderId,
        CancellationToken ct = default)
    {
        var order = await _context.Orders
            .AsNoTracking()
            .FirstOrDefaultAsync(o => o.Id == orderId
                        && o.UserId == userId
                        && o.Status == OrderStatus.Completed
                        && o.Items.Any(i => i.MenuItemId == menuItemId && i.ItemStatus != OrderItemStatus.Cancelled), ct);

        if (order == null)
            return false;

        // Quy tắc 15 ngày: Quá 15 ngày kể từ ngày hoàn thành đơn thì hết hạn đánh giá
        var completedTime = order.CompletedAt ?? order.UpdatedAt ?? order.CreatedAt;
        if (completedTime < DateTime.UtcNow.AddDays(-15))
        {
            return false;
        }

        var alreadyReviewed = await _context.MenuItemReviews
            .AsNoTracking()
            .AnyAsync(r => r.OrderId == orderId && r.UserId == userId && r.MenuItemId == menuItemId, ct);

        return !alreadyReviewed;
    }

    public async Task<List<PendingReviewOrderDto>> GetPendingReviewOrdersAsync(
        int userId,
        CancellationToken ct = default)
    {
        var cutoff15Days = DateTime.UtcNow.AddDays(-15);

        // Lấy các đơn hàng Completed của người dùng
        var completedOrders = await _context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .Where(o => o.UserId == userId && o.Status == OrderStatus.Completed)
            .OrderByDescending(o => o.CompletedAt ?? o.CreatedAt)
            .Take(10)
            .ToListAsync(ct);

        if (!completedOrders.Any())
            return new List<PendingReviewOrderDto>();

        var orderIds = completedOrders.Select(o => o.Id).ToList();

        // Lấy danh sách các món đã đánh giá của người dùng cho các đơn này
        var reviewedPairs = await _context.MenuItemReviews
            .AsNoTracking()
            .Where(r => r.UserId == userId && orderIds.Contains(r.OrderId))
            .Select(r => new { r.OrderId, r.MenuItemId })
            .ToListAsync(ct);

        var reviewedSet = new HashSet<string>(reviewedPairs.Select(p => $"{p.OrderId}_{p.MenuItemId}"));

        var allMenuItemIds = completedOrders.SelectMany(o => o.Items.Select(i => i.MenuItemId)).Distinct().ToList();
        var menuItemsDict = await _context.MenuItems
            .AsNoTracking()
            .Where(m => allMenuItemIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, m => new { m.Name, m.ImageUrl, Price = m.BasePrice }, ct);

        var result = new List<PendingReviewOrderDto>();

        foreach (var order in completedOrders)
        {
            var completedTime = order.CompletedAt ?? order.UpdatedAt ?? order.CreatedAt;
            var isExpired = completedTime < cutoff15Days;
            var daysPassed = (int)(DateTime.UtcNow - completedTime).TotalDays;
            var remainingDays = Math.Max(0, 15 - daysPassed);

            var unreviewedItems = order.Items
                .Where(i => i.ItemStatus != OrderItemStatus.Cancelled && !reviewedSet.Contains($"{order.Id}_{i.MenuItemId}"))
                .GroupBy(i => i.MenuItemId) // Tránh trùng món trong 1 đơn
                .Select(g => g.First())
                .Select(i => new PendingReviewItemDto
                {
                    MenuItemId = i.MenuItemId,
                    DishName = menuItemsDict.TryGetValue(i.MenuItemId, out var m) ? m.Name : $"Món #{i.MenuItemId}",
                    ImageUrl = menuItemsDict.TryGetValue(i.MenuItemId, out var mi) ? mi.ImageUrl : null,
                    Price = i.UnitPrice
                })
                .ToList();

            if (unreviewedItems.Any())
            {
                result.Add(new PendingReviewOrderDto
                {
                    OrderId = order.Id,
                    OrderCode = order.OrderNumber,
                    CompletedAt = completedTime,
                    RemainingDays = remainingDays,
                    IsExpired = isExpired,
                    Items = unreviewedItems
                });
            }
        }

        return result;
    }

    public async Task<PagedResult<ReviewViewDto>> GetPagedReviewsByDishIdAsync(
        int menuItemId,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default)
    {
        var query = _context.MenuItemReviews
            .AsNoTracking()
            .Where(r => r.MenuItemId == menuItemId && r.IsApproved)
            .OrderByDescending(r => r.CreatedAt);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .ApplyPaging(page, pageSize)
            .Select(r => new ReviewViewDto
            {
                Id = r.Id,
                ReviewId = r.Id,
                MenuItemId = r.MenuItemId,
                DishName = r.MenuItem != null ? r.MenuItem.Name : string.Empty,
                UserId = r.UserId,
                CustomerName = r.User != null ? r.User.FullName : "Khách hàng JapanFood",
                UserName = r.User != null ? r.User.FullName : "Khách hàng JapanFood",
                UserAvatar = r.User != null ? r.User.AvatarUrl : null,
                Rating = r.Rating,
                Comment = r.Comment,
                IsVerifiedDining = true,
                LikesCount = r.LikesCount,
                IsApproved = r.IsApproved,
                RejectionReason = r.RejectionReason,
                ManagerReply = r.ManagerReply,
                RepliedAt = r.RepliedAt,
                RepliedByUserId = r.RepliedByUserId,
                RepliedByName = r.RepliedByUser != null ? r.RepliedByUser.FullName : null,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync(ct);

        return new PagedResult<ReviewViewDto>(items, totalCount, page, pageSize);
    }

    public async Task<PagedResult<ReviewViewDto>> GetAllApprovedReviewsAsync(
        bool? featured = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        var baseQuery = _context.MenuItemReviews
            .AsNoTracking()
            .Where(r => r.IsApproved);

        if (featured == true)
        {
            baseQuery = baseQuery.Where(r => r.Rating >= 4);
        }

        var orderedQuery = featured == true
            ? baseQuery.OrderByDescending(r => r.Rating).ThenByDescending(r => r.LikesCount).ThenByDescending(r => r.CreatedAt)
            : baseQuery.OrderByDescending(r => r.CreatedAt);

        var totalCount = await orderedQuery.CountAsync(ct);

        var items = await orderedQuery
            .ApplyPaging(page, pageSize)
            .Select(r => new ReviewViewDto
            {
                Id = r.Id,
                ReviewId = r.Id,
                MenuItemId = r.MenuItemId,
                DishName = r.MenuItem != null ? r.MenuItem.Name : string.Empty,
                UserId = r.UserId,
                CustomerName = r.User != null ? r.User.FullName : "Khách hàng JapanFood",
                UserName = r.User != null ? r.User.FullName : "Khách hàng JapanFood",
                UserAvatar = r.User != null ? r.User.AvatarUrl : null,
                Rating = r.Rating,
                Comment = r.Comment,
                IsVerifiedDining = true,
                LikesCount = r.LikesCount,
                IsApproved = r.IsApproved,
                RejectionReason = r.RejectionReason,
                ManagerReply = r.ManagerReply,
                RepliedAt = r.RepliedAt,
                RepliedByUserId = r.RepliedByUserId,
                RepliedByName = r.RepliedByUser != null ? r.RepliedByUser.FullName : null,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync(ct);

        return new PagedResult<ReviewViewDto>(items, totalCount, page, pageSize);
    }

    public async Task<ReviewManagePagedResultDto> GetManagedReviewsAsync(
        ReviewManageFilterDto filter,
        CancellationToken ct = default)
    {
        filter ??= new ReviewManageFilterDto();
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize <= 0 ? 20 : filter.PageSize, 1, 100);

        var allReviews = _context.MenuItemReviews.AsNoTracking();

        var totalAll = await allReviews.CountAsync(ct);
        var approvedCount = await allReviews.CountAsync(r => r.IsApproved, ct);
        var pendingCount = await allReviews.CountAsync(r => !r.IsApproved && (r.RejectionReason == null || r.RejectionReason == ""), ct);
        var rejectedCount = await allReviews.CountAsync(r => !r.IsApproved && r.RejectionReason != null && r.RejectionReason != "", ct);
        var unrepliedCount = await allReviews.CountAsync(r => r.ManagerReply == null || r.ManagerReply == "", ct);

        var counts = new ReviewManageCountsDto
        {
            Total = totalAll,
            Pending = pendingCount,
            Approved = approvedCount,
            Rejected = rejectedCount,
            Unreplied = unrepliedCount
        };

        var query = allReviews;

        if (!string.IsNullOrWhiteSpace(filter.Status) &&
            !string.Equals(filter.Status.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
        {
            var statusUpper = filter.Status.Trim().ToUpperInvariant();
            if (statusUpper == "APPROVED")
            {
                query = query.Where(r => r.IsApproved);
            }
            else if (statusUpper == "PENDING")
            {
                query = query.Where(r => !r.IsApproved && (r.RejectionReason == null || r.RejectionReason == ""));
            }
            else if (statusUpper == "REJECTED")
            {
                query = query.Where(r => !r.IsApproved && r.RejectionReason != null && r.RejectionReason != "");
            }
        }

        if (filter.Rating.HasValue && filter.Rating.Value >= 1 && filter.Rating.Value <= 5)
        {
            query = query.Where(r => r.Rating == filter.Rating.Value);
        }

        if (filter.MenuItemId.HasValue && filter.MenuItemId.Value > 0)
        {
            query = query.Where(r => r.MenuItemId == filter.MenuItemId.Value);
        }

        if (filter.HasReply.HasValue)
        {
            query = filter.HasReply.Value
                ? query.Where(r => r.ManagerReply != null && r.ManagerReply != "")
                : query.Where(r => r.ManagerReply == null || r.ManagerReply == "");
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim().ToLowerInvariant();
            query = query.Where(r =>
                (r.Comment != null && r.Comment.ToLower().Contains(term)) ||
                (r.ManagerReply != null && r.ManagerReply.ToLower().Contains(term)) ||
                (r.MenuItem != null && r.MenuItem.Name.ToLower().Contains(term)) ||
                (r.User != null && r.User.FullName.ToLower().Contains(term)));
        }

        var totalCount = await query.CountAsync(ct);
        var totalPages = pageSize > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0;

        var items = await query
            .OrderByDescending(r => r.CreatedAt)
            .ThenByDescending(r => r.Id)
            .ApplyPaging(page, pageSize)
            .Select(r => new ReviewViewDto
            {
                Id = r.Id,
                ReviewId = r.Id,
                MenuItemId = r.MenuItemId,
                DishName = r.MenuItem != null ? r.MenuItem.Name : string.Empty,
                UserId = r.UserId,
                CustomerName = r.User != null ? r.User.FullName : "Khách hàng JapanFood",
                UserName = r.User != null ? r.User.FullName : "Khách hàng JapanFood",
                UserAvatar = r.User != null ? r.User.AvatarUrl : null,
                Rating = r.Rating,
                Comment = r.Comment,
                IsVerifiedDining = true,
                LikesCount = r.LikesCount,
                IsApproved = r.IsApproved,
                RejectionReason = r.RejectionReason,
                ManagerReply = r.ManagerReply,
                RepliedAt = r.RepliedAt,
                RepliedByUserId = r.RepliedByUserId,
                RepliedByName = r.RepliedByUser != null ? r.RepliedByUser.FullName : null,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync(ct);

        return new ReviewManagePagedResultDto
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages,
            Counts = counts
        };
    }
}
