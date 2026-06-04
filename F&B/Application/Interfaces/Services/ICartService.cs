using Application.DTOs.Cart;

namespace Application.Interfaces.Services;

public interface ICartService
{
    Task<CartViewDto> AddToCartAsync(AddToCartRequestDto request, CancellationToken ct = default);
    Task<CartViewDto> UpdateQuantityAsync(int userId, int cartItemId, int quantity, CancellationToken ct = default);
    Task<CartViewDto> RemoveItemAsync(int userId, int cartItemId, CancellationToken ct = default);
    Task<bool> ClearCartAsync(int userId, CancellationToken ct = default);
}
