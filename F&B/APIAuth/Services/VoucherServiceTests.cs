using APIAuth.Services.Common;
using Application.DTOs.Vouchers;
using Application.Services;
using Domain.Entities.Vouchers;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class VoucherServiceTests : TestApplicationBase
{
    private readonly VoucherService _service;

    public VoucherServiceTests()
    {
        _service = new VoucherService(
            UnitOfWork,
            VoucherQueryRepo,
            ValidationFactory,
            NullLogger<VoucherService>.Instance);
    }

    [Fact]
    public async Task CreateVoucher_ValidPercentageRequest_CreatesVoucher()
    {
        // Arrange
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "JAPAN20",
            DiscountType = DiscountType.Percentage,
            DiscountValue = 20m,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(30),
            MinOrderAmount = 150000m,
            MaxDiscountAmount = 50000m,
            UsageLimit = 200,
            UsagePerUserLimit = 2
        };

        // Act
        var result = await _service.CreateVoucherAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsValid);
        Assert.Equal("JAPAN20", result.VoucherCode);

        var saved = await Context.Vouchers.FirstOrDefaultAsync(v => v.VoucherCode == "JAPAN20");
        Assert.NotNull(saved);
        Assert.Equal(DiscountType.Percentage, saved.DiscountType);
        Assert.Equal(20m, saved.DiscountValue);
        Assert.Equal(150000m, saved.MinOrderAmount);
    }

    [Fact]
    public async Task CreateVoucher_ValidFixedAmountRequest_CreatesVoucher()
    {
        // Arrange
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "FIXED50K",
            DiscountType = DiscountType.FixedAmount,
            DiscountValue = 50000m,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(15),
            MinOrderAmount = 200000m,
            UsageLimit = 100,
            UsagePerUserLimit = 1
        };

        // Act
        var result = await _service.CreateVoucherAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsValid);

        var saved = await Context.Vouchers.FirstOrDefaultAsync(v => v.VoucherCode == "FIXED50K");
        Assert.NotNull(saved);
        Assert.Equal(DiscountType.FixedAmount, saved.DiscountType);
        Assert.Equal(50000m, saved.DiscountValue);
    }

    [Fact]
    public async Task CreateVoucher_DuplicateCode_ThrowsConflictException()
    {
        // Arrange
        await SeedVoucherAsync("EXISTS10");

        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "EXISTS10", // Duplicate
            DiscountType = DiscountType.Percentage,
            DiscountValue = 10m,
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(10)
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.CreateVoucherAsync(request));
        Assert.Contains("đã tồn tại trong hệ thống", ex.Message);
    }

    [Fact]
    public async Task CreateVoucher_PercentageGreaterThan100_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "INVALID120",
            DiscountType = DiscountType.Percentage,
            DiscountValue = 120m, // > 100%
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddDays(10)
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateVoucherAsync(request));
        Assert.Contains("không được vượt quá 100%", ex.Message);
    }

    [Fact]
    public async Task CreateVoucher_EndDateBeforeStartDate_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new CreateVoucherRequestDto
        {
            VoucherCode = "TIME-INV",
            DiscountType = DiscountType.Percentage,
            DiscountValue = 10m,
            StartDate = DateTime.UtcNow.AddDays(10),
            EndDate = DateTime.UtcNow.AddDays(5) // End before start
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateVoucherAsync(request));
        Assert.Contains("phải sau ngày bắt đầu", ex.Message);
    }

    [Fact]
    public async Task ActivateVoucher_ValidVoucher_ActivatesSuccessfully()
    {
        // Arrange
        var voucher = await SeedVoucherAsync("INACTIVE-TEST");
        voucher.Deactivate();
        await Context.SaveChangesAsync();

        // Act
        var success = await _service.ActivateVoucherAsync(voucher.Id);

        // Assert
        Assert.True(success);
        var updated = await Context.Vouchers.FirstOrDefaultAsync(v => v.Id == voucher.Id);
        Assert.NotNull(updated);
        Assert.True(updated.IsActive);
    }

    [Fact]
    public async Task ActivateVoucher_VoucherNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.ActivateVoucherAsync(99999));
    }

    [Fact]
    public async Task DeactivateVoucher_ValidVoucher_DeactivatesSuccessfully()
    {
        // Arrange
        var voucher = await SeedVoucherAsync("ACTIVE-TEST");

        // Act
        var success = await _service.DeactivateVoucherAsync(voucher.Id);

        // Assert
        Assert.True(success);
        var updated = await Context.Vouchers.FirstOrDefaultAsync(v => v.Id == voucher.Id);
        Assert.NotNull(updated);
        Assert.False(updated.IsActive);
    }

    [Fact]
    public async Task DeactivateVoucher_VoucherNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.DeactivateVoucherAsync(99999));
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_PercentageDiscount_CalculatesDiscountCorrectly()
    {
        // Arrange
        var user = await SeedUserAsync();
        await SeedVoucherAsync("RAMEN20PCT", DiscountType.Percentage, 20m, minOrderAmount: 100000m, maxDiscount: 100000m);

        var request = new ApplyVoucherRequestDto
        {
            Code = "RAMEN20PCT",
            CurrentSubtotal = 200000m,
            UserId = user.UserId
        };

        // Act
        var result = await _service.ValidateAndApplyVoucherAsync(request, user.UserId);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsValid);
        Assert.Equal(40000m, result.DiscountAmount); // 20% of 200000 = 40000
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_PercentageWithMaxCap_AppliesCap()
    {
        // Arrange
        var user = await SeedUserAsync();
        // 50% discount with 50,000đ max cap
        await SeedVoucherAsync("CAP50K", DiscountType.Percentage, 50m, minOrderAmount: 50000m, maxDiscount: 50000m);

        var request = new ApplyVoucherRequestDto
        {
            Code = "CAP50K",
            CurrentSubtotal = 300000m,
            UserId = user.UserId
        };

        // Act
        var result = await _service.ValidateAndApplyVoucherAsync(request, user.UserId);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsValid);
        Assert.Equal(50000m, result.DiscountAmount); // Capped at 50,000 instead of 150,000
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_FixedAmountDiscount_CalculatesDiscountCorrectly()
    {
        // Arrange
        var user = await SeedUserAsync();
        await SeedVoucherAsync("MINUS50K", DiscountType.FixedAmount, 50000m, minOrderAmount: 200000m);

        var request = new ApplyVoucherRequestDto
        {
            Code = "MINUS50K",
            CurrentSubtotal = 250000m,
            UserId = user.UserId
        };

        // Act
        var result = await _service.ValidateAndApplyVoucherAsync(request, user.UserId);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.IsValid);
        Assert.Equal(50000m, result.DiscountAmount);
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_SubtotalLessThanMinOrder_ReturnsInvalidResult()
    {
        // Arrange
        var user = await SeedUserAsync();
        await SeedVoucherAsync("MIN300K", DiscountType.Percentage, 10m, minOrderAmount: 300000m);

        var request = new ApplyVoucherRequestDto
        {
            Code = "MIN300K",
            CurrentSubtotal = 150000m, // Below 300000
            UserId = user.UserId
        };

        // Act
        var result = await _service.ValidateAndApplyVoucherAsync(request, user.UserId);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsValid);
        Assert.Contains("tối thiểu", result.ErrorMessage);
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_ExpiredVoucher_ReturnsInvalidResult()
    {
        // Arrange
        var user = await SeedUserAsync();
        var expired = new Voucher(
            "EXPIRED-VOUCHER",
            DiscountType.Percentage,
            10m,
            DateTime.UtcNow.AddDays(-30),
            DateTime.UtcNow.AddDays(-1), // Expired yesterday
            minOrderAmount: 0m,
            maxDiscountAmount: null,
            usageLimit: 100,
            usagePerUserLimit: 1);
        Context.Vouchers.Add(expired);
        await Context.SaveChangesAsync();

        var request = new ApplyVoucherRequestDto
        {
            Code = "EXPIRED-VOUCHER",
            CurrentSubtotal = 200000m,
            UserId = user.UserId
        };

        // Act
        var result = await _service.ValidateAndApplyVoucherAsync(request, user.UserId);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsValid);
        Assert.Contains("hết hạn", result.ErrorMessage);
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_InactiveVoucher_ReturnsInvalidResult()
    {
        // Arrange
        var user = await SeedUserAsync();
        var voucher = await SeedVoucherAsync("LOCKED-VOUCHER");
        voucher.Deactivate();
        await Context.SaveChangesAsync();

        var request = new ApplyVoucherRequestDto
        {
            Code = "LOCKED-VOUCHER",
            CurrentSubtotal = 200000m,
            UserId = user.UserId
        };

        // Act
        var result = await _service.ValidateAndApplyVoucherAsync(request, user.UserId);

        // Assert
        Assert.NotNull(result);
        Assert.False(result.IsValid);
        Assert.Contains("tạm khóa", result.ErrorMessage);
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_InvalidUserId_ThrowsBusinessException()
    {
        // Arrange
        var request = new ApplyVoucherRequestDto
        {
            Code = "TEST",
            CurrentSubtotal = 100000m
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.ValidateAndApplyVoucherAsync(request, 0));
        Assert.Contains("Mã người dùng không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ValidateAndApplyVoucher_EmptyCode_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new ApplyVoucherRequestDto
        {
            Code = "   ",
            CurrentSubtotal = 100000m
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.ValidateAndApplyVoucherAsync(request, 1));
        Assert.Contains("Mã voucher không được để trống", ex.Message);
    }
}
