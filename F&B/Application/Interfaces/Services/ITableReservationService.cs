using Application.DTOs.Reservations;

namespace Application.Interfaces.Services;

public interface ITableReservationService
{
    Task<ReservationSummaryDto> CreateReservationAsync(CreateReservationRequestDto request, CancellationToken ct = default);
    Task<bool> ConfirmReservationAsync(int reservationId, int staffUserId, CancellationToken ct = default);
    Task<bool> CheckInGuestAsync(int reservationId, int staffUserId, CancellationToken ct = default);
    Task<bool> CancelReservationAsync(int reservationId, string reason, int? staffUserId = null, CancellationToken ct = default);
    Task<bool> CompleteCleaningAsync(int tableId, int staffUserId, CancellationToken ct = default);
    Task<bool> CancelEmptyTableAsync(int tableId, int staffUserId, CancellationToken ct = default);
    Task<bool> TransferTableAsync(int sourceTableId, int targetTableId, int staffUserId, CancellationToken ct = default);
    Task<bool> MergeTablesAsync(int masterTableId, int secondaryTableId, int staffUserId, CancellationToken ct = default);
    Task<OpenTableResponseDto> OpenTableAsync(int tableId, OpenTableRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<RegeneratePinResponseDto> RegenerateTablePinAsync(int tableId, int staffUserId, CancellationToken ct = default);
    Task<VerifyTableNetworkResponseDto> VerifyTableNetworkAsync(VerifyTableNetworkRequestDto request, string? clientIp, CancellationToken ct = default);
    Task<bool> MarkNoShowAsync(int reservationId, string? notes = null, CancellationToken ct = default);

    // Admin Areas & Tables CRUD
    Task<TableAreaDto> CreateAreaAsync(CreateTableAreaRequestDto request, CancellationToken ct = default);
    Task<TableAreaDto> UpdateAreaAsync(int areaId, UpdateTableAreaRequestDto request, CancellationToken ct = default);
    Task<bool> SetAreaStatusAsync(int areaId, bool isActive, CancellationToken ct = default);
    Task<bool> DeleteAreaAsync(int areaId, CancellationToken ct = default);
    Task<TableDto> CreateTableAsync(CreateTableRequestDto request, CancellationToken ct = default);
    Task<TableDto> UpdateTableAsync(int tableId, UpdateTableRequestDto request, CancellationToken ct = default);
    Task<bool> SetTableStatusAsync(int tableId, bool isActive, CancellationToken ct = default);
    Task<bool> DeleteTableAsync(int tableId, CancellationToken ct = default);
}
