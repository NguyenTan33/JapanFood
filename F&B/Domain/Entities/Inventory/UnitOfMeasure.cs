using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class UnitOfMeasure : BaseEntity
{
    public string Code { get; protected set; } = string.Empty;
    public string Name { get; protected set; } = string.Empty;
    public int? BaseUomId { get; protected set; }
    public decimal ConversionFactor { get; protected set; } = 1.0000m;
    public bool IsActive { get; protected set; } = true;

    public virtual UnitOfMeasure? BaseUom { get; protected set; }

    protected UnitOfMeasure() { }

    public UnitOfMeasure(string code, string name, int? baseUomId = null, decimal conversionFactor = 1.0000m)
    {
        if (string.IsNullOrWhiteSpace(code))
            throw new BusinessException("Mã đơn vị tính không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên đơn vị tính không được để trống.");
        if (conversionFactor <= 0)
            throw new BusinessException("Hệ số quy đổi phải lớn hơn 0.");

        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        BaseUomId = baseUomId;
        ConversionFactor = conversionFactor;
        IsActive = true;
    }

    public void UpdateConversion(int? baseUomId, decimal conversionFactor)
    {
        if (baseUomId.HasValue && baseUomId.Value == Id && Id > 0)
            throw new BusinessException("Đơn vị tính không thể lấy chính nó làm đơn vị cơ sở.");
        if (conversionFactor <= 0)
            throw new BusinessException("Hệ số quy đổi phải lớn hơn 0.");

        BaseUomId = baseUomId;
        ConversionFactor = conversionFactor;
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
