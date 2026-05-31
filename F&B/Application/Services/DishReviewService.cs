using Application.Common.Validation;
using Application.DTOs.Reviews;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Entities.Reviews;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class DishReviewService : IDishReviewService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IDishReviewQueryRepository _dishReviewQueryRepo;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<DishReviewService> _logger;

    public DishReviewService(
        IUnitOfWork unitOfWork,
        IDishReviewQueryRepository dishReviewQueryRepo,
        IValidationFactory validationFactory,
        ILogger<DishReviewService> logger)
    {
        _unitOfWork = unitOfWork;
        _dishReviewQueryRepo = dishReviewQueryRepo;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<ReviewViewDto> SubmitReviewAsync(CreateReviewRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 2. Verified purchase and review duplication check via query repository
        var canReview = await _dishReviewQueryRepo.CanUserReviewDishAsync(
            request.UserId,
            request.MenuItemId,
            request.OrderId,
            ct);

        if (!canReview)
        {
            throw new BusinessException("Đơn hàng chưa hoàn tất, đã quá thời hạn đánh giá 15 ngày, hoặc món ăn này đã được đánh giá trước đó.");
        }

        // 3. Create review entity
        var review = new MenuItemReview(
            request.UserId,
            request.MenuItemId,
            request.OrderId,
            request.Rating,
            request.Comment);

        _unitOfWork.Context.MenuItemReviews.Add(review);
        await _unitOfWork.SaveChangesAsync(ct);

        // Fetch User & MenuItem to populate view DTO
        var user = await _unitOfWork.Context.Users.FirstOrDefaultAsync(u => u.UserId == request.UserId, ct);
        var dishName = await _unitOfWork.Context.MenuItems
            .Where(m => m.Id == request.MenuItemId)
            .Select(m => m.Name)
            .FirstOrDefaultAsync(ct) ?? string.Empty;

        var displayName = !string.IsNullOrWhiteSpace(user?.FullName) ? user.FullName : "Khách hàng";

        return new ReviewViewDto
        {
            Id = review.Id,
            ReviewId = review.Id,
            MenuItemId = review.MenuItemId,
            DishName = dishName,
            UserId = review.UserId,
            CustomerName = displayName,
            UserName = displayName,
            UserAvatar = user?.AvatarUrl,
            Rating = review.Rating,
            Comment = review.Comment,
            IsVerifiedDining = true,
            LikesCount = review.LikesCount,
            IsApproved = review.IsApproved,
            RejectionReason = review.RejectionReason,
            ManagerReply = review.ManagerReply,
            RepliedAt = review.RepliedAt,
            RepliedByUserId = review.RepliedByUserId,
            CreatedAt = review.CreatedAt
        };
    }

    public async Task<List<PendingReviewOrderDto>> GetPendingReviewOrdersAsync(int userId, CancellationToken ct = default)
    {
        return await _dishReviewQueryRepo.GetPendingReviewOrdersAsync(userId, ct);
    }

    public async Task<bool> ApproveReviewAsync(int reviewId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã quản lý phê duyệt không hợp lệ.");

        var review = await _unitOfWork.Context.MenuItemReviews.FirstOrDefaultAsync(r => r.Id == reviewId, ct);
        if (review == null)
            throw new NotFoundException($"Không tìm thấy đánh giá #{reviewId}.");

        review.Approve(staffUserId);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> RejectReviewAsync(int reviewId, string reason, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã quản lý không hợp lệ.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do từ chối đánh giá không được để trống.");

        var review = await _unitOfWork.Context.MenuItemReviews.FirstOrDefaultAsync(r => r.Id == reviewId, ct);
        if (review == null)
            throw new NotFoundException($"Không tìm thấy đánh giá #{reviewId}.");

        review.Reject(staffUserId, reason);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteReviewAsync(int reviewId, CancellationToken ct = default)
    {
        var review = await _unitOfWork.Context.MenuItemReviews.FirstOrDefaultAsync(r => r.Id == reviewId, ct);
        if (review == null)
            throw new NotFoundException($"Không tìm thấy đánh giá #{reviewId}.");

        _unitOfWork.Context.MenuItemReviews.Remove(review);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<ReviewViewDto> ReplyReviewAsync(int reviewId, ReplyReviewRequestDto request, int managerUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (managerUserId <= 0)
            throw new BusinessException("Mã quản lý phản hồi không hợp lệ.");

        var review = await _unitOfWork.Context.MenuItemReviews
            .Include(r => r.User)
            .Include(r => r.MenuItem)
            .FirstOrDefaultAsync(r => r.Id == reviewId, ct);

        if (review == null)
            throw new NotFoundException($"Không tìm thấy đánh giá #{reviewId}.");

        review.Reply(managerUserId, request.Reply);
        await _unitOfWork.SaveChangesAsync(ct);

        var replierName = await _unitOfWork.Context.Users
            .AsNoTracking()
            .Where(u => u.UserId == managerUserId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(ct);

        var customerDisplay = !string.IsNullOrWhiteSpace(review.User?.FullName) ? review.User.FullName : "Khách hàng JapanFood";

        return new ReviewViewDto
        {
            Id = review.Id,
            ReviewId = review.Id,
            MenuItemId = review.MenuItemId,
            DishName = review.MenuItem?.Name ?? string.Empty,
            UserId = review.UserId,
            CustomerName = customerDisplay,
            UserName = customerDisplay,
            UserAvatar = review.User?.AvatarUrl,
            Rating = review.Rating,
            Comment = review.Comment,
            IsVerifiedDining = true,
            LikesCount = review.LikesCount,
            IsApproved = review.IsApproved,
            RejectionReason = review.RejectionReason,
            ManagerReply = review.ManagerReply,
            RepliedAt = review.RepliedAt,
            RepliedByUserId = review.RepliedByUserId,
            RepliedByName = replierName,
            CreatedAt = review.CreatedAt
        };
    }
}
