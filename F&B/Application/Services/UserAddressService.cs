using Application.DTOs.User;
using Application.Interfaces;
using Application.Interfaces.Services;
using Domain.Entities;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace Application.Services;

public class UserAddressService : IUserAddressService
{
    private readonly IJapanFoodDbContext _context;

    public UserAddressService(IJapanFoodDbContext context)
    {
        _context = context;
    }

    public async Task<List<UserAddressDto>> GetUserAddressesAsync(int userId, CancellationToken ct = default)
    {
        var addresses = await _context.UserAddresses
            .AsNoTracking()
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.IsDefault == "Y")
            .ThenByDescending(a => a.AddressId)
            .ToListAsync(ct);

        return addresses.Select(MapToDto).ToList();
    }

    public async Task<UserAddressDto> CreateAddressAsync(int userId, CreateAddressRequestDto request, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.RecipientName))
            throw new BusinessException("Tên người nhận không được để trống.");
        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
            throw new BusinessException("Số điện thoại nhận hàng không được để trống.");
        if (string.IsNullOrWhiteSpace(request.StreetAddress))
            throw new BusinessException("Địa chỉ đường/nhà không được để trống.");

        // Check if user has any existing addresses
        var existingCount = await _context.UserAddresses.CountAsync(a => a.UserId == userId, ct);
        var isFirstAddress = existingCount == 0;
        var shouldBeDefault = request.IsDefault || isFirstAddress;

        if (shouldBeDefault)
        {
            var otherDefaults = await _context.UserAddresses
                .Where(a => a.UserId == userId && a.IsDefault == "Y")
                .ToListAsync(ct);
            foreach (var addr in otherDefaults)
            {
                addr.IsDefault = "N";
            }
        }

        var newAddress = new UserAddress
        {
            UserId = userId,
            RecipientName = request.RecipientName.Trim(),
            PhoneNumber = request.PhoneNumber.Trim(),
            StreetAddress = request.StreetAddress.Trim(),
            Ward = request.Ward?.Trim() ?? string.Empty,
            District = request.District?.Trim() ?? string.Empty,
            City = request.City?.Trim() ?? "TP. Hồ Chí Minh",
            IsDefault = shouldBeDefault ? "Y" : "N"
        };

        _context.UserAddresses.Add(newAddress);
        await _context.SaveChangesAsync(ct);

        return MapToDto(newAddress);
    }

    public async Task<UserAddressDto> UpdateAddressAsync(int userId, int addressId, UpdateAddressRequestDto request, CancellationToken ct = default)
    {
        var address = await _context.UserAddresses
            .FirstOrDefaultAsync(a => a.AddressId == addressId && a.UserId == userId, ct);

        if (address == null)
            throw new BusinessException("Không tìm thấy địa chỉ giao hàng.");

        if (!string.IsNullOrWhiteSpace(request.RecipientName))
            address.RecipientName = request.RecipientName.Trim();
        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
            address.PhoneNumber = request.PhoneNumber.Trim();
        if (!string.IsNullOrWhiteSpace(request.StreetAddress))
            address.StreetAddress = request.StreetAddress.Trim();
        if (request.Ward != null)
            address.Ward = request.Ward.Trim();
        if (request.District != null)
            address.District = request.District.Trim();
        if (request.City != null)
            address.City = request.City.Trim();

        if (request.IsDefault && address.IsDefault != "Y")
        {
            var otherDefaults = await _context.UserAddresses
                .Where(a => a.UserId == userId && a.AddressId != addressId && a.IsDefault == "Y")
                .ToListAsync(ct);
            foreach (var a in otherDefaults)
            {
                a.IsDefault = "N";
            }
            address.IsDefault = "Y";
        }

        await _context.SaveChangesAsync(ct);
        return MapToDto(address);
    }

    public async Task DeleteAddressAsync(int userId, int addressId, CancellationToken ct = default)
    {
        var address = await _context.UserAddresses
            .FirstOrDefaultAsync(a => a.AddressId == addressId && a.UserId == userId, ct);

        if (address == null)
            throw new BusinessException("Không tìm thấy địa chỉ cần xóa.");

        var wasDefault = address.IsDefault == "Y";
        _context.UserAddresses.Remove(address);
        await _context.SaveChangesAsync(ct);

        if (wasDefault)
        {
            var nextDefault = await _context.UserAddresses
                .Where(a => a.UserId == userId)
                .OrderByDescending(a => a.AddressId)
                .FirstOrDefaultAsync(ct);
            if (nextDefault != null)
            {
                nextDefault.IsDefault = "Y";
                await _context.SaveChangesAsync(ct);
            }
        }
    }

    public async Task<UserAddressDto> SetDefaultAddressAsync(int userId, int addressId, CancellationToken ct = default)
    {
        var address = await _context.UserAddresses
            .FirstOrDefaultAsync(a => a.AddressId == addressId && a.UserId == userId, ct);

        if (address == null)
            throw new BusinessException("Không tìm thấy địa chỉ chỉ định.");

        var otherDefaults = await _context.UserAddresses
            .Where(a => a.UserId == userId && a.AddressId != addressId && a.IsDefault == "Y")
            .ToListAsync(ct);

        foreach (var a in otherDefaults)
        {
            a.IsDefault = "N";
        }

        address.IsDefault = "Y";
        await _context.SaveChangesAsync(ct);

        return MapToDto(address);
    }

    private static UserAddressDto MapToDto(UserAddress entity)
    {
        var parts = new List<string>();
        if (!string.IsNullOrWhiteSpace(entity.StreetAddress)) parts.Add(entity.StreetAddress);
        if (!string.IsNullOrWhiteSpace(entity.Ward)) parts.Add(entity.Ward);
        if (!string.IsNullOrWhiteSpace(entity.District)) parts.Add(entity.District);
        if (!string.IsNullOrWhiteSpace(entity.City)) parts.Add(entity.City);

        return new UserAddressDto
        {
            AddressId = entity.AddressId,
            UserId = entity.UserId,
            RecipientName = entity.RecipientName,
            PhoneNumber = entity.PhoneNumber,
            StreetAddress = entity.StreetAddress,
            Ward = entity.Ward,
            District = entity.District,
            City = entity.City,
            FullAddress = string.Join(", ", parts),
            IsDefault = entity.IsDefault == "Y"
        };
    }
}
