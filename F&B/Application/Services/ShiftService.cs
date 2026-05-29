using Application.Common.Validation;
using Application.DTOs.Operations;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Interfaces.Storage;
using Domain.Entities.Operations;
using Domain.Entities.Payment;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class ShiftService : IShiftService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IShiftQueryRepository _shiftQueryRepo;
    private readonly IFileStorageService _fileStorageService;
    private readonly IValidationFactory _validationFactory;
    private readonly ILogger<ShiftService> _logger;

    public ShiftService(
        IUnitOfWork unitOfWork,
        IShiftQueryRepository shiftQueryRepo,
        IFileStorageService fileStorageService,
        IValidationFactory validationFactory,
        ILogger<ShiftService> logger)
    {
        _unitOfWork = unitOfWork;
        _shiftQueryRepo = shiftQueryRepo;
        _fileStorageService = fileStorageService;
        _validationFactory = validationFactory;
        _logger = logger;
    }

    public async Task<ShiftDto> OpenShiftAsync(OpenShiftRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên mở ca không hợp lệ.");

        var hasOpenShift = await _unitOfWork.Context.CashierShifts
            .AnyAsync(s => s.Status == ShiftStatus.Open, ct);

        if (hasOpenShift)
        {
            throw new ConflictException("Hiện đang có một ca trực đang mở. Vui lòng đóng ca hiện tại trước khi mở ca mới.");
        }

        var shift = new CashierShift(staffUserId, request.OpeningCash, request.Notes);
        _unitOfWork.Context.CashierShifts.Add(shift);

        try
        {
            await _unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex)
        {
            _logger.LogWarning(ex, "Xung đột khi mở ca trực đồng thời");
            throw new ConflictException("Hiện đang có một ca trực đang mở. Vui lòng đóng ca hiện tại trước khi mở ca mới.");
        }

        return (await _shiftQueryRepo.GetShiftByIdAsync(shift.Id, ct))!;
    }

    public async Task<ShiftDto> CloseShiftAsync(CloseShiftRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên đóng ca không hợp lệ.");

        var shift = await _unitOfWork.Context.CashierShifts
            .Include(s => s.Withdrawals)
            .FirstOrDefaultAsync(s => s.Status == ShiftStatus.Open, ct);

        if (shift == null)
        {
            throw new BusinessException("Hiện không có ca trực nào đang mở để đóng.");
        }

        var cashSalesTotal = await _unitOfWork.Context.PaymentTransactions
            .Where(p => p.ShiftId == shift.Id
                     && p.Status == PaymentTransactionStatus.Success
                     && p.Gateway == PaymentGateway.Cash)
            .SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;

        var totalWithdrawn = shift.Withdrawals.Sum(w => w.Amount);
        var expectedCash = shift.OpeningCash + cashSalesTotal - totalWithdrawn;

        shift.Close(staffUserId, request.ActualCash, expectedCash, request.Notes);

        try
        {
            await _unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Xung đột đồng thời khi đóng ca #{ShiftId}", shift.Id);
            throw new ConflictException("Dữ liệu ca trực vừa bị thay đổi bởi thao tác khác. Vui lòng tải lại và thử lại.");
        }

        return (await _shiftQueryRepo.GetShiftByIdAsync(shift.Id, ct))!;
    }

    public async Task<ShiftDto> WithdrawFromCurrentShiftAsync(
        decimal amount,
        string? note,
        Stream photoStream,
        string photoFileName,
        int adminUserId,
        CancellationToken ct = default)
    {
        if (adminUserId <= 0)
            throw new BusinessException("Mã quản trị viên thu tiền không hợp lệ.");
        if (amount <= 0)
            throw new BusinessException("Số tiền thu két phải lớn hơn 0.");
        if (photoStream == null || photoStream.Length == 0)
            throw new BusinessException("Ảnh xác nhận thu tiền két là bắt buộc.");
        if (string.IsNullOrWhiteSpace(photoFileName))
            throw new BusinessException("Tên tệp ảnh xác nhận không hợp lệ.");
        if (!string.IsNullOrWhiteSpace(note) && note.Trim().Length > 500)
            throw new BusinessException("Ghi chú thu tiền két không được vượt quá 500 ký tự.");

        using var tx = await _unitOfWork.BeginTransactionAsync(ct);
        string? savedPhotoUrl = null;

        try
        {
            var shift = await _unitOfWork.Context.CashierShifts
                .Include(s => s.Withdrawals)
                .FirstOrDefaultAsync(s => s.Status == ShiftStatus.Open, ct);

            if (shift == null)
            {
                throw new BusinessException("Hiện không có ca trực nào đang mở để thu tiền két.");
            }

            var cashSalesTotal = await _unitOfWork.Context.PaymentTransactions
                .Where(p => p.ShiftId == shift.Id
                         && p.Status == PaymentTransactionStatus.Success
                         && p.Gateway == PaymentGateway.Cash)
                .SumAsync(p => (decimal?)p.Amount, ct) ?? 0m;

            var totalWithdrawn = shift.Withdrawals.Sum(w => w.Amount);
            var currentRemainingCash = shift.OpeningCash + cashSalesTotal - totalWithdrawn;

            if (amount > currentRemainingCash)
            {
                throw new BusinessException($"Số tiền thu két ({amount:N0} đ) vượt quá số tiền mặt hiện có trong két ({currentRemainingCash:N0} đ).");
            }

            savedPhotoUrl = await _fileStorageService.SaveFileAsync(photoStream, photoFileName, "withdrawals", ct);

            var withdrawal = shift.RecordWithdrawal(adminUserId, amount, savedPhotoUrl, currentRemainingCash, note);
            _unitOfWork.Context.CashDrawerWithdrawals.Add(withdrawal);

            await _unitOfWork.SaveChangesAsync(ct);
            await _unitOfWork.CommitTransactionAsync(ct);

            return (await _shiftQueryRepo.GetShiftByIdAsync(shift.Id, ct))!;
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Xung đột đồng thời khi thu tiền két.");
            await _unitOfWork.RollbackTransactionAsync(ct);
            await CleanupPhotoSafelyAsync(savedPhotoUrl);
            throw new ConflictException("Số dư két vừa thay đổi bởi thao tác khác. Vui lòng tải lại và thử lại.");
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(ct);
            await CleanupPhotoSafelyAsync(savedPhotoUrl);
            throw;
        }
    }

    private async Task CleanupPhotoSafelyAsync(string? photoUrl)
    {
        if (string.IsNullOrWhiteSpace(photoUrl)) return;
        try
        {
            await _fileStorageService.DeleteFileAsync(photoUrl, CancellationToken.None);
        }
        catch (Exception cleanupEx)
        {
            _logger.LogWarning(cleanupEx, "Không thể xóa tệp ảnh thu két mồ côi: {PhotoUrl}", photoUrl);
        }
    }
}
