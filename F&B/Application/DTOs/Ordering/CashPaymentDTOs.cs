namespace Application.DTOs.Ordering;

public class ConfirmCashPaymentRequestDto
{
    public int OrderId { get; set; }
    public decimal AmountGiven { get; set; }
    public string? CustomerPhone { get; set; }
}

public class ConfirmCashPaymentResponseDto
{
    public bool Success { get; set; }
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public decimal AmountGiven { get; set; }
    public decimal ChangeAmount { get; set; }
    public int LoyaltyPointsEarned { get; set; }
    public int? NewTotalLoyaltyPoints { get; set; }
    public string? MembershipTier { get; set; }
    public string Message { get; set; } = string.Empty;
}

public class VietQrPaymentResponseDto
{
    public int OrderId { get; set; }
    public string OrderNumber { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string BankId { get; set; } = string.Empty;
    public string AccountNumber { get; set; } = string.Empty;
    public string AccountName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string QrImageUrl { get; set; } = string.Empty;
    public string QrDataUrl { get; set; } = string.Empty;
}
