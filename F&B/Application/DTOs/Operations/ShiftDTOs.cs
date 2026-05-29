namespace Application.DTOs.Operations;

public class CurrentShiftResponseDto
{
    public bool HasOpenShift { get; set; }
    public ShiftDto? Shift { get; set; }
}

public class ShiftDto
{
    public int Id { get; set; }
    public string ShiftCode { get; set; } = string.Empty;
    public int OpenedByUserId { get; set; }
    public string OpenedByName { get; set; } = string.Empty;
    public DateTime OpenedAt { get; set; }
    public decimal OpeningCash { get; set; }
    public decimal CashSalesTotal { get; set; }
    public decimal TransferSalesTotal { get; set; }
    public decimal TotalWithdrawn { get; set; }
    public decimal CurrentRemainingCash { get; set; }
    public int TotalOrdersCount { get; set; }
    public string Status { get; set; } = string.Empty;
    public int? ClosedByUserId { get; set; }
    public string? ClosedByName { get; set; }
    public DateTime? ClosedAt { get; set; }
    public decimal? ClosingActualCash { get; set; }
    public decimal? ExpectedCash { get; set; }
    public decimal? VarianceAmount { get; set; }
    public string? Notes { get; set; }
    public int OpenTablesCount { get; set; }
    public List<CashWithdrawalDto> Withdrawals { get; set; } = new();
}

public class CashWithdrawalDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public string PhotoUrl { get; set; } = string.Empty;
    public string? Note { get; set; }
    public int WithdrawnByUserId { get; set; }
    public string WithdrawnByName { get; set; } = string.Empty;
    public DateTime WithdrawnAt { get; set; }
}

public class OpenShiftRequestDto
{
    public decimal OpeningCash { get; set; }
    public string? Notes { get; set; }
}

public class CloseShiftRequestDto
{
    public decimal ActualCash { get; set; }
    public string? Notes { get; set; }
}
