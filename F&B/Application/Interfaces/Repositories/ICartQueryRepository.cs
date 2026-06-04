using Application.DTOs.Cart;

namespace Application.Interfaces.Repositories;

public interface ICartQueryRepository
{
    Task<CartViewDto> GetUserCartAsync(int userId, CancellationToken ct = default);
}
