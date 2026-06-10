using APIAuth.Services.Common;
using Application.DTOs.Reviews;
using Application.Services;
using Domain.Entities.Menu;
using Domain.Entities.Reviews;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class DishReviewServiceTests : TestApplicationBase
{
    private readonly DishReviewService _service;

    public DishReviewServiceTests()
    {
        _service = new DishReviewService(
            UnitOfWork,
            DishReviewQueryRepo,
            ValidationFactory,
            NullLogger<DishReviewService>.Instance);
    }

    private async Task<(int userId, int dishId, int orderId)> SeedCompletedOrderForUserAsync()
    {
        var user = await SeedUserAsync("Lê Văn C", "levanc@japanfood.vn", "0903334444");
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "REVIEW-DISH-1", "Sashimi Cá Hồi", 180000m);

        var order = new Order(OrderType.Takeaway, userId: user.UserId);
        order.AddItem(dish, 1);
        order.SendToKitchen();
        foreach (var item in order.Items)
        {
            item.MarkReady();
            item.MarkServed();
        }
        order.CompleteOrder();

        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        return (user.UserId, dish.Id, order.Id);
    }

    [Fact]
    public async Task SubmitReview_ValidRequest_CreatesReviewAndReturnsViewDto()
    {
        // Arrange
        var (userId, dishId, orderId) = await SeedCompletedOrderForUserAsync();

        var request = new CreateReviewRequestDto
        {
            UserId = userId,
            MenuItemId = dishId,
            OrderId = orderId,
            Rating = 5,
            Comment = "Món ăn rất tươi ngon, chuẩn vị Nhật!"
        };

        // Act
        var result = await _service.SubmitReviewAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.ReviewId > 0);
        Assert.Equal(5, result.Rating);
        Assert.Equal("Món ăn rất tươi ngon, chuẩn vị Nhật!", result.Comment);
        Assert.Equal("Lê Văn C", result.UserName);

        var savedReview = await Context.MenuItemReviews.FirstOrDefaultAsync(r => r.Id == result.ReviewId);
        Assert.NotNull(savedReview);
        Assert.False(savedReview.IsApproved); // Needs manager approval
        Assert.Equal(userId, savedReview.UserId);
        Assert.Equal(dishId, savedReview.MenuItemId);
    }

    [Fact]
    public async Task SubmitReview_DuplicateReview_ThrowsBusinessException()
    {
        // Arrange
        var (userId, dishId, orderId) = await SeedCompletedOrderForUserAsync();

        var request = new CreateReviewRequestDto
        {
            UserId = userId,
            MenuItemId = dishId,
            OrderId = orderId,
            Rating = 4,
            Comment = "Đánh giá lần đầu"
        };
        await _service.SubmitReviewAsync(request);

        var duplicateRequest = new CreateReviewRequestDto
        {
            UserId = userId,
            MenuItemId = dishId,
            OrderId = orderId,
            Rating = 5,
            Comment = "Đánh giá lần hai (trùng lặp)"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.SubmitReviewAsync(duplicateRequest));
        Assert.Contains("đã được đánh giá trước đó", ex.Message);
    }

    [Fact]
    public async Task SubmitReview_UnpurchasedDishOrIncompleteOrder_ThrowsBusinessException()
    {
        // Arrange: Order is not completed (still Pending)
        var user = await SeedUserAsync("Trần Thị D", "tranthid@japanfood.vn", "0905556666");
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "DISH-PENDING", "Tempura", 120000m);

        var order = new Order(OrderType.Takeaway, userId: user.UserId);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var request = new CreateReviewRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            OrderId = order.Id,
            Rating = 5,
            Comment = "Chưa hoàn tất đơn nhưng đã đánh giá"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.SubmitReviewAsync(request));
        Assert.Contains("Đơn hàng chưa hoàn tất", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    public async Task SubmitReview_InvalidRating_FailsValidation_ThrowsBusinessException(int invalidRating)
    {
        // Arrange
        var request = new CreateReviewRequestDto
        {
            UserId = 1,
            MenuItemId = 1,
            OrderId = 1,
            Rating = invalidRating,
            Comment = "Đánh giá sao không hợp lệ"
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.SubmitReviewAsync(request));
        Assert.Contains("Số sao đánh giá phải từ 1 đến 5 sao", ex.Message);
    }

    [Fact]
    public async Task SubmitReview_InvalidUserId_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new CreateReviewRequestDto
        {
            UserId = 0,
            MenuItemId = 1,
            OrderId = 1,
            Rating = 5
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.SubmitReviewAsync(request));
        Assert.Contains("Mã người dùng không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ApproveReview_ValidReview_MarksApproved()
    {
        // Arrange
        var (userId, dishId, orderId) = await SeedCompletedOrderForUserAsync();
        var review = new MenuItemReview(userId, dishId, orderId, 5, "Món ngon tuyệt vời");
        Context.MenuItemReviews.Add(review);
        await Context.SaveChangesAsync();

        int managerUserId = 2;

        // Act
        var success = await _service.ApproveReviewAsync(review.Id, managerUserId);

        // Assert
        Assert.True(success);
        var updated = await Context.MenuItemReviews.FirstOrDefaultAsync(r => r.Id == review.Id);
        Assert.NotNull(updated);
        Assert.True(updated.IsApproved);
        Assert.Equal(managerUserId, updated.ApprovedByUserId);
        Assert.NotNull(updated.ApprovedAt);
    }

    [Fact]
    public async Task ApproveReview_InvalidStaffId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.ApproveReviewAsync(1, 0));
        Assert.Contains("Mã quản lý phê duyệt không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ApproveReview_ReviewNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.ApproveReviewAsync(99999, 1));
    }

    [Fact]
    public async Task RejectReview_ValidReview_MarksRejectedWithReason()
    {
        // Arrange
        var (userId, dishId, orderId) = await SeedCompletedOrderForUserAsync();
        var review = new MenuItemReview(userId, dishId, orderId, 1, "Spam review");
        Context.MenuItemReviews.Add(review);
        await Context.SaveChangesAsync();

        int managerUserId = 2;
        string reason = "Đánh giá chứa nội dung không phù hợp quy định";

        // Act
        var success = await _service.RejectReviewAsync(review.Id, reason, managerUserId);

        // Assert
        Assert.True(success);
        var updated = await Context.MenuItemReviews.FirstOrDefaultAsync(r => r.Id == review.Id);
        Assert.NotNull(updated);
        Assert.False(updated.IsApproved);
        Assert.Equal(reason, updated.RejectionReason);
    }

    [Fact]
    public async Task RejectReview_EmptyReason_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.RejectReviewAsync(1, "   ", 1));
        Assert.Contains("Lý do từ chối đánh giá không được để trống", ex.Message);
    }

    [Fact]
    public async Task RejectReview_InvalidStaffId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.RejectReviewAsync(1, "Lý do", 0));
        Assert.Contains("Mã quản lý không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task RejectReview_ReviewNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.RejectReviewAsync(99999, "Lý do", 1));
    }
}
