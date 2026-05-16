using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Content;

public class Branch : BaseAuditableEntity
{
    public string Code { get; protected set; } = string.Empty;
    public string Name { get; protected set; } = string.Empty;
    public string? JapaneseName { get; protected set; }
    public string Address { get; protected set; } = string.Empty;
    public string District { get; protected set; } = string.Empty;
    public string City { get; protected set; } = string.Empty;
    public string Phone { get; protected set; } = string.Empty;
    public string? Hotline { get; protected set; }
    public string? Email { get; protected set; }
    public string? OpeningHoursLunch { get; protected set; }
    public string? OpeningHoursDinner { get; protected set; }
    public string? OpeningHoursNote { get; protected set; }
    public string? ParkingMotorbike { get; protected set; }
    public string? ParkingCar { get; protected set; }
    public string? MapEmbedUrl { get; protected set; }
    public string? MapDirectionsUrl { get; protected set; }
    public string? ImageUrl { get; protected set; }
    public bool IsMainBranch { get; protected set; }
    public int DisplayOrder { get; protected set; }
    public bool IsActive { get; protected set; } = true;

    protected Branch() { }

    public Branch(
        string code,
        string name,
        string address,
        string district,
        string city,
        string phone,
        string? japaneseName = null,
        string? hotline = null,
        string? email = null,
        string? openingHoursLunch = null,
        string? openingHoursDinner = null,
        string? openingHoursNote = null,
        string? parkingMotorbike = null,
        string? parkingCar = null,
        string? mapEmbedUrl = null,
        string? mapDirectionsUrl = null,
        string? imageUrl = null,
        bool isMainBranch = false,
        int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new BusinessException("Mã chi nhánh không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên chi nhánh không được để trống.");
        if (string.IsNullOrWhiteSpace(address))
            throw new BusinessException("Địa chỉ chi nhánh không được để trống.");
        if (string.IsNullOrWhiteSpace(phone))
            throw new BusinessException("Số điện thoại chi nhánh không được để trống.");

        Code = code.Trim().ToLowerInvariant();
        Name = name.Trim();
        JapaneseName = japaneseName?.Trim();
        Address = address.Trim();
        District = district.Trim();
        City = city.Trim();
        Phone = phone.Trim();
        Hotline = hotline?.Trim();
        Email = email?.Trim();
        OpeningHoursLunch = openingHoursLunch?.Trim();
        OpeningHoursDinner = openingHoursDinner?.Trim();
        OpeningHoursNote = openingHoursNote?.Trim();
        ParkingMotorbike = parkingMotorbike?.Trim();
        ParkingCar = parkingCar?.Trim();
        MapEmbedUrl = mapEmbedUrl?.Trim();
        MapDirectionsUrl = mapDirectionsUrl?.Trim();
        ImageUrl = imageUrl?.Trim();
        IsMainBranch = isMainBranch;
        DisplayOrder = displayOrder;
        IsActive = true;
    }

    public void UpdateDetails(
        string name,
        string address,
        string district,
        string city,
        string phone,
        string? japaneseName,
        string? hotline,
        string? email,
        string? openingHoursLunch,
        string? openingHoursDinner,
        string? openingHoursNote,
        string? parkingMotorbike,
        string? parkingCar,
        string? mapEmbedUrl,
        string? mapDirectionsUrl,
        string? imageUrl,
        bool isMainBranch,
        int displayOrder,
        bool isActive = true)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên chi nhánh không được để trống.");
        if (string.IsNullOrWhiteSpace(address))
            throw new BusinessException("Địa chỉ chi nhánh không được để trống.");
        if (string.IsNullOrWhiteSpace(phone))
            throw new BusinessException("Số điện thoại chi nhánh không được để trống.");

        Name = name.Trim();
        JapaneseName = japaneseName?.Trim();
        Address = address.Trim();
        District = district.Trim();
        City = city.Trim();
        Phone = phone.Trim();
        Hotline = hotline?.Trim();
        Email = email?.Trim();
        OpeningHoursLunch = openingHoursLunch?.Trim();
        OpeningHoursDinner = openingHoursDinner?.Trim();
        OpeningHoursNote = openingHoursNote?.Trim();
        ParkingMotorbike = parkingMotorbike?.Trim();
        ParkingCar = parkingCar?.Trim();
        MapEmbedUrl = mapEmbedUrl?.Trim();
        MapDirectionsUrl = mapDirectionsUrl?.Trim();
        ImageUrl = imageUrl?.Trim();
        IsMainBranch = isMainBranch;
        DisplayOrder = displayOrder;
        IsActive = isActive;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
