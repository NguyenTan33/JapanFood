using Application.DTOs.Kds;
using Domain.Entities.Kds;

namespace Application.Interfaces.Repositories;

public interface IKitchenQueryRepository
{
    Task<List<KitchenTicketDto>> GetActiveKitchenTicketsByStationAsync(
        KitchenStationType stationType,
        CancellationToken ct = default);

    Task<List<OverdueKitchenAlertDto>> GetOverdueKitchenAlertsAsync(
        int thresholdMinutes = 15,
        CancellationToken ct = default);

    Task<KitchenItemsResponseDto> GetKitchenItemsAsync(
        string tab = "unfinished",
        int? tableId = null,
        string? search = null,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        CancellationToken ct = default);
}
