namespace Domain.Entities.Payment;

public enum PaymentTransactionStatus
{
    Pending = 1,
    Success = 2,
    Failed = 3,
    Refunded = 4
}
