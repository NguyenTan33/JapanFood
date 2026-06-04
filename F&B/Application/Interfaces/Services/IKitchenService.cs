using Application.DTOs.Kds;

namespace Application.Interfaces.Services;

public interface IKitchenService
{
    Task<bool> StartCookingItemAsync(int ticketItemId, int cookUserId, CancellationToken ct = default);
    Task<bool> MarkItemReadyAsync(int ticketItemId, int cookUserId, CancellationToken ct = default);
    Task<bool> MarkItemServedAsync(int ticketItemId, int staffUserId, CancellationToken ct = default);
    Task<CompleteOrReprintResponseDto> CompleteKitchenItemAsync(int ticketItemId, int cookUserId, CancellationToken ct = default);
    Task<CompleteOrReprintResponseDto> ReprintKitchenItemAsync(int ticketItemId, CancellationToken ct = default);
}
