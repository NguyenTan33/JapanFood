using Domain.Entities.Common;
using Domain.Entities.Payment;
using Domain.Exceptions;

namespace Domain.Entities.Operations;

public class CashierShift : BaseAuditableEntity
{
    public string ShiftCode { get; protected set; } = string.Empty;
    public int OpenedByUserId { get; protected set; }
    public DateTime OpenedAt { get; protected set; }
    public decimal OpeningCash { get; protected set; }
    public int? ClosedByUserId { get; protected set; }
    public DateTime? ClosedAt { get; protected set; }
    public decimal? ClosingActualCash { get; protected set; }
    public decimal? ExpectedCash { get; protected set; }
    public decimal? VarianceAmount { get; protected set; }
    public ShiftStatus Status { get; protected set; } = ShiftStatus.Open;
    public string? Notes { get; protected set; }
    public byte[]? RowVersion { get; protected set; }

    public virtual User? OpenedByUser { get; protected set; }
    public virtual User? ClosedByUser { get; protected set; }

    private readonly List<CashDrawerWithdrawal> _withdrawals = new();
    public virtual IReadOnlyCollection<CashDrawerWithdrawal> Withdrawals => _withdrawals.AsReadOnly();

    private readonly List<PaymentTransaction> _paymentTransactions = new();
    public virtual IReadOnlyCollection<PaymentTransaction> PaymentTransactions => _paymentTransactions.AsReadOnly();

    protected CashierShift() { }

    public CashierShift(int openedByUserId, decimal openingCash, string? notes = null)
    {
        if (openedByUserId <= 0)
            throw new BusinessException("Mã nhân viên mở ca không hợp lệ.");
        if (openingCash < 0)
            throw new BusinessException("Tiền đầu ca không được âm.");
        if (!string.IsNullOrWhiteSpace(notes) && notes.Trim().Length > 500)
            throw new BusinessException("Ghi chú ca trực không được vượt quá 500 ký tự.");

        OpenedByUserId = openedByUserId;
        OpeningCash = openingCash;
        OpenedAt = DateTime.UtcNow;
        Status = ShiftStatus.Open;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        ShiftCode = GenerateShiftCode();
        SetCreated(openedByUserId);
    }

    public CashDrawerWithdrawal RecordWithdrawal(
        int withdrawnByUserId,
        decimal amount,
        string photoUrl,
        decimal currentRemainingCash,
        string? note = null)
    {
        if (Status != ShiftStatus.Open)
            throw new BusinessException("Chỉ có thể thu tiền két khi ca trực đang mở.");
        if (withdrawnByUserId <= 0)
            throw new BusinessException("Mã quản trị viên thu tiền không hợp lệ.");
        if (amount <= 0)
            throw new BusinessException("Số tiền thu két phải lớn hơn 0.");
        if (amount > currentRemainingCash)
            throw new BusinessException($"Số tiền thu két ({amount:N0} đ) vượt quá số tiền mặt hiện có trong két ({currentRemainingCash:N0} đ).");
        if (string.IsNullOrWhiteSpace(photoUrl))
            throw new BusinessException("Ảnh xác nhận thu tiền két là bắt buộc.");

        var withdrawal = new CashDrawerWithdrawal(Id, withdrawnByUserId, amount, photoUrl, note);
        _withdrawals.Add(withdrawal);
        SetUpdated(withdrawnByUserId);
        return withdrawal;
    }

    public void Close(int closedByUserId, decimal actualCash, decimal expectedCash, string? notes = null)
    {
        if (Status != ShiftStatus.Open)
            throw new BusinessException("Ca trực này đã được đóng trước đó.");
        if (closedByUserId <= 0)
            throw new BusinessException("Mã nhân viên đóng ca không hợp lệ.");
        if (actualCash < 0)
            throw new BusinessException("Tiền mặt thực tế kiểm đếm không được âm.");
        if (!string.IsNullOrWhiteSpace(notes) && notes.Trim().Length > 500)
            throw new BusinessException("Ghi chú đóng ca không được vượt quá 500 ký tự.");

        Status = ShiftStatus.Closed;
        ClosedByUserId = closedByUserId;
        ClosedAt = DateTime.UtcNow;
        ClosingActualCash = actualCash;
        ExpectedCash = expectedCash;
        VarianceAmount = actualCash - expectedCash;

        if (!string.IsNullOrWhiteSpace(notes))
        {
            var trimmed = notes.Trim();
            Notes = string.IsNullOrWhiteSpace(Notes)
                ? trimmed
                : (Notes.Length + trimmed.Length + 3 <= 500 ? $"{Notes} | {trimmed}" : trimmed);
        }

        SetUpdated(closedByUserId);
    }

    private static string GenerateShiftCode()
    {
        var datePart = DateTime.UtcNow.ToString("yyyyMMdd");
        var randPart = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();
        return $"SHIFT-{datePart}-{randPart}";
    }
}
