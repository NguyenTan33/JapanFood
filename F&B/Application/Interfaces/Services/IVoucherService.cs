using Application.DTOs.Vouchers;

namespace Application.Interfaces.Services;

public interface IVoucherService
{
    Task<VoucherValidationResultDto> CreateVoucherAsync(CreateVoucherRequestDto request, CancellationToken ct = default);
    Task<bool> ActivateVoucherAsync(int voucherId, CancellationToken ct = default);
    Task<bool> DeactivateVoucherAsync(int voucherId, CancellationToken ct = default);
    Task<bool> DeleteVoucherAsync(int voucherId, CancellationToken ct = default);
    Task<VoucherValidationResultDto> ValidateAndApplyVoucherAsync(ApplyVoucherRequestDto request, int userId, CancellationToken ct = default);
}
