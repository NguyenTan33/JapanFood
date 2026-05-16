using Domain.Entities.Reviews;
using Domain.Exceptions;

namespace Domain.UnitTests.Reviews;

public class MenuItemReviewTests
{
    [Fact]
    public void Constructor_ValidRating_ShouldCreatePendingReview()
    {
        var review = new MenuItemReview(userId: 1, menuItemId: 10, orderId: 50, rating: 5, "Mì rất ngon!");

        Assert.Equal(1, review.UserId);
        Assert.Equal(10, review.MenuItemId);
        Assert.Equal(50, review.OrderId);
        Assert.Equal(5, review.Rating);
        Assert.Equal("Mì rất ngon!", review.Comment);
        Assert.False(review.IsApproved); // Default unapproved
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    public void Constructor_InvalidRating_ShouldThrowBusinessException(int rating)
    {
        var ex = Assert.Throws<BusinessException>(() =>
            new MenuItemReview(userId: 1, menuItemId: 10, orderId: 50, rating: rating));

        Assert.Contains("từ 1 đến 5 sao", ex.Message);
    }

    [Fact]
    public void Approve_ValidManager_ShouldMarkAsApproved()
    {
        var review = new MenuItemReview(userId: 1, menuItemId: 10, orderId: 50, rating: 5);
        review.Approve(managerUserId: 99);

        Assert.True(review.IsApproved);
        Assert.Equal(99, review.ApprovedByUserId);
        Assert.NotNull(review.ApprovedAt);
    }

    [Fact]
    public void Reject_WithReason_ShouldMarkAsRejected()
    {
        var review = new MenuItemReview(userId: 1, menuItemId: 10, orderId: 50, rating: 1, "Spam text");
        review.Reject(managerUserId: 99, "Nội dung vi phạm quy chuẩn cộng đồng.");

        Assert.False(review.IsApproved);
        Assert.Equal("Nội dung vi phạm quy chuẩn cộng đồng.", review.RejectionReason);
    }

    [Fact]
    public void Reply_ValidManagerAndText_ShouldPersistReplyAndAuditFields()
    {
        var review = new MenuItemReview(userId: 1, menuItemId: 10, orderId: 50, rating: 5, "Rất ngon");
        review.Reply(managerUserId: 7, "  Cảm ơn quý khách đã ủng hộ nhà hàng!  ");

        Assert.Equal("Cảm ơn quý khách đã ủng hộ nhà hàng!", review.ManagerReply);
        Assert.Equal(7, review.RepliedByUserId);
        Assert.NotNull(review.RepliedAt);
        Assert.NotNull(review.UpdatedAt);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Reply_EmptyText_ShouldThrowBusinessException(string emptyReply)
    {
        var review = new MenuItemReview(userId: 1, menuItemId: 10, orderId: 50, rating: 5);
        var ex = Assert.Throws<BusinessException>(() => review.Reply(7, emptyReply));
        Assert.Contains("không được để trống", ex.Message);
    }

    [Fact]
    public void Reply_TooLong_ShouldThrowBusinessException()
    {
        var review = new MenuItemReview(userId: 1, menuItemId: 10, orderId: 50, rating: 5);
        var ex = Assert.Throws<BusinessException>(() => review.Reply(7, new string('a', 1001)));
        Assert.Contains("1000 ký tự", ex.Message);
    }
}
