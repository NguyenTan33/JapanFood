using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Operations;

public class CashDrawerWithdrawal : BaseAuditableEntity
{
    public int ShiftId { get; protected set; }
    public int WithdrawnByUserId { get; protected set; }
    public decimal Amount { get; protected set; }
    public string PhotoUrl { get; protected set; } = string.Empty;
    public string? Note { get; protected set; }
    public DateTime WithdrawnAt { get; protected set; }

    public virtual CashierShift? Shift { get; protected set; }
    public virtual User? WithdrawnByUser { get; protected set; }

    protected CashDrawerWithdrawal() { }

    public CashDrawerWithdrawal(int shiftId, int withdrawnByUserId, decimal amount, string photoUrl, string? note = null)
    {
        if (withdrawnByUserId <= 0)
            throw new BusinessException("Mã người thực hiện thu tiền không hợp lệ.");
        if (amount <= 0)
            throw new BusinessException("Số tiền thu két phải lớn hơn 0.");
        if (string.IsNullOrWhiteSpace(photoUrl))
            throw new BusinessException("Ảnh xác nhận thu tiền két không được để trống.");
        if (!string.IsNullOrWhiteSpace(note) && note.Trim().Length > 500)
            throw new BusinessException("Ghi chú thu tiền két không được vượt quá 500 ký tự.");

        ShiftId = shiftId;
        WithdrawnByUserId = withdrawnByUserId;
        Amount = amount;
        PhotoUrl = photoUrl.Trim();
        Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim();
        WithdrawnAt = DateTime.UtcNow;
        SetCreated(withdrawnByUserId);
    }
}
