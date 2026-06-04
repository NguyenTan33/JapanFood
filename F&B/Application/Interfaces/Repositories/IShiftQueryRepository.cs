using Application.Common.Models;
using Application.DTOs.Operations;

namespace Application.Interfaces.Repositories;

public interface IShiftQueryRepository
{
    Task<CurrentShiftResponseDto> GetCurrentShiftAsync(CancellationToken ct = default);
    Task<ShiftDto?> GetShiftByIdAsync(int shiftId, CancellationToken ct = default);
    Task<PagedResult<ShiftDto>> GetShiftsAsync(DateTime? fromDate, DateTime? toDate, int page = 1, int pageSize = 20, CancellationToken ct = default);
}
