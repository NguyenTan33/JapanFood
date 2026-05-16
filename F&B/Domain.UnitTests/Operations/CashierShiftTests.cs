using Domain.Entities.Operations;
using Domain.Entities.Payment;
using Domain.Exceptions;

namespace Domain.UnitTests.Operations;

public class CashierShiftTests
{
    [Fact]
    public void Constructor_ValidInputs_ShouldCreateOpenShift()
    {
        var shift = new CashierShift(openedByUserId: 5, openingCash: 1500000m, notes: "  Ca sáng  ");

        Assert.Equal(5, shift.OpenedByUserId);
        Assert.Equal(1500000m, shift.OpeningCash);
        Assert.Equal(ShiftStatus.Open, shift.Status);
        Assert.StartsWith("SHIFT-", shift.ShiftCode);
        Assert.Equal("Ca sáng", shift.Notes);
        Assert.Equal(5, shift.CreatedByUserId);
        Assert.Empty(shift.Withdrawals);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Constructor_InvalidUserId_ShouldThrowBusinessException(int userId)
    {
        var ex = Assert.Throws<BusinessException>(() => new CashierShift(userId, 500000m));
        Assert.Contains("Mã nhân viên mở ca", ex.Message);
    }

    [Fact]
    public void Constructor_NegativeOpeningCash_ShouldThrowBusinessException()
    {
        var ex = Assert.Throws<BusinessException>(() => new CashierShift(1, -100m));
        Assert.Contains("Tiền đầu ca", ex.Message);
    }

    [Fact]
    public void RecordWithdrawal_ValidAmount_ShouldAddWithdrawalAndBumpUpdatedAudit()
    {
        var shift = new CashierShift(1, 1000000m);

        var withdrawal = shift.RecordWithdrawal(
            withdrawnByUserId: 99,
            amount: 400000m,
            photoUrl: "/uploads/withdrawals/proof.jpg",
            currentRemainingCash: 1000000m,
            note: "Nộp két giữa ca");

        Assert.Single(shift.Withdrawals);
        Assert.Equal(400000m, withdrawal.Amount);
        Assert.Equal("/uploads/withdrawals/proof.jpg", withdrawal.PhotoUrl);
        Assert.Equal("Nộp két giữa ca", withdrawal.Note);
        Assert.Equal(99, withdrawal.WithdrawnByUserId);
        Assert.Equal(99, shift.UpdatedByUserId);
        Assert.NotNull(shift.UpdatedAt);
    }

    [Fact]
    public void RecordWithdrawal_ExceedingRemainingCash_ShouldThrowBusinessException()
    {
        var shift = new CashierShift(1, 500000m);

        var ex = Assert.Throws<BusinessException>(() =>
            shift.RecordWithdrawal(99, 600000m, "/uploads/withdrawals/proof.jpg", 500000m));

        Assert.Contains("vượt quá số tiền mặt hiện có trong két", ex.Message);
    }

    [Fact]
    public void RecordWithdrawal_WhenClosed_ShouldThrowBusinessException()
    {
        var shift = new CashierShift(1, 500000m);
        shift.Close(1, 500000m, 500000m);

        var ex = Assert.Throws<BusinessException>(() =>
            shift.RecordWithdrawal(99, 100000m, "/uploads/withdrawals/proof.jpg", 500000m));

        Assert.Contains("đang mở", ex.Message);
    }

    [Fact]
    public void Close_ValidOpenShift_ShouldCalculateVarianceAndClose()
    {
        var shift = new CashierShift(1, 1000000m, "Mở ca");
        shift.Close(closedByUserId: 2, actualCash: 1450000m, expectedCash: 1500000m, notes: "Thiếu 50k");

        Assert.Equal(ShiftStatus.Closed, shift.Status);
        Assert.Equal(2, shift.ClosedByUserId);
        Assert.NotNull(shift.ClosedAt);
        Assert.Equal(1450000m, shift.ClosingActualCash);
        Assert.Equal(1500000m, shift.ExpectedCash);
        Assert.Equal(-50000m, shift.VarianceAmount);
        Assert.Contains("Thiếu 50k", shift.Notes);
    }

    [Fact]
    public void Close_AlreadyClosed_ShouldThrowBusinessException()
    {
        var shift = new CashierShift(1, 1000000m);
        shift.Close(1, 1000000m, 1000000m);

        var ex = Assert.Throws<BusinessException>(() => shift.Close(1, 1000000m, 1000000m));
        Assert.Contains("đã được đóng", ex.Message);
    }

    [Fact]
    public void PaymentTransaction_AssignShift_ShouldSetShiftId()
    {
        var txn = new PaymentTransaction(orderId: 10, PaymentGateway.Cash, 250000m);
        txn.AssignShift(42);

        Assert.Equal(42, txn.ShiftId);
        Assert.Throws<BusinessException>(() => txn.AssignShift(0));
    }
}
