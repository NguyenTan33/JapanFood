using Application.Common.Models;
using Application.DTOs.Reservations;
using Domain.Entities.Reservations;

namespace Application.Interfaces.Repositories;

public interface ITableReservationQueryRepository
{
    Task<List<TableDto>> FindAvailableTablesAsync(
        DateTime reservationTime,
        int durationMinutes = 120,
        int guestCount = 2,
        int? areaId = null,
        CancellationToken ct = default);

    Task<List<ReservationSummaryDto>> GetReservationsByDateAsync(
        DateTime date,
        ReservationStatus? status = null,
        int? tableId = null,
        CancellationToken ct = default);

    Task<PagedResult<ReservationSummaryDto>> GetUserReservationHistoryAsync(
        int userId,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default);

    Task<List<TableDto>> GetAllTablesAsync(int? areaId = null, CancellationToken ct = default);

    Task<List<TableAreaDto>> GetActiveAreasAsync(CancellationToken ct = default);

    Task<List<TableAreaDto>> GetAllAreasForAdminAsync(CancellationToken ct = default);

    Task<List<TableDto>> GetAllTablesForAdminAsync(int? areaId = null, CancellationToken ct = default);

    Task<ReservationManageResponseDto> GetManagedReservationsAsync(ReservationManageFilterDto filter, CancellationToken ct = default);
}
