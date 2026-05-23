using Application.Common.Extensions;
using Application.Common.Models;
using Application.DTOs.Operations;
using Application.Interfaces.Repositories;
using Domain.Entities.Operations;
using Domain.Entities.Payment;
using Domain.Entities.TableManagement;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class ShiftQueryRepository : IShiftQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public ShiftQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<CurrentShiftResponseDto> GetCurrentShiftAsync(CancellationToken ct = default)
    {
        var openShift = await _context.CashierShifts
            .AsNoTracking()
            .Include(s => s.OpenedByUser)
            .Include(s => s.ClosedByUser)
            .Include(s => s.Withdrawals)
                .ThenInclude(w => w.WithdrawnByUser)
            .FirstOrDefaultAsync(s => s.Status == ShiftStatus.Open, ct);

        if (openShift == null)
        {
            return new CurrentShiftResponseDto
            {
                HasOpenShift = false,
                Shift = null
            };
        }

        var dto = await BuildShiftDtoAsync(openShift, ct);
        return new CurrentShiftResponseDto
        {
            HasOpenShift = true,
            Shift = dto
        };
    }

    public async Task<ShiftDto?> GetShiftByIdAsync(int shiftId, CancellationToken ct = default)
    {
        var shift = await _context.CashierShifts
            .AsNoTracking()
            .Include(s => s.OpenedByUser)
            .Include(s => s.ClosedByUser)
            .Include(s => s.Withdrawals)
                .ThenInclude(w => w.WithdrawnByUser)
            .FirstOrDefaultAsync(s => s.Id == shiftId, ct);

        if (shift == null) return null;

        return await BuildShiftDtoAsync(shift, ct);
    }

    public async Task<PagedResult<ShiftDto>> GetShiftsAsync(DateTime? fromDate, DateTime? toDate, int page = 1, int pageSize = 20, CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize <= 0 ? 20 : pageSize, 1, 100);

        var query = _context.CashierShifts
            .AsNoTracking()
            .Include(s => s.OpenedByUser)
            .Include(s => s.ClosedByUser)
            .Include(s => s.Withdrawals)
                .ThenInclude(w => w.WithdrawnByUser)
            .AsQueryable();

        if (fromDate.HasValue)
        {
            var start = fromDate.Value.Date;
            query = query.Where(s => s.OpenedAt >= start);
        }

        if (toDate.HasValue)
        {
            var endBound = toDate.Value.TimeOfDay == TimeSpan.Zero
                ? toDate.Value.Date.AddDays(1)
                : toDate.Value.AddTicks(1);
            query = query.Where(s => s.OpenedAt < endBound);
        }

        var totalCount = await query.CountAsync(ct);

        var shifts = await query
            .OrderByDescending(s => s.OpenedAt)
            .ThenByDescending(s => s.Id)
            .ApplyPaging(page, pageSize)
            .ToListAsync(ct);

        if (shifts.Count == 0)
        {
            return new PagedResult<ShiftDto>(new List<ShiftDto>(), totalCount, page, pageSize);
        }

        var shiftIds = shifts.Select(s => s.Id).ToList();
        var txns = await _context.PaymentTransactions
            .AsNoTracking()
            .Where(p => p.ShiftId.HasValue
                     && shiftIds.Contains(p.ShiftId.Value)
                     && p.Status == PaymentTransactionStatus.Success)
            .Select(p => new
            {
                ShiftId = p.ShiftId!.Value,
                p.Gateway,
                p.Amount,
                p.OrderId
            })
            .ToListAsync(ct);

        var txnsByShift = txns.GroupBy(t => t.ShiftId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var openTablesCount = await _context.Tables
            .AsNoTracking()
            .CountAsync(t => t.IsActive && t.Status == TableStatus.Serving, ct);

        var items = shifts.Select(shift =>
        {
            txnsByShift.TryGetValue(shift.Id, out var shiftTxns);
            shiftTxns ??= [];

            var cashSales = shiftTxns
                .Where(t => t.Gateway == PaymentGateway.Cash)
                .Sum(t => t.Amount);
            var transferSales = shiftTxns
                .Where(t => t.Gateway != PaymentGateway.Cash)
                .Sum(t => t.Amount);
            var ordersCount = shiftTxns
                .Select(t => t.OrderId)
                .Distinct()
                .Count();

            return MapShiftDto(shift, cashSales, transferSales, ordersCount, shift.Status == ShiftStatus.Open ? openTablesCount : 0);
        }).ToList();

        return new PagedResult<ShiftDto>(items, totalCount, page, pageSize);
    }

    private async Task<ShiftDto> BuildShiftDtoAsync(CashierShift shift, CancellationToken ct)
    {
        var txns = await _context.PaymentTransactions
            .AsNoTracking()
            .Where(p => p.ShiftId == shift.Id && p.Status == PaymentTransactionStatus.Success)
            .Select(p => new { p.Gateway, p.Amount, p.OrderId })
            .ToListAsync(ct);

        var cashSales = txns.Where(t => t.Gateway == PaymentGateway.Cash).Sum(t => t.Amount);
        var transferSales = txns.Where(t => t.Gateway != PaymentGateway.Cash).Sum(t => t.Amount);
        var ordersCount = txns.Select(t => t.OrderId).Distinct().Count();

        var openTablesCount = shift.Status == ShiftStatus.Open
            ? await _context.Tables.AsNoTracking().CountAsync(t => t.IsActive && t.Status == TableStatus.Serving, ct)
            : 0;

        return MapShiftDto(shift, cashSales, transferSales, ordersCount, openTablesCount);
    }

    private static ShiftDto MapShiftDto(
        CashierShift shift,
        decimal cashSalesTotal,
        decimal transferSalesTotal,
        int totalOrdersCount,
        int openTablesCount)
    {
        var totalWithdrawn = shift.Withdrawals.Sum(w => w.Amount);
        var remainingCash = shift.OpeningCash + cashSalesTotal - totalWithdrawn;

        return new ShiftDto
        {
            Id = shift.Id,
            ShiftCode = shift.ShiftCode,
            OpenedByUserId = shift.OpenedByUserId,
            OpenedByName = shift.OpenedByUser?.FullName ?? $"Nhân viên #{shift.OpenedByUserId}",
            OpenedAt = shift.OpenedAt,
            OpeningCash = shift.OpeningCash,
            CashSalesTotal = cashSalesTotal,
            TransferSalesTotal = transferSalesTotal,
            TotalWithdrawn = totalWithdrawn,
            CurrentRemainingCash = remainingCash,
            TotalOrdersCount = totalOrdersCount,
            Status = shift.Status.ToString(),
            ClosedByUserId = shift.ClosedByUserId,
            ClosedByName = shift.ClosedByUser?.FullName,
            ClosedAt = shift.ClosedAt,
            ClosingActualCash = shift.ClosingActualCash,
            ExpectedCash = shift.ExpectedCash,
            VarianceAmount = shift.VarianceAmount,
            Notes = shift.Notes,
            OpenTablesCount = openTablesCount,
            Withdrawals = shift.Withdrawals
                .OrderByDescending(w => w.WithdrawnAt)
                .Select(w => new CashWithdrawalDto
                {
                    Id = w.Id,
                    Amount = w.Amount,
                    PhotoUrl = w.PhotoUrl,
                    Note = w.Note,
                    WithdrawnByUserId = w.WithdrawnByUserId,
                    WithdrawnByName = w.WithdrawnByUser?.FullName ?? $"Admin #{w.WithdrawnByUserId}",
                    WithdrawnAt = w.WithdrawnAt
                })
                .ToList()
        };
    }
}
