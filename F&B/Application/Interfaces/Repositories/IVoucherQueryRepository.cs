using Application.DTOs.Vouchers;

namespace Application.Interfaces.Repositories;

public interface IVoucherQueryRepository
{
    Task<VoucherValidationResultDto> GetActiveVoucherByCodeAsync(
        string code,
        decimal currentSubtotal,
        int userId,
        CancellationToken ct = default);

    Task<List<VoucherSummaryDto>> GetActivePublicVouchersAsync(CancellationToken ct = default);

    Task<List<VoucherSummaryDto>> GetAllVouchersAsync(CancellationToken ct = default);
}
