using APIAuth.Services.Common;
using Application.DTOs.Reservations;
using Application.Services;
using Domain.Entities.Reservations;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class TableReservationServiceTests : TestApplicationBase
{
    private readonly TableReservationService _service;

    public TableReservationServiceTests()
    {
        _service = new TableReservationService(
            UnitOfWork,
            ReservationQueryRepo,
            ValidationFactory,
            EmailService,
            NullLogger<TableReservationService>.Instance);
    }

    [Fact]
    public async Task CreateReservation_ValidRequest_AssignsTable_SavesReservation_AndSendsEmail()
    {
        // Arrange
        var area = await SeedAreaAsync("VIP", "Khu VIP");
        var table = await SeedTableAsync(area.Id, "VIP-01", 6, 2);

        var requestTime = DateTime.UtcNow.Date.AddDays(1).AddHours(19); // Tomorrow at 19:00
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Tanaka Taro",
            CustomerPhone = "0987654321",
            CustomerEmail = "tanaka@example.com",
            GuestCount = 4,
            ReservationTime = requestTime,
            SpecialRequests = "Gần cửa sổ",
            Allergies = "Không ăn tôm",
            PreferredAreaId = area.Id
        };

        // Act
        var result = await _service.CreateReservationAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.ReservationId > 0);
        Assert.StartsWith("RSV-", result.ReservationCode);
        Assert.Equal("Tanaka Taro", result.CustomerName);
        Assert.Equal("VIP-01", result.AssignedTableNumber);
        Assert.Equal("Pending", result.Status);

        // Verify entity persisted in DB
        var savedReservation = await Context.Reservations.FirstOrDefaultAsync(r => r.Id == result.ReservationId);
        Assert.NotNull(savedReservation);
        Assert.Equal(table.Id, savedReservation.AssignedTableId);

        // Verify email sent
        Assert.Single(EmailService.SentEmails);
        var email = EmailService.SentEmails[0];
        Assert.Equal("tanaka@example.com", email.ToEmail);
        Assert.Contains(savedReservation.ReservationCode, email.Subject);
    }

    [Fact]
    public async Task CreateReservation_WithoutEmail_SucceedsWithoutSendingEmail()
    {
        // Arrange
        var area = await SeedAreaAsync("GARDEN", "Sân vườn");
        var table = await SeedTableAsync(area.Id, "G-01", 4, 2);

        var request = new CreateReservationRequestDto
        {
            CustomerName = "Sato Ken",
            CustomerPhone = "0912345678",
            CustomerEmail = null,
            GuestCount = 2,
            ReservationTime = DateTime.UtcNow.Date.AddDays(2).AddHours(19),
            PreferredAreaId = area.Id
        };

        // Act
        var result = await _service.CreateReservationAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(EmailService.SentEmails);
    }

    [Fact]
    public async Task CreateReservation_NoTablesAvailable_ThrowsBusinessException()
    {
        // Arrange: No tables seeded in the database
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Suzuki Ichiro",
            CustomerPhone = "0909999888",
            CustomerEmail = "suzuki@example.com",
            GuestCount = 4,
            ReservationTime = DateTime.UtcNow.Date.AddDays(1).AddHours(19)
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateReservationAsync(request));
        Assert.Contains("kín bàn", ex.Message);
    }

    [Fact]
    public async Task CreateReservation_InvalidPhone_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Honda Tadakatsu",
            CustomerPhone = "12345", // Invalid phone
            CustomerEmail = "honda@example.com",
            GuestCount = 2,
            ReservationTime = DateTime.UtcNow.Date.AddDays(1).AddHours(19)
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateReservationAsync(request));
        Assert.Contains("Số điện thoại", ex.Message);
    }

    [Fact]
    public async Task CreateReservation_PastReservationTime_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var request = new CreateReservationRequestDto
        {
            CustomerName = "Oda Nobunaga",
            CustomerPhone = "0901234567",
            GuestCount = 2,
            ReservationTime = DateTime.UtcNow.AddHours(-1) // In the past
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateReservationAsync(request));
        Assert.Contains("Thời gian đặt bàn", ex.Message);
    }

    [Fact]
    public async Task ConfirmReservation_ValidReservation_SetsStatusToConfirmed()
    {
        // Arrange
        var area = await SeedAreaAsync();
        var table = await SeedTableAsync(area.Id);
        var res = new Reservation("Yamada", "0901234567", "yamada@test.com", 2, DateTime.UtcNow.Date.AddDays(1).AddHours(19));
        res.AssignTable(table.Id);
        Context.Reservations.Add(res);
        await Context.SaveChangesAsync();

        int staffUserId = 10;

        // Act
        var success = await _service.ConfirmReservationAsync(res.Id, staffUserId);

        // Assert
        Assert.True(success);
        var updated = await Context.Reservations.FirstOrDefaultAsync(r => r.Id == res.Id);
        Assert.NotNull(updated);
        Assert.Equal(ReservationStatus.Confirmed, updated.Status);
        Assert.Equal(staffUserId, updated.ConfirmedByUserId);
    }

    [Fact]
    public async Task ConfirmReservation_NonExistentReservation_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.ConfirmReservationAsync(99999, 1));
    }

    [Fact]
    public async Task ConfirmReservation_InvalidStaffId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.ConfirmReservationAsync(1, 0));
        Assert.Contains("Mã nhân viên", ex.Message);
    }

    [Fact]
    public async Task CheckInGuest_ValidReservation_VerifiesTableSeating_SetsStatusToSeated()
    {
        // Arrange
        await SeedOpenShiftAsync();
        var area = await SeedAreaAsync();
        var table = await SeedTableAsync(area.Id);
        var res = new Reservation("Watanabe", "0901234567", null, 4, DateTime.UtcNow.Date.AddDays(1).AddHours(19));
        res.AssignTable(table.Id);
        res.Confirm(1);
        Context.Reservations.Add(res);
        await Context.SaveChangesAsync();

        int staffUserId = 5;

        // Act
        var success = await _service.CheckInGuestAsync(res.Id, staffUserId);

        // Assert
        Assert.True(success);
        var updated = await Context.Reservations.FirstOrDefaultAsync(r => r.Id == res.Id);
        Assert.NotNull(updated);
        Assert.Equal(ReservationStatus.Seated, updated.Status);

        var updatedTable = await Context.Tables.FirstOrDefaultAsync(t => t.Id == table.Id);
        Assert.NotNull(updatedTable);
        Assert.Equal(Domain.Entities.TableManagement.TableStatus.Serving, updatedTable.Status);
        Assert.NotNull(updatedTable.CurrentOrderId);

        var linkedOrder = await Context.Orders.FirstOrDefaultAsync(o => o.Id == updatedTable.CurrentOrderId);
        Assert.NotNull(linkedOrder);
        Assert.Equal(res.Id, linkedOrder.ReservationId);
        Assert.Equal(Domain.Entities.Menu.OrderType.DineIn, linkedOrder.OrderType);
    }

    [Fact]
    public async Task CheckInGuest_NoAssignedTable_ThrowsBusinessException()
    {
        // Arrange
        var res = new Reservation("Ito", "0901234567", null, 2, DateTime.UtcNow.Date.AddDays(1).AddHours(19));
        Context.Reservations.Add(res);
        await Context.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CheckInGuestAsync(res.Id, 1));
        Assert.Contains("chưa được gán bàn", ex.Message);
    }

    [Fact]
    public async Task CheckInGuest_NonExistentReservation_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.CheckInGuestAsync(99999, 1));
    }

    [Fact]
    public async Task CancelReservation_ValidReservation_CancelsSuccessfully()
    {
        // Arrange
        var area = await SeedAreaAsync();
        var table = await SeedTableAsync(area.Id);
        var res = new Reservation("Kobayashi", "0901234567", null, 2, DateTime.UtcNow.Date.AddDays(1).AddHours(19));
        res.AssignTable(table.Id);
        Context.Reservations.Add(res);
        await Context.SaveChangesAsync();

        // Act
        var success = await _service.CancelReservationAsync(res.Id, "Khách bận việc đột xuất", staffUserId: 2);

        // Assert
        Assert.True(success);
        var updated = await Context.Reservations.FirstOrDefaultAsync(r => r.Id == res.Id);
        Assert.NotNull(updated);
        Assert.Equal(ReservationStatus.Cancelled, updated.Status);
        Assert.Equal("Khách bận việc đột xuất", updated.CancellationReason);
    }

    [Fact]
    public async Task CancelReservation_NonExistentReservation_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.CancelReservationAsync(99999, "Lý do"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CancelReservation_NullOrWhitespaceReason_ThrowsBusinessException(string? invalidReason)
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CancelReservationAsync(1, invalidReason!));
        Assert.Contains("Lý do hủy đặt bàn không được để trống", ex.Message);
    }
}
