using Application.DTOs.Operations;

namespace Application.Interfaces.Services;

public interface IShiftService
{
    Task<ShiftDto> OpenShiftAsync(OpenShiftRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<ShiftDto> CloseShiftAsync(CloseShiftRequestDto request, int staffUserId, CancellationToken ct = default);
    Task<ShiftDto> WithdrawFromCurrentShiftAsync(
        decimal amount,
        string? note,
        Stream photoStream,
        string photoFileName,
        int adminUserId,
        CancellationToken ct = default);
}
