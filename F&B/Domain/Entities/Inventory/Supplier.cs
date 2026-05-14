using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class Supplier : BaseAuditableEntity
{
    public string SupplierCode { get; protected set; } = string.Empty;
    public string Name { get; protected set; } = string.Empty;
    public string? ContactPerson { get; protected set; }
    public string PhoneNumber { get; protected set; } = string.Empty;
    public string? Email { get; protected set; }
    public string? Address { get; protected set; }
    public string? TaxCode { get; protected set; }
    public string? PaymentTerms { get; protected set; }
    public bool IsActive { get; protected set; } = true;

    private readonly List<PurchaseOrder> _purchaseOrders = new();
    public virtual IReadOnlyCollection<PurchaseOrder> PurchaseOrders => _purchaseOrders.AsReadOnly();

    protected Supplier() { }

    public Supplier(string supplierCode, string name, string phoneNumber, string? contactPerson = null, string? email = null, string? address = null, string? taxCode = null, string? paymentTerms = null)
    {
        if (string.IsNullOrWhiteSpace(supplierCode))
            throw new BusinessException("Mã nhà cung cấp không được để trống.");
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên nhà cung cấp không được để trống.");
        if (string.IsNullOrWhiteSpace(phoneNumber))
            throw new BusinessException("Số điện thoại nhà cung cấp không được để trống.");

        SupplierCode = supplierCode.Trim().ToUpperInvariant();
        Name = name.Trim();
        PhoneNumber = phoneNumber.Trim();
        ContactPerson = contactPerson?.Trim();
        Email = email?.Trim();
        Address = address?.Trim();
        TaxCode = taxCode?.Trim();
        PaymentTerms = paymentTerms?.Trim();
        IsActive = true;
    }

    public void UpdateInfo(string name, string phoneNumber, string? contactPerson = null, string? email = null, string? address = null, string? taxCode = null, string? paymentTerms = null)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên nhà cung cấp không được để trống.");
        if (string.IsNullOrWhiteSpace(phoneNumber))
            throw new BusinessException("Số điện thoại nhà cung cấp không được để trống.");

        Name = name.Trim();
        PhoneNumber = phoneNumber.Trim();
        ContactPerson = contactPerson?.Trim();
        Email = email?.Trim();
        Address = address?.Trim();
        TaxCode = taxCode?.Trim();
        PaymentTerms = paymentTerms?.Trim();
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
