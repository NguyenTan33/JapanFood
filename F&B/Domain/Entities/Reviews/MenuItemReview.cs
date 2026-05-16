using Domain.Entities.Common;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Domain.Entities.Reviews;

public class MenuItemReview : BaseAuditableEntity
{
    public int UserId { get; protected set; }
    public int MenuItemId { get; protected set; }
    public int OrderId { get; protected set; }
    public int Rating { get; protected set; }
    public string? Comment { get; protected set; }
    public bool IsApproved { get; protected set; } = false;
    public DateTime? ApprovedAt { get; protected set; }
    public int? ApprovedByUserId { get; protected set; }
    public string? RejectionReason { get; protected set; }
    public int LikesCount { get; protected set; } = 0;
    public string? ManagerReply { get; protected set; }
    public DateTime? RepliedAt { get; protected set; }
    public int? RepliedByUserId { get; protected set; }

    public virtual User? User { get; protected set; }
    public virtual MenuItem? MenuItem { get; protected set; }
    public virtual Order? Order { get; protected set; }
    public virtual User? ApprovedByUser { get; protected set; }
    public virtual User? RepliedByUser { get; protected set; }

    protected MenuItemReview() { }

    public MenuItemReview(int userId, int menuItemId, int orderId, int rating, string? comment = null)
    {
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");
        if (menuItemId <= 0)
            throw new BusinessException("Mã món ăn không hợp lệ.");
        if (orderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");
        if (rating < 1 || rating > 5)
            throw new BusinessException("Điểm đánh giá phải từ 1 đến 5 sao.");

        UserId = userId;
        MenuItemId = menuItemId;
        OrderId = orderId;
        Rating = rating;
        Comment = comment?.Trim();
        IsApproved = false; // Cần kiểm duyệt trước khi hiển thị công khai
    }

    public void Approve(int managerUserId)
    {
        if (managerUserId <= 0)
            throw new BusinessException("Mã quản lý phê duyệt không hợp lệ.");

        IsApproved = true;
        ApprovedByUserId = managerUserId;
        ApprovedAt = DateTime.UtcNow;
        RejectionReason = null;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reject(int managerUserId, string reason)
    {
        if (managerUserId <= 0)
            throw new BusinessException("Mã quản lý không hợp lệ.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do từ chối đánh giá không được để trống.");

        IsApproved = false;
        ApprovedByUserId = managerUserId;
        RejectionReason = reason.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateReview(int rating, string? comment)
    {
        if (rating < 1 || rating > 5)
            throw new BusinessException("Điểm đánh giá phải từ 1 đến 5 sao.");

        Rating = rating;
        Comment = comment?.Trim();
        IsApproved = false; // Sửa xong phải kiểm duyệt lại
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetLikesCount(int likesCount)
    {
        if (likesCount < 0)
            throw new BusinessException("Số lượt thích không được âm.");
        LikesCount = likesCount;
    }

    public void Reply(int managerUserId, string replyText)
    {
        if (managerUserId <= 0)
            throw new BusinessException("Mã quản lý phản hồi không hợp lệ.");
        if (string.IsNullOrWhiteSpace(replyText))
            throw new BusinessException("Nội dung phản hồi không được để trống.");

        var trimmed = replyText.Trim();
        if (trimmed.Length > 1000)
            throw new BusinessException("Nội dung phản hồi không được vượt quá 1000 ký tự.");

        ManagerReply = trimmed;
        RepliedByUserId = managerUserId;
        RepliedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
