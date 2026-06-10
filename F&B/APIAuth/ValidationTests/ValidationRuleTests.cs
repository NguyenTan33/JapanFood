using Application.DTOs.Cart;
using Application.DTOs.Menu;
using Application.DTOs.Ordering;
using Application.DTOs.Reservations;
using Application.DTOs.Reviews;
using Application.DTOs.Vouchers;
using Application.Services;
using Application.Validation.Cart;
using Application.Validation.Menu;
using Application.Validation.Ordering;
using Application.Validation.Reservations;
using Application.Validation.Reviews;
using Application.Validation.Vouchers;
using Domain.Entities.Menu;
using Domain.Exceptions;
using Xunit;

namespace APIAuth.ValidationTests;

public class ValidationRuleTests
{
    private readonly PhoneService _phoneService = new();

    #region Menu Filter Validation
    [Fact]
    public async Task DishFilter_ValidRequest_PassesValidation()
    {
        var rule = new DishFilterQueryValidationRule();
        var request = new DishFilterQueryDto
        {
            Page = 1,
            PageSize = 20,
            MinPrice = 50000,
            MaxPrice = 200000,
            SortBy = "price_asc"
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Fact]
    public async Task DishFilter_MinPriceGreaterThanMaxPrice_ThrowsBusinessException()
    {
        var rule = new DishFilterQueryValidationRule();
        var request = new DishFilterQueryDto
        {
            MinPrice = 300000,
            MaxPrice = 100000
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("không được lớn hơn", ex.Message);
    }

    [Fact]
    public async Task DishFilter_PageSizeGreaterThan100_ThrowsBusinessException()
    {
        var rule = new DishFilterQueryValidationRule();
        var request = new DishFilterQueryDto
        {
            PageSize = 101
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("từ 1 đến 100", ex.Message);
    }

    [Fact]
    public async Task DishFilter_InvalidSortBy_ThrowsBusinessException()
    {
        var rule = new DishFilterQueryValidationRule();
        var request = new DishFilterQueryDto
        {
            SortBy = "sql_injection_attempt"
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("không hợp lệ", ex.Message);
    }
    #endregion

    #region Reservation Validation
    [Fact]
    public async Task Reservation_ValidRequest_PassesValidation()
    {
        var rule = new CreateReservationValidationRule(_phoneService);
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Yamada Taro",
            CustomerPhone = "0901234567",
            CustomerEmail = "yamada@example.com",
            GuestCount = 4,
            ReservationTime = DateTime.UtcNow.AddHours(2)
        };

        var exception = await Record.ExceptionAsync(() => rule.ValidateAsync(request));
        Assert.Null(exception);
    }

    [Fact]
    public async Task Reservation_InvalidPhone_ThrowsBusinessException()
    {
        var rule = new CreateReservationValidationRule(_phoneService);
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Yamada Taro",
            CustomerPhone = "12345",
            GuestCount = 4,
            ReservationTime = DateTime.UtcNow.AddHours(2)
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("Số điện thoại", ex.Message);
    }

    [Fact]
    public async Task Reservation_TimeInPast_ThrowsBusinessException()
    {
        var rule = new CreateReservationValidationRule(_phoneService);
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Yamada Taro",
            CustomerPhone = "0901234567",
            GuestCount = 4,
            ReservationTime = DateTime.UtcNow.AddMinutes(10) // less than 30 mins
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("30 phút", ex.Message);
    }

    [Fact]
    public async Task Reservation_GuestCountExceedsLimit_ThrowsBusinessException()
    {
        var rule = new CreateReservationValidationRule(_phoneService);
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Yamada Taro",
            CustomerPhone = "0901234567",
            GuestCount = 55,
            ReservationTime = DateTime.UtcNow.AddHours(2)
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("từ 1 đến 50 người", ex.Message);
    }
    #endregion

    #region Order Validation
    [Fact]
    public async Task CreateOrder_DineInWithoutTable_ThrowsBusinessException()
    {
        var rule = new CreateOrderValidationRule();
        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.DineIn,
            TableId = null,
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = 1, Quantity = 2 }
            }
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("bắt buộc phải chọn bàn", ex.Message);
    }

    [Fact]
    public async Task CreateOrder_EmptyItems_ThrowsBusinessException()
    {
        var rule = new CreateOrderValidationRule();
        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.Takeaway,
            Items = new List<CreateOrderItemDto>()
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("ít nhất một món ăn", ex.Message);
    }
    #endregion

    #region Voucher & Review & Cart Validation
    [Fact]
    public async Task ApplyVoucher_EmptyCode_ThrowsBusinessException()
    {
        var rule = new ApplyVoucherValidationRule();
        var request = new ApplyVoucherRequestDto
        {
            Code = "",
            CurrentSubtotal = 100000,
            UserId = 1
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("không được để trống", ex.Message);
    }

    [Fact]
    public async Task CreateReview_InvalidRating_ThrowsBusinessException()
    {
        var rule = new CreateReviewValidationRule();
        var request = new CreateReviewRequestDto
        {
            UserId = 1,
            MenuItemId = 1,
            OrderId = 1,
            Rating = 6
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("từ 1 đến 5 sao", ex.Message);
    }

    [Fact]
    public async Task AddToCart_InvalidQuantity_ThrowsBusinessException()
    {
        var rule = new AddToCartValidationRule();
        var request = new AddToCartRequestDto
        {
            UserId = 1,
            MenuItemId = 1,
            Quantity = 0
        };

        var ex = await Assert.ThrowsAsync<BusinessException>(() => rule.ValidateAsync(request));
        Assert.Contains("từ 1 đến 50", ex.Message);
    }
    #endregion
}
