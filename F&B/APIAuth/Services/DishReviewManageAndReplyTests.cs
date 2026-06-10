using System.Security.Claims;
using API.Controllers;
using APIAuth.Services.Common;
using Application.DTOs.Reviews;
using Application.Services;
using Domain.Entities.Menu;
using Domain.Entities.Reviews;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class DishReviewManageAndReplyTests : TestApplicationBase
{
    private readonly DishReviewService _service;

    public DishReviewManageAndReplyTests()
    {
        _service = new DishReviewService(
            UnitOfWork,
            DishReviewQueryRepo,
            ValidationFactory,
            NullLogger<DishReviewService>.Instance);
    }

    [Fact]
    public async Task ManagedReviews_ReturnsAccurateCountsFilters_AndManagerReply()
    {
        var customer = await SeedUserAsync("Khách Hàng 1", "cust1@jf.vn", "0901112233");
        var manager = await SeedUserAsync("Quản Lý Nhật", "mgr@jf.vn", "0904445566");
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "REV-01", "Sashimi Set", 250000m);

        var o1 = new Order(OrderType.Takeaway, userId: customer.UserId);
        o1.AddItem(dish, 1);
        var o2 = new Order(OrderType.Takeaway, userId: customer.UserId);
        o2.AddItem(dish, 1);
        var o3 = new Order(OrderType.Takeaway, userId: customer.UserId);
        o3.AddItem(dish, 1);
        Context.Orders.AddRange(o1, o2, o3);
        await Context.SaveChangesAsync();

        var rApproved = new MenuItemReview(customer.UserId, dish.Id, o1.Id, 5, "Quá ngon!");
        rApproved.Approve(manager.UserId);

        var rPending = new MenuItemReview(customer.UserId, dish.Id, o2.Id, 4, "Phục vụ tốt");

        var rRejected = new MenuItemReview(customer.UserId, dish.Id, o3.Id, 1, "Quảng cáo");
        rRejected.Reject(manager.UserId, "Spam");

        Context.MenuItemReviews.AddRange(rApproved, rPending, rRejected);
        await Context.SaveChangesAsync();

        var repliedDto = await _service.ReplyReviewAsync(rApproved.Id, new ReplyReviewRequestDto
        {
            Reply = "Cảm ơn quý khách đã ghé thưởng thức tại Tori Sakura!"
        }, manager.UserId);

        Assert.Equal("Cảm ơn quý khách đã ghé thưởng thức tại Tori Sakura!", repliedDto.ManagerReply);
        Assert.Equal(manager.UserId, repliedDto.RepliedByUserId);
        Assert.Equal("Quản Lý Nhật", repliedDto.RepliedByName);
        Assert.NotNull(repliedDto.RepliedAt);

        var manageAll = await DishReviewQueryRepo.GetManagedReviewsAsync(new ReviewManageFilterDto { Page = 1, PageSize = 20 });
        Assert.Equal(3, manageAll.Counts.Total);
        Assert.Equal(1, manageAll.Counts.Approved);
        Assert.Equal(1, manageAll.Counts.Pending);
        Assert.Equal(1, manageAll.Counts.Rejected);
        Assert.Equal(2, manageAll.Counts.Unreplied);

        var unrepliedPending = await DishReviewQueryRepo.GetManagedReviewsAsync(new ReviewManageFilterDto
        {
            Status = "PENDING",
            HasReply = false
        });
        Assert.Single(unrepliedPending.Items);
        Assert.Equal(rPending.Id, unrepliedPending.Items[0].ReviewId);

        var publicReviews = await DishReviewQueryRepo.GetPagedReviewsByDishIdAsync(dish.Id);
        Assert.Single(publicReviews.Items);
        Assert.Equal("Cảm ơn quý khách đã ghé thưởng thức tại Tori Sakura!", publicReviews.Items[0].ManagerReply);
        Assert.Equal("Quản Lý Nhật", publicReviews.Items[0].RepliedByName);
    }

    [Fact]
    public async Task DishReviewController_ReplyWithoutAuthenticatedUserClaim_ReturnsUnauthorized()
    {
        var controller = new DishReviewController(DishReviewQueryRepo, _service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity())
                }
            }
        };

        var result = await controller.ReplyReview(1, new ReplyReviewRequestDto { Reply = "Thanks" }, CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(result);
    }
}
