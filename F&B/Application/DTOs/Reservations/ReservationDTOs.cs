using System.Text.Json;
using System.Text.Json.Serialization;

namespace Application.DTOs.Reservations;

public class FlexibleAreaIdConverter : JsonConverter<int?>
{
    public override int? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Null)
        {
            return null;
        }

        if (reader.TokenType == JsonTokenType.Number)
        {
            return reader.GetInt32();
        }

        if (reader.TokenType == JsonTokenType.String)
        {
            var str = reader.GetString()?.Trim().ToLowerInvariant();
            if (string.IsNullOrEmpty(str))
                return null;

            if (int.TryParse(str, out var num))
                return num;

            return str switch
            {
                "main" or "main-dining" => 1,
                "vip" or "vip-room" => 2,
                "bar" or "sushi-bar" => 3,
                "tatami" or "tatami-room" => 4,
                _ => null
            };
        }

        return null;
    }

    public override void Write(Utf8JsonWriter writer, int? value, JsonSerializerOptions options)
    {
        if (value.HasValue)
            writer.WriteNumberValue(value.Value);
        else
            writer.WriteNullValue();
    }
}

public class TableAreaDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? JapaneseName { get; set; }
    public string? Description { get; set; }
    public string? ImageUrl { get; set; }
    public List<string> Features { get; set; } = new();
    public string? CapacityPerTable { get; set; }
    public int MinGuests { get; set; }
    public int MaxGuests { get; set; }
    public bool RequiresDeposit { get; set; }
    public decimal? DepositPerGuest { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsActive { get; set; } = true;
    public int TableCount { get; set; }
}

public class TableDto
{
    public int TableId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public int Capacity { get; set; }
    public int MinCapacity { get; set; }
    public int AreaId { get; set; }
    public string AreaName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public int? CurrentOrderId { get; set; }
    public int? ActiveOrderId { get; set; }
    public DateTime? OpenedAt { get; set; }
    public decimal CurrentTotal { get; set; }
    public decimal TotalAmount { get; set; }
    public int? GuestCount { get; set; }
    public DateTime? ReservationTime { get; set; }
    public int? MergedIntoTableId { get; set; }
    public bool IsActive { get; set; } = true;
    public string? SessionToken { get; set; }
    public string? PinCode { get; set; }
}

public class ReservationSummaryDto
{
    public int ReservationId { get; set; }
    public int? UserId { get; set; }
    public string ReservationCode { get; set; } = string.Empty;
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int GuestCount { get; set; }
    public DateTime ReservationTime { get; set; }
    public string Status { get; set; } = string.Empty;
    public string DepositStatus { get; set; } = string.Empty;
    public decimal DepositAmount { get; set; }
    public int? AssignedTableId { get; set; }
    public string? AssignedTableNumber { get; set; }
    public int? PreferredAreaId { get; set; }
    public string? PreferredAreaName { get; set; }
    public string? SpecialRequests { get; set; }
    public string? Allergies { get; set; }
    public string? Notes { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public DateTime? SeatedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FindTableQueryDto
{
    public DateTime ReservationTime { get; set; }
    public int DurationMinutes { get; set; } = 120;
    public int GuestCount { get; set; } = 2;

    [JsonConverter(typeof(FlexibleAreaIdConverter))]
    public int? AreaId { get; set; }
}

public class CreateReservationRequestDto
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string? CustomerEmail { get; set; }
    public int GuestCount { get; set; }
    public DateTime ReservationTime { get; set; }
    public string? SpecialRequests { get; set; }
    public string? Allergies { get; set; }

    [JsonConverter(typeof(FlexibleAreaIdConverter))]
    public int? PreferredAreaId { get; set; }
    public int? UserId { get; set; }
}
