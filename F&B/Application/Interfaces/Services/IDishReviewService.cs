using Application.DTOs.Reviews;

namespace Application.Interfaces.Services;

public interface IDishReviewService
{
    Task<ReviewViewDto> SubmitReviewAsync(CreateReviewRequestDto request, CancellationToken ct = default);
    Task<List<PendingReviewOrderDto>> GetPendingReviewOrdersAsync(int userId, CancellationToken ct = default);
    Task<bool> ApproveReviewAsync(int reviewId, int staffUserId, CancellationToken ct = default);
    Task<bool> RejectReviewAsync(int reviewId, string reason, int staffUserId, CancellationToken ct = default);
    Task<bool> DeleteReviewAsync(int reviewId, CancellationToken ct = default);
    Task<ReviewViewDto> ReplyReviewAsync(int reviewId, ReplyReviewRequestDto request, int managerUserId, CancellationToken ct = default);
}
