using Application.DTOs.User;

namespace Application.Interfaces.Services;

public interface IUserAddressService
{
    Task<List<UserAddressDto>> GetUserAddressesAsync(int userId, CancellationToken ct = default);
    Task<UserAddressDto> CreateAddressAsync(int userId, CreateAddressRequestDto request, CancellationToken ct = default);
    Task<UserAddressDto> UpdateAddressAsync(int userId, int addressId, UpdateAddressRequestDto request, CancellationToken ct = default);
    Task DeleteAddressAsync(int userId, int addressId, CancellationToken ct = default);
    Task<UserAddressDto> SetDefaultAddressAsync(int userId, int addressId, CancellationToken ct = default);
}
