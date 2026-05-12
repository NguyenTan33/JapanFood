using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Menu;

public class ModifierOption : BaseAuditableEntity
{
    public int ModifierGroupId { get; protected set; }
    public string OptionCode { get; protected set; } = string.Empty;
    public string OptionName { get; protected set; } = string.Empty;
    public decimal PriceAdjustment { get; protected set; } = 0m;
    public bool IsDefault { get; protected set; } = false;
    public bool IsAvailable { get; protected set; } = true;
    public int DisplayOrder { get; protected set; }

    public virtual ModifierGroup ModifierGroup { get; protected set; } = null!;

    protected ModifierOption() { }

    public ModifierOption(
        int modifierGroupId,
        string optionCode,
        string optionName,
        decimal priceAdjustment = 0m,
        bool isDefault = false,
        int displayOrder = 0)
    {
        if (string.IsNullOrWhiteSpace(optionCode))
            throw new BusinessException("Mã tùy chọn không được để trống.");
        if (string.IsNullOrWhiteSpace(optionName))
            throw new BusinessException("Tên tùy chọn không được để trống.");
        if (priceAdjustment < 0)
            throw new BusinessException("Phụ thu tùy chọn không được âm.");

        ModifierGroupId = modifierGroupId;
        OptionCode = optionCode.Trim().ToUpperInvariant();
        OptionName = optionName.Trim();
        PriceAdjustment = priceAdjustment;
        IsDefault = isDefault;
        DisplayOrder = displayOrder;
        IsAvailable = true;
    }

    public void UpdatePrice(decimal newPriceAdjustment)
    {
        if (newPriceAdjustment < 0)
            throw new BusinessException("Phụ thu tùy chọn không được âm.");

        PriceAdjustment = newPriceAdjustment;
    }

    public void SetAvailability(bool isAvailable) => IsAvailable = isAvailable;
    public void SetDefault(bool isDefault) => IsDefault = isDefault;

    public void UpdateDetails(string optionName, decimal priceAdjustment, bool isDefault, bool isAvailable, int displayOrder)
    {
        if (string.IsNullOrWhiteSpace(optionName))
            throw new BusinessException("Tên tùy chọn không được để trống.");
        if (priceAdjustment < 0)
            throw new BusinessException("Phụ thu tùy chọn không được âm.");

        OptionName = optionName.Trim();
        PriceAdjustment = priceAdjustment;
        IsDefault = isDefault;
        IsAvailable = isAvailable;
        DisplayOrder = displayOrder;
    }
}
