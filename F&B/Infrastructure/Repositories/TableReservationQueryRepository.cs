using System.Text.Json;
using Application.Common.Extensions;
using Application.Common.Models;
using Application.DTOs.Reservations;
using Application.Interfaces.Repositories;
using Domain.Entities.Menu;
using Domain.Entities.Reservations;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class TableReservationQueryRepository : ITableReservationQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public TableReservationQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<List<TableDto>> FindAvailableTablesAsync(
        DateTime reservationTime,
        int durationMinutes = 120,
        int guestCount = 2,
        int? areaId = null,
        CancellationToken ct = default)
    {
        var requestStart = reservationTime;
        var requestEnd = reservationTime.AddMinutes(durationMinutes);

        // 1. Get IDs of tables booked during overlapping interval: A_start < B_end && B_start < A_end
        var bookedTableIdsQuery = _context.Reservations
            .AsNoTracking()
            .Where(r => r.AssignedTableId.HasValue
                     && (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed)
                     && r.ReservationTime < requestEnd
                     && requestStart < r.ReservationTime.AddMinutes(120))
            .Select(r => r.AssignedTableId!.Value);

        // 2. Base query: active tables with sufficient capacity and not currently booked
        var baseQuery = _context.Tables
            .AsNoTracking()
            .Where(t => t.IsActive
                     && t.MergedIntoTableId == null
                     && t.Capacity >= guestCount
                     && !bookedTableIdsQuery.Contains(t.Id));

        // 2.1 If areaId is specified, first prioritize tables in that area matching MinCapacity
        if (areaId.HasValue && areaId.Value > 0)
        {
            var areaExactMatches = await baseQuery
                .Where(t => t.AreaId == areaId.Value && t.MinCapacity <= guestCount)
                .OrderBy(t => t.Capacity)
                .Select(t => new TableDto
                {
                    TableId = t.Id,
                    TableNumber = t.TableNumber,
                    Capacity = t.Capacity,
                    MinCapacity = t.MinCapacity,
                    AreaId = t.AreaId,
                    AreaName = t.Area.AreaName,
                    Status = t.Status.ToString(),
                    MergedIntoTableId = t.MergedIntoTableId
                })
                .ToListAsync(ct);

            if (areaExactMatches.Any())
                return areaExactMatches;

            // 2.2 Fallback: table in requested area with Capacity >= guestCount (e.g. 2 guests reserving a VIP/Tatami room)
            var areaCapacityMatches = await baseQuery
                .Where(t => t.AreaId == areaId.Value)
                .OrderBy(t => t.Capacity)
                .Select(t => new TableDto
                {
                    TableId = t.Id,
                    TableNumber = t.TableNumber,
                    Capacity = t.Capacity,
                    MinCapacity = t.MinCapacity,
                    AreaId = t.AreaId,
                    AreaName = t.Area.AreaName,
                    Status = t.Status.ToString(),
                    MergedIntoTableId = t.MergedIntoTableId
                })
                .ToListAsync(ct);

            if (areaCapacityMatches.Any())
                return areaCapacityMatches;
        }

        // 2.3 General match: Any area with MinCapacity <= guestCount
        var generalMatches = await baseQuery
            .Where(t => t.MinCapacity <= guestCount)
            .OrderBy(t => t.Capacity)
            .Select(t => new TableDto
            {
                TableId = t.Id,
                TableNumber = t.TableNumber,
                Capacity = t.Capacity,
                MinCapacity = t.MinCapacity,
                AreaId = t.AreaId,
                AreaName = t.Area.AreaName,
                Status = t.Status.ToString(),
                MergedIntoTableId = t.MergedIntoTableId
            })
            .ToListAsync(ct);

        if (generalMatches.Any())
            return generalMatches;

        // 2.4 Final fallback: Any active table with Capacity >= guestCount
        return await baseQuery
            .OrderBy(t => t.Capacity)
            .Select(t => new TableDto
            {
                TableId = t.Id,
                TableNumber = t.TableNumber,
                Capacity = t.Capacity,
                MinCapacity = t.MinCapacity,
                AreaId = t.AreaId,
                AreaName = t.Area.AreaName,
                Status = t.Status.ToString(),
                MergedIntoTableId = t.MergedIntoTableId
            })
            .ToListAsync(ct);
    }

    public async Task<List<ReservationSummaryDto>> GetReservationsByDateAsync(
        DateTime date,
        ReservationStatus? status = null,
        int? tableId = null,
        CancellationToken ct = default)
    {
        var startOfDay = date.Date;
        var endOfDay = startOfDay.AddDays(1);

        var query = _context.Reservations
            .AsNoTracking()
            .Where(r => r.ReservationTime >= startOfDay && r.ReservationTime < endOfDay);

        if (status.HasValue)
        {
            query = query.Where(r => r.Status == status.Value);
        }

        if (tableId.HasValue)
        {
            query = query.Where(r => r.AssignedTableId == tableId.Value);
        }

        return await query
            .OrderBy(r => r.ReservationTime)
            .Select(r => new ReservationSummaryDto
            {
                ReservationId = r.Id,
                UserId = r.UserId,
                ReservationCode = r.ReservationCode,
                CustomerName = r.CustomerName,
                CustomerPhone = r.CustomerPhone,
                GuestCount = r.GuestCount,
                ReservationTime = r.ReservationTime,
                Status = r.Status.ToString(),
                DepositStatus = r.DepositStatus.ToString(),
                DepositAmount = r.DepositAmount,
                AssignedTableNumber = r.AssignedTable != null ? r.AssignedTable.TableNumber : null,
                PreferredAreaName = r.PreferredArea != null ? r.PreferredArea.AreaName : null,
                SpecialRequests = r.SpecialRequests,
                Allergies = r.Allergies
            })
            .ToListAsync(ct);
    }

    public async Task<PagedResult<ReservationSummaryDto>> GetUserReservationHistoryAsync(
        int userId,
        int page = 1,
        int pageSize = 10,
        CancellationToken ct = default)
    {
        var query = _context.Reservations
            .AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.ReservationTime);

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .ApplyPaging(page, pageSize)
            .Select(r => new ReservationSummaryDto
            {
                ReservationId = r.Id,
                UserId = r.UserId,
                ReservationCode = r.ReservationCode,
                CustomerName = r.CustomerName,
                CustomerPhone = r.CustomerPhone,
                GuestCount = r.GuestCount,
                ReservationTime = r.ReservationTime,
                Status = r.Status.ToString(),
                DepositStatus = r.DepositStatus.ToString(),
                DepositAmount = r.DepositAmount,
                AssignedTableNumber = r.AssignedTable != null ? r.AssignedTable.TableNumber : null,
                PreferredAreaId = r.PreferredAreaId,
                PreferredAreaName = r.PreferredArea != null ? r.PreferredArea.AreaName : null,
                SpecialRequests = r.SpecialRequests,
                Allergies = r.Allergies,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync(ct);

        return new PagedResult<ReservationSummaryDto>(items, totalCount, page, pageSize);
    }

    public async Task<List<TableAreaDto>> GetActiveAreasAsync(CancellationToken ct = default)
    {
        return await QueryAreasInternalAsync(includeInactive: false, ct);
    }

    public async Task<List<TableAreaDto>> GetAllAreasForAdminAsync(CancellationToken ct = default)
    {
        return await QueryAreasInternalAsync(includeInactive: true, ct);
    }

    private async Task<List<TableAreaDto>> QueryAreasInternalAsync(bool includeInactive, CancellationToken ct)
    {
        var query = _context.TableAreas.AsNoTracking().AsQueryable();
        if (!includeInactive)
        {
            query = query.Where(a => a.IsActive);
        }

        var rawAreas = await query
            .OrderBy(a => a.DisplayOrder)
            .ThenBy(a => a.Id)
            .Select(a => new
            {
                a.Id,
                a.AreaCode,
                a.AreaName,
                a.JapaneseName,
                a.Description,
                a.ImageUrl,
                a.Features,
                a.CapacityPerTable,
                a.MinGuests,
                a.MaxGuests,
                a.RequiresDeposit,
                a.DepositPerGuest,
                a.DisplayOrder,
                a.IsActive,
                TableCount = a.Tables.Count
            })
            .ToListAsync(ct);

        return rawAreas.Select(a => new TableAreaDto
        {
            Id = a.Id,
            Code = a.AreaCode,
            Name = a.AreaName,
            JapaneseName = a.JapaneseName,
            Description = a.Description,
            ImageUrl = a.ImageUrl,
            Features = ParseFeatures(a.Features),
            CapacityPerTable = a.CapacityPerTable,
            MinGuests = a.MinGuests,
            MaxGuests = a.MaxGuests,
            RequiresDeposit = a.RequiresDeposit,
            DepositPerGuest = a.DepositPerGuest,
            DisplayOrder = a.DisplayOrder,
            IsActive = a.IsActive,
            TableCount = a.TableCount
        }).ToList();
    }

    public async Task<List<TableDto>> GetAllTablesAsync(int? areaId = null, CancellationToken ct = default)
    {
        return await QueryTablesInternalAsync(areaId, includeInactive: false, ct);
    }

    public async Task<List<TableDto>> GetAllTablesForAdminAsync(int? areaId = null, CancellationToken ct = default)
    {
        return await QueryTablesInternalAsync(areaId, includeInactive: true, ct);
    }

    private async Task<List<TableDto>> QueryTablesInternalAsync(int? areaId, bool includeInactive, CancellationToken ct)
    {
        var query = _context.Tables
            .AsNoTracking()
            .Include(t => t.Area)
            .Include(t => t.CurrentOrder)
            .AsQueryable();

        if (!includeInactive)
        {
            query = query.Where(t => t.IsActive);
        }

        if (areaId.HasValue && areaId.Value > 0)
        {
            query = query.Where(t => t.AreaId == areaId.Value);
        }

        var tables = await query
            .OrderBy(t => t.Area.DisplayOrder)
            .ThenBy(t => t.TableNumber)
            .Select(t => new
            {
                TableId = t.Id,
                t.TableNumber,
                t.Capacity,
                t.MinCapacity,
                t.AreaId,
                AreaName = t.Area.AreaName,
                Status = t.Status.ToString(),
                t.CurrentOrderId,
                t.MergedIntoTableId,
                t.IsActive,
                t.SessionToken,
                t.PinCode,
                t.PinCreatedAt,
                t.UpdatedAt,
                t.CreatedAt,
                OpenedAt = t.CurrentOrder != null 
                    ? (DateTime?)t.CurrentOrder.CreatedAt 
                    : (t.Status == Domain.Entities.TableManagement.TableStatus.Serving ? (t.PinCreatedAt ?? t.UpdatedAt ?? t.CreatedAt) : null),
                CurrentTotal = t.CurrentOrder != null ? t.CurrentOrder.TotalAmount : 0m,
                OrderGuestCount = t.CurrentOrder != null ? (int?)t.CurrentOrder.GuestCount : null
            })
            .ToListAsync(ct);

        if (tables.Count == 0)
        {
            return new List<TableDto>();
        }

        var tableIds = tables.Select(t => t.TableId).ToList();
        var cutoff = DateTime.UtcNow.AddMinutes(-30);
        var upcomingRows = await _context.Reservations
            .AsNoTracking()
            .Where(r => r.AssignedTableId.HasValue
                     && tableIds.Contains(r.AssignedTableId.Value)
                     && (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed)
                     && r.ReservationTime >= cutoff)
            .OrderBy(r => r.ReservationTime)
            .Select(r => new
            {
                TableId = r.AssignedTableId!.Value,
                r.ReservationTime,
                r.GuestCount
            })
            .ToListAsync(ct);

        var upcomingByTable = upcomingRows
            .GroupBy(r => r.TableId)
            .ToDictionary(g => g.Key, g => g.First());

        return tables.Select(t =>
        {
            upcomingByTable.TryGetValue(t.TableId, out var upcoming);
            return new TableDto
            {
                TableId = t.TableId,
                TableNumber = t.TableNumber,
                Capacity = t.Capacity,
                MinCapacity = t.MinCapacity,
                AreaId = t.AreaId,
                AreaName = t.AreaName,
                Status = t.Status,
                CurrentOrderId = t.CurrentOrderId,
                ActiveOrderId = t.CurrentOrderId,
                OpenedAt = t.OpenedAt.HasValue ? DateTime.SpecifyKind(t.OpenedAt.Value, DateTimeKind.Utc) : null,
                CurrentTotal = t.CurrentTotal,
                TotalAmount = t.CurrentTotal,
                GuestCount = t.OrderGuestCount ?? (upcoming != null && t.Status == "Reserved" ? upcoming.GuestCount : null),
                ReservationTime = upcoming?.ReservationTime,
                MergedIntoTableId = t.MergedIntoTableId,
                IsActive = t.IsActive,
                SessionToken = t.SessionToken,
                PinCode = t.PinCode
            };
        }).ToList();
    }

    public async Task<ReservationManageResponseDto> GetManagedReservationsAsync(ReservationManageFilterDto filter, CancellationToken ct = default)
    {
        filter ??= new ReservationManageFilterDto();
        var page = Math.Max(1, filter.Page);
        var pageSize = Math.Clamp(filter.PageSize <= 0 ? 20 : filter.PageSize, 1, 100);

        var baseQuery = _context.Reservations
            .AsNoTracking()
            .Include(r => r.AssignedTable)
            .Include(r => r.PreferredArea)
            .AsQueryable();

        if (filter.FromDate.HasValue)
        {
            var start = filter.FromDate.Value.Date;
            baseQuery = baseQuery.Where(r => r.ReservationTime >= start);
        }

        if (filter.ToDate.HasValue)
        {
            var end = filter.ToDate.Value.Date.AddDays(1);
            baseQuery = baseQuery.Where(r => r.ReservationTime < end);
        }

        if (filter.AreaId.HasValue && filter.AreaId.Value > 0)
        {
            var areaId = filter.AreaId.Value;
            baseQuery = baseQuery.Where(r =>
                r.PreferredAreaId == areaId ||
                (r.AssignedTable != null && r.AssignedTable.AreaId == areaId));
        }

        if (!string.IsNullOrWhiteSpace(filter.Search))
        {
            var term = filter.Search.Trim().ToLowerInvariant();
            baseQuery = baseQuery.Where(r =>
                r.ReservationCode.ToLower().Contains(term) ||
                r.CustomerName.ToLower().Contains(term) ||
                r.CustomerPhone.ToLower().Contains(term) ||
                (r.AssignedTable != null && r.AssignedTable.TableNumber.ToLower().Contains(term)));
        }

        var statusCountsRaw = await baseQuery
            .GroupBy(r => r.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var seatedIdsQuery = baseQuery
            .Where(r => r.Status == ReservationStatus.Seated)
            .Select(r => r.Id);

        var completedCount = await _context.Orders
            .AsNoTracking()
            .Where(o => o.ReservationId.HasValue
                     && seatedIdsQuery.Contains(o.ReservationId.Value)
                     && o.Status == OrderStatus.Completed)
            .Select(o => o.ReservationId!.Value)
            .Distinct()
            .CountAsync(ct);

        var counts = new ReservationStatusCountsDto
        {
            Total = statusCountsRaw.Sum(x => x.Count),
            Pending = statusCountsRaw.FirstOrDefault(x => x.Status == ReservationStatus.Pending)?.Count ?? 0,
            Confirmed = statusCountsRaw.FirstOrDefault(x => x.Status == ReservationStatus.Confirmed)?.Count ?? 0,
            Seated = statusCountsRaw.FirstOrDefault(x => x.Status == ReservationStatus.Seated)?.Count ?? 0,
            Completed = (statusCountsRaw.FirstOrDefault(x => x.Status == ReservationStatus.Completed)?.Count ?? 0) + completedCount,
            Cancelled = statusCountsRaw.FirstOrDefault(x => x.Status == ReservationStatus.Cancelled)?.Count ?? 0,
            NoShow = statusCountsRaw.FirstOrDefault(x => x.Status == ReservationStatus.NoShow)?.Count ?? 0
        };

        var filteredQuery = baseQuery;
        if (!string.IsNullOrWhiteSpace(filter.Status) &&
            !string.Equals(filter.Status.Trim(), "ALL", StringComparison.OrdinalIgnoreCase))
        {
            if (string.Equals(filter.Status.Trim(), "Completed", StringComparison.OrdinalIgnoreCase))
            {
                var completedResIds = _context.Orders
                    .AsNoTracking()
                    .Where(o => o.ReservationId.HasValue && o.Status == OrderStatus.Completed)
                    .Select(o => o.ReservationId!.Value);
                filteredQuery = filteredQuery.Where(r => r.Status == ReservationStatus.Completed || (r.Status == ReservationStatus.Seated && completedResIds.Contains(r.Id)));
            }
            else if (Enum.TryParse<ReservationStatus>(filter.Status.Trim(), ignoreCase: true, out var parsedStatus))
            {
                filteredQuery = filteredQuery.Where(r => r.Status == parsedStatus);
            }
        }

        var totalCount = await filteredQuery.CountAsync(ct);
        var totalPages = pageSize > 0 ? (int)Math.Ceiling(totalCount / (double)pageSize) : 0;

        var items = await filteredQuery
            .OrderByDescending(r => r.ReservationTime)
            .ThenByDescending(r => r.Id)
            .ApplyPaging(page, pageSize)
            .Select(r => new ReservationSummaryDto
            {
                ReservationId = r.Id,
                UserId = r.UserId,
                ReservationCode = r.ReservationCode,
                CustomerName = r.CustomerName,
                CustomerPhone = r.CustomerPhone,
                CustomerEmail = r.CustomerEmail,
                GuestCount = r.GuestCount,
                ReservationTime = r.ReservationTime,
                Status = r.Status.ToString(),
                DepositStatus = r.DepositStatus.ToString(),
                DepositAmount = r.DepositAmount,
                AssignedTableId = r.AssignedTableId,
                AssignedTableNumber = r.AssignedTable != null ? r.AssignedTable.TableNumber : null,
                PreferredAreaId = r.PreferredAreaId,
                PreferredAreaName = r.PreferredArea != null ? r.PreferredArea.AreaName : null,
                SpecialRequests = r.SpecialRequests,
                Allergies = r.Allergies,
                Notes = r.Notes,
                ConfirmedAt = r.ConfirmedAt,
                SeatedAt = r.SeatedAt,
                CancelledAt = r.CancelledAt,
                CancellationReason = r.CancellationReason,
                CreatedAt = r.CreatedAt
            })
            .ToListAsync(ct);

        return new ReservationManageResponseDto
        {
            Items = items,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages,
            Counts = counts
        };
    }

    private static List<string> ParseFeatures(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
            return new List<string>();

        var trimmed = json.Trim();
        if (trimmed.StartsWith('['))
        {
            try
            {
                return JsonSerializer.Deserialize<List<string>>(trimmed) ?? new List<string>();
            }
            catch
            {
            }
        }

        return trimmed
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();
    }
}
