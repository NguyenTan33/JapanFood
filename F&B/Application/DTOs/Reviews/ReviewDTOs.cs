namespace Application.DTOs.Reviews;

public class ReviewViewDto
{
    public int Id { get; set; }
    public int ReviewId { get; set; }
    public int MenuItemId { get; set; }
    public string DishName { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string CustomerName { get; set; } = string.Empty;
    public string UserName { get; set; } = string.Empty;
    public string? UserAvatar { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
    public bool IsVerifiedDining { get; set; } = true;
    public int LikesCount { get; set; }
    public bool IsApproved { get; set; }
    public string? RejectionReason { get; set; }
    public string? ManagerReply { get; set; }
    public DateTime? RepliedAt { get; set; }
    public int? RepliedByUserId { get; set; }
    public string? RepliedByName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateReviewRequestDto
{
    public int UserId { get; set; }
    public int MenuItemId { get; set; }
    public int OrderId { get; set; }
    public int Rating { get; set; }
    public string? Comment { get; set; }
}

public class PendingReviewOrderDto
{
    public int OrderId { get; set; }
    public string OrderCode { get; set; } = string.Empty;
    public DateTime CompletedAt { get; set; }
    public int RemainingDays { get; set; }
    public bool IsExpired { get; set; }
    public List<PendingReviewItemDto> Items { get; set; } = new();
}

public class PendingReviewItemDto
{
    public int MenuItemId { get; set; }
    public string DishName { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public decimal Price { get; set; }
}

public class ReviewManageCountsDto
{
    public int Total { get; set; }
    public int Pending { get; set; }
    public int Approved { get; set; }
    public int Rejected { get; set; }
    public int Unreplied { get; set; }
}

public class ReviewManagePagedResultDto
{
    public List<ReviewViewDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public ReviewManageCountsDto Counts { get; set; } = new();
}

public class ReviewManageFilterDto
{
    public string? Status { get; set; }
    public int? Rating { get; set; }
    public int? MenuItemId { get; set; }
    public bool? HasReply { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class ReplyReviewRequestDto
{
    public string Reply { get; set; } = string.Empty;
}
