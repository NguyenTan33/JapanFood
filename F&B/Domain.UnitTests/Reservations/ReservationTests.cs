using Domain.Entities.Reservations;
using Domain.Exceptions;

namespace Domain.UnitTests.Reservations;

public class ReservationTests
{
    private static DateTime GetValidLunchTime() =>
        DateTime.UtcNow.Date.AddDays(1).Add(new TimeSpan(12, 0, 0));

    private static DateTime GetValidDinnerTime() =>
        DateTime.UtcNow.Date.AddDays(1).Add(new TimeSpan(18, 30, 0));

    [Fact]
    public void Constructor_WithValidData_ShouldCreatePendingReservation()
    {
        // Arrange
        var resTime = GetValidDinnerTime();

        // Act
        var reservation = new Reservation(
            customerName: "Yamamoto Takeshi",
            customerPhone: "0901234567",
            customerEmail: "takeshi@example.com",
            guestCount: 4,
            reservationTime: resTime,
            specialRequests: "Window seat if possible",
            allergies: "Peanut allergy",
            preferredAreaId: 1,
            userId: 10);

        // Assert
        Assert.Equal("Yamamoto Takeshi", reservation.CustomerName);
        Assert.Equal("0901234567", reservation.CustomerPhone);
        Assert.Equal("takeshi@example.com", reservation.CustomerEmail);
        Assert.Equal(4, reservation.GuestCount);
        Assert.Equal(resTime, reservation.ReservationTime);
        Assert.Equal(ReservationStatus.Pending, reservation.Status);
        Assert.Equal("Window seat if possible", reservation.SpecialRequests);
        Assert.Equal("Peanut allergy", reservation.Allergies);
        Assert.Equal(1, reservation.PreferredAreaId);
        Assert.Equal(10, reservation.UserId);
        Assert.StartsWith("RSV-", reservation.ReservationCode);
        Assert.Null(reservation.AssignedTableId);
        Assert.Null(reservation.ConfirmedAt);
        Assert.Null(reservation.SeatedAt);
        Assert.Null(reservation.CancelledAt);
    }

    [Theory]
    [InlineData("", "0901234567")]
    [InlineData("   ", "0901234567")]
    [InlineData(null, "0901234567")]
    public void Constructor_WithInvalidCustomerName_ShouldThrowBusinessException(string? name, string phone)
    {
        var time = GetValidLunchTime();
        var ex = Assert.Throws<BusinessException>(() =>
            new Reservation(name!, phone, null, 2, time));
        Assert.Contains("Tên khách hàng không được để trống", ex.Message);
    }

    [Theory]
    [InlineData("Yamamoto", "")]
    [InlineData("Yamamoto", "   ")]
    [InlineData("Yamamoto", null)]
    public void Constructor_WithInvalidCustomerPhone_ShouldThrowBusinessException(string name, string? phone)
    {
        var time = GetValidLunchTime();
        var ex = Assert.Throws<BusinessException>(() =>
            new Reservation(name, phone!, null, 2, time));
        Assert.Contains("Số điện thoại khách hàng không được để trống", ex.Message);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(-10)]
    public void Constructor_WithZeroOrNegativeGuestCount_ShouldThrowBusinessException(int count)
    {
        var time = GetValidLunchTime();
        var ex = Assert.Throws<BusinessException>(() =>
            new Reservation("Tanaka", "0909998888", null, count, time));
        Assert.Contains("Số lượng khách đặt bàn phải lớn hơn 0", ex.Message);
    }

    [Theory]
    [InlineData(21)]
    [InlineData(50)]
    public void Constructor_WithGuestCountOver20_ShouldThrowBusinessException(int count)
    {
        var time = GetValidLunchTime();
        var ex = Assert.Throws<BusinessException>(() =>
            new Reservation("Tanaka", "0909998888", null, count, time));
        Assert.Contains("tối đa 20 khách", ex.Message);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(20)]
    public void Constructor_WithBoundaryGuestCounts_ShouldSucceed(int count)
    {
        var time = GetValidLunchTime();
        var reservation = new Reservation("Tanaka", "0909998888", null, count, time);
        Assert.Equal(count, reservation.GuestCount);
    }

    [Fact]
    public void Constructor_WithTimeLessThan30MinutesFromNow_ShouldThrowBusinessException()
    {
        var tooSoon = DateTime.UtcNow.AddMinutes(15);
        var ex = Assert.Throws<BusinessException>(() =>
            new Reservation("Tanaka", "0909998888", null, 2, tooSoon));
        Assert.Contains("trước ít nhất 30 phút", ex.Message);
    }

    [Theory]
    [InlineData(8, 0)]   // 08:00 before lunch
    [InlineData(10, 20)] // 10:20 before lunch (opens 10:30)
    [InlineData(14, 30)] // 14:30 afternoon break
    [InlineData(16, 0)]  // 16:00 afternoon break
    [InlineData(22, 30)] // 22:30 after dinner (closes 22:00)
    [InlineData(23, 0)]  // 23:00 midnight
    public void Constructor_OutsideOperatingHours_ShouldThrowBusinessException(int hour, int minute)
    {
        var invalidTime = DateTime.UtcNow.Date.AddDays(1).Add(new TimeSpan(hour, minute, 0));
        var ex = Assert.Throws<BusinessException>(() =>
            new Reservation("Tanaka", "0909998888", null, 2, invalidTime));
        Assert.Contains("ngoài giờ mở cửa", ex.Message);
    }

    [Fact]
    public void Confirm_FromPending_ShouldSucceedAndSetStatusConfirmed()
    {
        // Arrange
        var reservation = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());

        // Act
        reservation.Confirm(staffUserId: 5, tableId: 101);

        // Assert
        Assert.Equal(ReservationStatus.Confirmed, reservation.Status);
        Assert.Equal(5, reservation.ConfirmedByUserId);
        Assert.NotNull(reservation.ConfirmedAt);
        Assert.Equal(101, reservation.AssignedTableId);
    }

    [Fact]
    public void Confirm_WhenNotPending_ShouldThrowBusinessException()
    {
        // Arrange
        var reservation = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());
        reservation.Confirm(staffUserId: 5);

        // Act & Assert (already confirmed)
        var ex = Assert.Throws<BusinessException>(() => reservation.Confirm(staffUserId: 6));
        Assert.Contains("Chỉ có thể xác nhận đơn đặt bàn ở trạng thái Chờ xử lý", ex.Message);
    }

    [Fact]
    public void AssignTable_WhenPendingOrConfirmed_ShouldSucceed()
    {
        var reservation = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());
        reservation.AssignTable(50);
        Assert.Equal(50, reservation.AssignedTableId);

        reservation.Confirm(staffUserId: 1);
        reservation.AssignTable(51);
        Assert.Equal(51, reservation.AssignedTableId);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-5)]
    public void AssignTable_WithInvalidTableId_ShouldThrowBusinessException(int tableId)
    {
        var reservation = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());
        var ex = Assert.Throws<BusinessException>(() => reservation.AssignTable(tableId));
        Assert.Contains("Mã bàn không hợp lệ", ex.Message);
    }

    [Fact]
    public void Seat_FromConfirmed_ShouldSucceed()
    {
        var reservation = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());
        reservation.Confirm(staffUserId: 1);

        reservation.Seat(tableId: 50);

        Assert.Equal(ReservationStatus.Seated, reservation.Status);
        Assert.Equal(50, reservation.AssignedTableId);
        Assert.NotNull(reservation.SeatedAt);
    }

    [Fact]
    public void Seat_WhenCancelledOrNoShow_ShouldThrowBusinessException()
    {
        var r1 = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());
        r1.Cancel("Customer changed plans");
        var ex1 = Assert.Throws<BusinessException>(() => r1.Seat(50));
        Assert.Contains("Không thể xếp chỗ cho đơn đặt bàn đã bị hủy", ex1.Message);

        var r2 = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());
        r2.Confirm(staffUserId: 1);
        r2.MarkNoShow("Did not arrive", currentTime: r2.ReservationTime.AddMinutes(20));
        var ex2 = Assert.Throws<BusinessException>(() => r2.Seat(50));
        Assert.Contains("Không thể xếp chỗ cho đơn đặt bàn đã bị đánh dấu No-Show", ex2.Message);
    }

    [Fact]
    public void Seat_WhenAlreadySeated_ShouldThrowBusinessException()
    {
        var reservation = new Reservation("Sato", "0911223344", null, 2, GetValidLunchTime());
        reservation.Seat(50);

        var ex = Assert.Throws<BusinessException>(() => reservation.Seat(51));
        Assert.Contains("Đơn đặt bàn này đã được xếp chỗ trước đó", ex.Message);
    }

    [Fact]
    public void Cancel_FromPendingOrConfirmed_ShouldSucceed()
    {
        var reservation = new Reservation("Suzuki", "0933445566", null, 3, GetValidLunchTime());
        reservation.Cancel("Customer called to cancel", cancelledByUserId: 2);

        Assert.Equal(ReservationStatus.Cancelled, reservation.Status);
        Assert.Equal("Customer called to cancel", reservation.CancellationReason);
        Assert.Equal(2, reservation.CancelledByUserId);
        Assert.NotNull(reservation.CancelledAt);
    }

    [Fact]
    public void Cancel_WithEmptyReason_ShouldThrowBusinessException()
    {
        var reservation = new Reservation("Suzuki", "0933445566", null, 3, GetValidLunchTime());
        var ex = Assert.Throws<BusinessException>(() => reservation.Cancel("   "));
        Assert.Contains("Lý do hủy đặt bàn không được để trống", ex.Message);
    }

    [Fact]
    public void Cancel_WhenAlreadySeated_ShouldThrowBusinessException()
    {
        var reservation = new Reservation("Suzuki", "0933445566", null, 3, GetValidLunchTime());
        reservation.Seat(20);

        var ex = Assert.Throws<BusinessException>(() => reservation.Cancel("Late cancel"));
        Assert.Contains("Không thể hủy đơn đặt bàn đã nhận chỗ", ex.Message);
    }

    [Fact]
    public void Cancel_WhenAlreadyCancelled_ShouldThrowBusinessException()
    {
        var reservation = new Reservation("Suzuki", "0933445566", null, 3, GetValidLunchTime());
        reservation.Cancel("First cancel");

        var ex = Assert.Throws<BusinessException>(() => reservation.Cancel("Second cancel"));
        Assert.Contains("Đơn đặt bàn này đã được hủy trước đó", ex.Message);
    }

    [Fact]
    public void MarkNoShow_WhenConfirmedAndGracePeriodElapsed_ShouldSucceed()
    {
        var resTime = GetValidLunchTime();
        var reservation = new Reservation("Watanabe", "0944556677", null, 4, resTime);
        reservation.Confirm(staffUserId: 1);

        // 20 minutes past reservation time
        reservation.MarkNoShow(notes: "Waited 20 minutes, phone unreachable", currentTime: resTime.AddMinutes(20));

        Assert.Equal(ReservationStatus.NoShow, reservation.Status);
        Assert.Equal("Waited 20 minutes, phone unreachable", reservation.Notes);
    }

    [Fact]
    public void MarkNoShow_WhenNotConfirmed_ShouldThrowBusinessException()
    {
        var resTime = GetValidLunchTime();
        var reservation = new Reservation("Watanabe", "0944556677", null, 4, resTime);

        var ex = Assert.Throws<BusinessException>(() =>
            reservation.MarkNoShow("Not confirmed yet", currentTime: resTime.AddMinutes(30)));
        Assert.Contains("Chỉ có thể đánh dấu No-Show cho đơn đặt bàn đã Xác nhận", ex.Message);
    }

    [Fact]
    public void MarkNoShow_Before15MinutesGracePeriod_ShouldThrowBusinessException()
    {
        var resTime = GetValidLunchTime();
        var reservation = new Reservation("Watanabe", "0944556677", null, 4, resTime);
        reservation.Confirm(staffUserId: 1);

        // Only 10 minutes past reservation time
        var ex = Assert.Throws<BusinessException>(() =>
            reservation.MarkNoShow("Too early", currentTime: resTime.AddMinutes(10)));
        Assert.Contains("Chưa hết thời gian chờ gia hạn (15 phút sau giờ hẹn)", ex.Message);
    }

    [Fact]
    public void UpdateDetails_WhenPendingOrConfirmed_ShouldUpdateValues()
    {
        var reservation = new Reservation("Ito", "0955667788", null, 2, GetValidLunchTime());
        var newTime = GetValidDinnerTime();

        reservation.UpdateDetails(
            guestCount: 6,
            reservationTime: newTime,
            specialRequests: "High chair needed",
            allergies: "Shellfish",
            preferredAreaId: 2);

        Assert.Equal(6, reservation.GuestCount);
        Assert.Equal(newTime, reservation.ReservationTime);
        Assert.Equal("High chair needed", reservation.SpecialRequests);
        Assert.Equal("Shellfish", reservation.Allergies);
        Assert.Equal(2, reservation.PreferredAreaId);
    }

    [Fact]
    public void UpdateDetails_WhenSeatedOrCancelled_ShouldThrowBusinessException()
    {
        var reservation = new Reservation("Ito", "0955667788", null, 2, GetValidLunchTime());
        reservation.Seat(10);

        var ex = Assert.Throws<BusinessException>(() =>
            reservation.UpdateDetails(4, GetValidDinnerTime(), null, null, null));
        Assert.Contains("Không thể thay đổi thông tin đặt bàn khi ở trạng thái Seated", ex.Message);
    }

    [Fact]
    public void RequireDeposit_ValidAmount_ShouldSetPendingDeposit()
    {
        var reservation = new Reservation("Tanaka", "0911223344", null, 8, GetValidDinnerTime());
        reservation.RequireDeposit(200000m);

        Assert.Equal(200000m, reservation.DepositAmount);
        Assert.Equal(DepositStatus.Pending, reservation.DepositStatus);
    }

    [Fact]
    public void RecordDepositPaid_ShouldSetPaidDepositAndTransactionCode()
    {
        var reservation = new Reservation("Tanaka", "0911223344", null, 8, GetValidDinnerTime());
        reservation.RequireDeposit(200000m);
        reservation.RecordDepositPaid("VNPAY_DEPOSIT_888");

        Assert.Equal(DepositStatus.Paid, reservation.DepositStatus);
        Assert.Equal("VNPAY_DEPOSIT_888", reservation.DepositTransactionCode);
        Assert.NotNull(reservation.DepositPaidAt);
    }

    [Fact]
    public void RefundDeposit_WhenPaid_ShouldUpdateStatusToRefunded()
    {
        var reservation = new Reservation("Tanaka", "0911223344", null, 8, GetValidDinnerTime());
        reservation.RequireDeposit(200000m);
        reservation.RecordDepositPaid("VNPAY_DEPOSIT_888");

        reservation.RefundDeposit("Khách báo bận hủy trước 24h");

        Assert.Equal(DepositStatus.Refunded, reservation.DepositStatus);
        Assert.Contains("Hoàn cọc: Khách báo bận hủy trước 24h", reservation.Notes);
    }
}
