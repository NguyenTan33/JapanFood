using Application.Common.Validation;
using Application.DTOs.Vouchers;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Entities.Vouchers;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class VoucherService : IVoucherService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IVoucherQueryRepository _voucherQueryRepo;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<VoucherService> _logger;

    public VoucherService(
        IUnitOfWork unitOfWork,
        IVoucherQueryRepository voucherQueryRepo,
        IValidationFactory validationFactory,
        ILogger<VoucherService> logger)
    {
        _unitOfWork = unitOfWork;
        _voucherQueryRepo = voucherQueryRepo;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<VoucherValidationResultDto> CreateVoucherAsync(CreateVoucherRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 2. Check for duplicate voucher code
        var codeUpper = request.VoucherCode.Trim().ToUpperInvariant();
        var exists = await _unitOfWork.Context.Vouchers.AnyAsync(v => v.VoucherCode == codeUpper, ct);
        if (exists)
            throw new ConflictException($"Voucher có mã '{request.VoucherCode}' đã tồn tại trong hệ thống.");

        // 3. Create and add Domain entity
        var voucher = new Voucher(
            request.VoucherCode,
            request.DiscountType,
            request.DiscountValue,
            request.StartDate,
            request.EndDate,
            request.MinOrderAmount,
            request.MaxDiscountAmount,
            request.UsageLimit,
            request.UsagePerUserLimit);

        _unitOfWork.Context.Vouchers.Add(voucher);
        await _unitOfWork.SaveChangesAsync(ct);

        return VoucherValidationResultDto.Success(voucher.Id, voucher.VoucherCode, 0m);
    }

    public async Task<bool> ActivateVoucherAsync(int voucherId, CancellationToken ct = default)
    {
        var voucher = await _unitOfWork.Context.Vouchers.FirstOrDefaultAsync(v => v.Id == voucherId, ct);
        if (voucher == null)
            throw new NotFoundException($"Không tìm thấy voucher #{voucherId}.");

        voucher.Activate();
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeactivateVoucherAsync(int voucherId, CancellationToken ct = default)
    {
        var voucher = await _unitOfWork.Context.Vouchers.FirstOrDefaultAsync(v => v.Id == voucherId, ct);
        if (voucher == null)
            throw new NotFoundException($"Không tìm thấy voucher #{voucherId}.");

        voucher.Deactivate();
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<VoucherValidationResultDto> ValidateAndApplyVoucherAsync(ApplyVoucherRequestDto request, int userId, CancellationToken ct = default)
    {
        if (userId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");

        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 2. Evaluate validity and calculate discount amount via query repo
        return await _voucherQueryRepo.GetActiveVoucherByCodeAsync(request.Code, request.CurrentSubtotal, userId, ct);
    }

    public async Task<bool> DeleteVoucherAsync(int voucherId, CancellationToken ct = default)
    {
        var voucher = await _unitOfWork.Context.Vouchers.FirstOrDefaultAsync(v => v.Id == voucherId, ct);
        if (voucher == null)
            throw new NotFoundException($"Không tìm thấy voucher #{voucherId}.");

        var usages = await _unitOfWork.Context.UserVoucherUsages.Where(u => u.VoucherId == voucherId).ToListAsync(ct);
        if (usages.Any())
        {
            _unitOfWork.Context.UserVoucherUsages.RemoveRange(usages);
        }

        _unitOfWork.Context.Vouchers.Remove(voucher);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }
}
