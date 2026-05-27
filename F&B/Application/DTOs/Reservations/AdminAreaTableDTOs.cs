namespace Application.DTOs.Reservations;

public class CreateTableAreaRequestDto
{
    public string AreaCode { get; set; } = string.Empty;
    public string AreaName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public List<string>? Features { get; set; }
    public string? CapacityPerTable { get; set; }
    public int MinGuests { get; set; } = 1;
    public int MaxGuests { get; set; } = 10;
    public bool RequiresDeposit { get; set; }
    public decimal? DepositPerGuest { get; set; }
    public int DisplayOrder { get; set; }
}

public class UpdateTableAreaRequestDto
{
    public string AreaName { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public List<string>? Features { get; set; }
    public string? CapacityPerTable { get; set; }
    public int MinGuests { get; set; } = 1;
    public int MaxGuests { get; set; } = 10;
    public bool RequiresDeposit { get; set; }
    public decimal? DepositPerGuest { get; set; }
    public int DisplayOrder { get; set; }
}

public class CreateTableRequestDto
{
    public int AreaId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int MinCapacity { get; set; } = 1;
}

public class UpdateTableRequestDto
{
    public int AreaId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int MinCapacity { get; set; } = 1;
}

public class SetEntityStatusRequestDto
{
    public bool IsActive { get; set; }
}

public class ReservationManageFilterDto
{
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
    public string? Status { get; set; }
    public int? AreaId { get; set; }
    public string? Search { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class ReservationStatusCountsDto
{
    public int Total { get; set; }
    public int Pending { get; set; }
    public int Confirmed { get; set; }
    public int Seated { get; set; }
    public int Completed { get; set; }
    public int Cancelled { get; set; }
    public int NoShow { get; set; }
}

public class ReservationManageResponseDto
{
    public List<ReservationSummaryDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
    public ReservationStatusCountsDto Counts { get; set; } = new();
}

public class MarkNoShowRequestDto
{
    public string? Notes { get; set; }
}
