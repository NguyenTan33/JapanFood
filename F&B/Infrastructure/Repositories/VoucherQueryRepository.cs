using Application.DTOs.Vouchers;
using Application.Interfaces.Repositories;
using Domain.Entities.Vouchers;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Repositories;

public class VoucherQueryRepository : IVoucherQueryRepository
{
    private readonly JapanFoodDbContext _context;

    public VoucherQueryRepository(JapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<VoucherValidationResultDto> GetActiveVoucherByCodeAsync(
        string code,
        decimal currentSubtotal,
        int userId,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code))
            return VoucherValidationResultDto.Invalid("Mã voucher không được để trống.");

        var now = DateTime.UtcNow;
        var normalizedCode = code.Trim().ToUpperInvariant();

        var voucher = await _context.Vouchers
            .AsNoTracking()
            .FirstOrDefaultAsync(v => v.VoucherCode == normalizedCode, ct);

        if (voucher == null)
            return VoucherValidationResultDto.Invalid("Mã voucher không tồn tại.");

        if (!voucher.IsActive)
            return VoucherValidationResultDto.Invalid("Voucher hiện đang bị tạm khóa.");

        if (now < voucher.StartDate)
            return VoucherValidationResultDto.Invalid($"Voucher chưa đến đợt áp dụng (Bắt đầu từ {voucher.StartDate:dd/MM/yyyy}).");

        if (now > voucher.EndDate)
            return VoucherValidationResultDto.Invalid($"Voucher đã hết hạn sử dụng lúc {voucher.EndDate:dd/MM/yyyy}.");

        if (voucher.UsedCount >= voucher.UsageLimit)
            return VoucherValidationResultDto.Invalid("Voucher đã hết lượt sử dụng.");

        if (currentSubtotal < voucher.MinOrderAmount)
            return VoucherValidationResultDto.Invalid($"Đơn hàng cần đạt tối thiểu {voucher.MinOrderAmount:N0}đ để dùng voucher này.");

        // Count how many times this user has used this voucher
        if (userId > 0)
        {
            var userUsageCount = await _context.UserVoucherUsages
                .AsNoTracking()
                .CountAsync(u => u.VoucherId == voucher.Id && u.UserId == userId, ct);

            if (userUsageCount >= voucher.UsagePerUserLimit)
                return VoucherValidationResultDto.Invalid($"Bạn đã sử dụng voucher này {userUsageCount} lần (Tối đa {voucher.UsagePerUserLimit} lần/tài khoản).");
        }

        // Calculate discount amount
        decimal calculatedDiscount = voucher.DiscountType == DiscountType.Percentage
            ? currentSubtotal * (voucher.DiscountValue / 100m)
            : voucher.DiscountValue;

        if (voucher.MaxDiscountAmount.HasValue && calculatedDiscount > voucher.MaxDiscountAmount.Value)
        {
            calculatedDiscount = voucher.MaxDiscountAmount.Value;
        }

        calculatedDiscount = Math.Min(calculatedDiscount, currentSubtotal);
        decimal finalTotal = Math.Max(0m, currentSubtotal - calculatedDiscount);

        return VoucherValidationResultDto.Success(
            voucher.Id,
            voucher.VoucherCode,
            calculatedDiscount,
            voucher.DiscountType.ToString(),
            finalTotal,
            "Áp dụng mã giảm giá thành công.");
    }

    public async Task<List<VoucherSummaryDto>> GetActivePublicVouchersAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        return await _context.Vouchers
            .AsNoTracking()
            .Where(v => v.IsActive && v.StartDate <= now && v.EndDate >= now && v.UsedCount < v.UsageLimit)
            .OrderBy(v => v.MinOrderAmount)
            .ThenBy(v => v.VoucherCode)
            .Select(v => new VoucherSummaryDto
            {
                Id = v.Id,
                Code = v.VoucherCode,
                Title = v.Title ?? v.VoucherCode,
                Description = v.Description,
                DiscountType = v.DiscountType.ToString(),
                DiscountValue = v.DiscountValue,
                MinOrderAmount = v.MinOrderAmount,
                MaxDiscountAmount = v.MaxDiscountAmount,
                StartDate = v.StartDate,
                EndDate = v.EndDate,
                IsActive = v.IsActive
            })
            .ToListAsync(ct);
    }

    public async Task<List<VoucherSummaryDto>> GetAllVouchersAsync(CancellationToken ct = default)
    {
        return await _context.Vouchers
            .AsNoTracking()
            .OrderByDescending(v => v.CreatedAt)
            .ThenBy(v => v.VoucherCode)
            .Select(v => new VoucherSummaryDto
            {
                Id = v.Id,
                Code = v.VoucherCode,
                Title = v.Title ?? v.VoucherCode,
                Description = v.Description,
                DiscountType = v.DiscountType.ToString(),
                DiscountValue = v.DiscountValue,
                MinOrderAmount = v.MinOrderAmount,
                MaxDiscountAmount = v.MaxDiscountAmount,
                StartDate = v.StartDate,
                EndDate = v.EndDate,
                IsActive = v.IsActive
            })
            .ToListAsync(ct);
    }
}
