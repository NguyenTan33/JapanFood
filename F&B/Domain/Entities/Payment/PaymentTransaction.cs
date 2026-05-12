using Domain.Entities.Common;
using Domain.Entities.Menu;
using Domain.Entities.Operations;
using Domain.Exceptions;

namespace Domain.Entities.Payment;

public class PaymentTransaction : BaseAuditableEntity
{
    public int OrderId { get; protected set; }
    public string TransactionNumber { get; protected set; } = string.Empty;
    public PaymentGateway Gateway { get; protected set; }
    public PaymentTransactionStatus Status { get; protected set; } = PaymentTransactionStatus.Pending;
    public decimal Amount { get; protected set; }
    public string? GatewayTransactionId { get; protected set; }
    public string? GatewayResponseCode { get; protected set; }
    public string? IpAddress { get; protected set; }
    public string? RawPayload { get; protected set; }
    public string? FailureReason { get; protected set; }
    public string? RefundReference { get; protected set; }
    public decimal? AmountGiven { get; protected set; }
    public decimal? ChangeAmount { get; protected set; }
    public DateTime? PaidAt { get; protected set; }
    public int? ShiftId { get; protected set; }

    public virtual Order? Order { get; protected set; }
    public virtual CashierShift? Shift { get; protected set; }

    protected PaymentTransaction() { }

    public PaymentTransaction(
        int orderId,
        PaymentGateway gateway,
        decimal amount,
        string? ipAddress = null)
    {
        if (orderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");
        if (amount <= 0)
            throw new BusinessException("Số tiền thanh toán phải lớn hơn 0.");

        OrderId = orderId;
        Gateway = gateway;
        Amount = amount;
        IpAddress = ipAddress;
        Status = PaymentTransactionStatus.Pending;
        TransactionNumber = GenerateTransactionNumber();
    }

    public void MarkSuccess(string gatewayTransactionId, string? responseCode = null, string? rawPayload = null)
    {
        if (Status == PaymentTransactionStatus.Success)
            throw new BusinessException("Giao dịch đã được ghi nhận thành công trước đó.");
        if (string.IsNullOrWhiteSpace(gatewayTransactionId))
            throw new BusinessException("Mã giao dịch từ cổng thanh toán không được để trống.");

        Status = PaymentTransactionStatus.Success;
        GatewayTransactionId = gatewayTransactionId.Trim();
        GatewayResponseCode = responseCode?.Trim();
        RawPayload = rawPayload;
        PaidAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkFailed(string reason, string? responseCode = null, string? rawPayload = null)
    {
        if (Status == PaymentTransactionStatus.Success)
            throw new BusinessException("Không thể đánh dấu thất bại cho giao dịch đã thành công.");

        Status = PaymentTransactionStatus.Failed;
        FailureReason = string.IsNullOrWhiteSpace(reason) ? "Thanh toán thất bại" : reason.Trim();
        GatewayResponseCode = responseCode?.Trim();
        RawPayload = rawPayload;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkRefunded(string refundReference, string? rawPayload = null)
    {
        if (Status != PaymentTransactionStatus.Success)
            throw new BusinessException("Chỉ có thể hoàn tiền cho giao dịch đã thanh toán thành công.");
        if (string.IsNullOrWhiteSpace(refundReference))
            throw new BusinessException("Mã tham chiếu hoàn tiền không được để trống.");

        Status = PaymentTransactionStatus.Refunded;
        RefundReference = refundReference.Trim();
        RawPayload = rawPayload ?? RawPayload;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordCashPayment(decimal amountGiven, decimal changeAmount)
    {
        if (amountGiven < Amount)
            throw new BusinessException($"Số tiền khách đưa ({amountGiven:N0} đ) không đủ để thanh toán ({Amount:N0} đ).");
        if (changeAmount < 0)
            throw new BusinessException("Số tiền thối lại không được âm.");

        AmountGiven = amountGiven;
        ChangeAmount = changeAmount;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AssignShift(int shiftId)
    {
        if (shiftId <= 0)
            throw new BusinessException("Mã ca trực không hợp lệ.");

        ShiftId = shiftId;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string GenerateTransactionNumber()
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMddHHmmss");
        var rand = Random.Shared.Next(1000, 9999);
        return $"TXN-{timestamp}-{rand}";
    }
}
