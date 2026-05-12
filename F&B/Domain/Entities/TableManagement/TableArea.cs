using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.TableManagement;

public class TableArea : BaseAuditableEntity
{
    public string AreaCode { get; protected set; } = string.Empty;
    public string AreaName { get; protected set; } = string.Empty;
    public string? JapaneseName { get; protected set; }
    public string? Description { get; protected set; }
    public string? ImageUrl { get; protected set; }
    public string? Features { get; protected set; }
    public string? CapacityPerTable { get; protected set; }
    public int MinGuests { get; protected set; } = 1;
    public int MaxGuests { get; protected set; } = 10;
    public bool RequiresDeposit { get; protected set; } = false;
    public decimal? DepositPerGuest { get; protected set; }
    public bool IsActive { get; protected set; } = true;
    public int DisplayOrder { get; protected set; }

    private readonly List<Table> _tables = new();
    public virtual IReadOnlyCollection<Table> Tables => _tables.AsReadOnly();

    protected TableArea() { }

    public TableArea(string areaCode, string areaName, string? description = null, int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(areaCode))
            throw new BusinessException("Mã khu vực không được để trống.");
        if (string.IsNullOrWhiteSpace(areaName))
            throw new BusinessException("Tên khu vực không được để trống.");

        AreaCode = areaCode.Trim().ToUpperInvariant();
        AreaName = areaName.Trim();
        Description = description?.Trim();
        DisplayOrder = displayOrder;
        IsActive = true;
    }

    public void UpdateInfo(string areaName, string? description = null, int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(areaName))
            throw new BusinessException("Tên khu vực không được để trống.");

        AreaName = areaName.Trim();
        Description = description?.Trim();
        DisplayOrder = displayOrder;
    }

    public void UpdateRichDetails(
        string areaName,
        string? japaneseName,
        string? description,
        string? imageUrl,
        string? features,
        string? capacityPerTable,
        int minGuests,
        int maxGuests,
        bool requiresDeposit,
        decimal? depositPerGuest,
        int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(areaName))
            throw new BusinessException("Tên khu vực không được để trống.");
        if (minGuests < 1)
            throw new BusinessException("Số khách tối thiểu phải lớn hơn hoặc bằng 1.");
        if (maxGuests < minGuests)
            throw new BusinessException("Số khách tối đa phải lớn hơn hoặc bằng số khách tối thiểu.");
        if (depositPerGuest.HasValue && depositPerGuest.Value < 0)
            throw new BusinessException("Tiền đặt cọc mỗi khách không được âm.");

        AreaName = areaName.Trim();
        JapaneseName = japaneseName?.Trim();
        Description = description?.Trim();
        ImageUrl = imageUrl?.Trim();
        Features = features;
        CapacityPerTable = capacityPerTable?.Trim();
        MinGuests = minGuests;
        MaxGuests = maxGuests;
        RequiresDeposit = requiresDeposit;
        DepositPerGuest = depositPerGuest;
        DisplayOrder = displayOrder;
    }

    public void AddTable(Table table)
    {
        ArgumentNullException.ThrowIfNull(table);
        if (_tables.Any(t => t.TableNumber.Equals(table.TableNumber, StringComparison.OrdinalIgnoreCase)))
            throw new BusinessException($"Bàn số '{table.TableNumber}' đã tồn tại trong khu vực {AreaName}.");

        _tables.Add(table);
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
