using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Content;

public class RestaurantSetting : BaseAuditableEntity
{
    public string SettingKey { get; protected set; } = "DEFAULT";
    public string BrandName { get; protected set; } = string.Empty;
    public string? JapaneseName { get; protected set; }
    public string? Slogan { get; protected set; }
    public string Hotline { get; protected set; } = string.Empty;
    public string Email { get; protected set; } = string.Empty;
    public string? FacebookUrl { get; protected set; }
    public string? InstagramUrl { get; protected set; }
    public string BankName { get; protected set; } = string.Empty;
    public string BankId { get; protected set; } = string.Empty;
    public string AccountNumber { get; protected set; } = string.Empty;
    public string AccountName { get; protected set; } = string.Empty;
    public string? BankBranch { get; protected set; }
    public string DefaultQrTemplate { get; protected set; } = "compact2";

    protected RestaurantSetting() { }

    public RestaurantSetting(
        string settingKey,
        string brandName,
        string hotline,
        string email,
        string bankName,
        string bankId,
        string accountNumber,
        string accountName,
        string? japaneseName = null,
        string? slogan = null,
        string? facebookUrl = null,
        string? instagramUrl = null,
        string? bankBranch = null,
        string defaultQrTemplate = "compact2")
    {
        if (string.IsNullOrWhiteSpace(settingKey))
            throw new BusinessException("Khóa cấu hình nhà hàng không được để trống.");
        if (string.IsNullOrWhiteSpace(brandName))
            throw new BusinessException("Tên thương hiệu không được để trống.");
        if (string.IsNullOrWhiteSpace(bankId) || string.IsNullOrWhiteSpace(accountNumber))
            throw new BusinessException("Thông tin ngân hàng VietQR không được để trống.");

        SettingKey = settingKey.Trim().ToUpperInvariant();
        BrandName = brandName.Trim();
        JapaneseName = japaneseName?.Trim();
        Slogan = slogan?.Trim();
        Hotline = hotline.Trim();
        Email = email.Trim();
        FacebookUrl = facebookUrl?.Trim();
        InstagramUrl = instagramUrl?.Trim();
        BankName = bankName.Trim();
        BankId = bankId.Trim().ToUpperInvariant();
        AccountNumber = accountNumber.Trim();
        AccountName = accountName.Trim();
        BankBranch = bankBranch?.Trim();
        DefaultQrTemplate = string.IsNullOrWhiteSpace(defaultQrTemplate) ? "compact2" : defaultQrTemplate.Trim();
    }

    public void UpdateDetails(
        string brandName,
        string hotline,
        string email,
        string bankName,
        string bankId,
        string accountNumber,
        string accountName,
        string? japaneseName,
        string? slogan,
        string? facebookUrl,
        string? instagramUrl,
        string? bankBranch,
        string defaultQrTemplate)
    {
        if (string.IsNullOrWhiteSpace(brandName))
            throw new BusinessException("Tên thương hiệu không được để trống.");
        if (string.IsNullOrWhiteSpace(bankId) || string.IsNullOrWhiteSpace(accountNumber))
            throw new BusinessException("Thông tin ngân hàng VietQR không được để trống.");

        BrandName = brandName.Trim();
        JapaneseName = japaneseName?.Trim();
        Slogan = slogan?.Trim();
        Hotline = hotline.Trim();
        Email = email.Trim();
        FacebookUrl = facebookUrl?.Trim();
        InstagramUrl = instagramUrl?.Trim();
        BankName = bankName.Trim();
        BankId = bankId.Trim().ToUpperInvariant();
        AccountNumber = accountNumber.Trim();
        AccountName = accountName.Trim();
        BankBranch = bankBranch?.Trim();
        DefaultQrTemplate = string.IsNullOrWhiteSpace(defaultQrTemplate) ? "compact2" : defaultQrTemplate.Trim();
        UpdatedAt = DateTime.UtcNow;
    }
}
