using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class PurchaseOrder : BaseAuditableEntity
{
    public string PoNumber { get; protected set; } = string.Empty;
    public int SupplierId { get; protected set; }
    public PurchaseOrderStatus Status { get; protected set; } = PurchaseOrderStatus.Draft;
    public DateTime OrderDate { get; protected set; } = DateTime.UtcNow;
    public DateTime? ExpectedDeliveryDate { get; protected set; }
    public DateTime? ReceivedDate { get; protected set; }
    public int? ApprovedByUserId { get; protected set; }
    public decimal TotalAmount { get; protected set; } = 0;
    public string? Notes { get; protected set; }

    public virtual Supplier? Supplier { get; protected set; }
    public virtual User? CreatedByUser { get; protected set; }
    public virtual User? ApprovedByUser { get; protected set; }

    private readonly List<PurchaseOrderItem> _items = new();
    public virtual IReadOnlyCollection<PurchaseOrderItem> Items => _items.AsReadOnly();

    protected PurchaseOrder() { }

    public PurchaseOrder(string poNumber, int supplierId, int createdByUserId, DateTime? expectedDeliveryDate = null, string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(poNumber))
            throw new BusinessException("Mã đơn mua hàng (PO) không được để trống.");
        if (supplierId <= 0)
            throw new BusinessException("Mã nhà cung cấp không hợp lệ.");
        if (createdByUserId <= 0)
            throw new BusinessException("Mã người tạo không hợp lệ.");

        PoNumber = poNumber.Trim().ToUpperInvariant();
        SupplierId = supplierId;
        CreatedByUserId = createdByUserId;
        OrderDate = DateTime.UtcNow;
        CreatedAt = DateTime.UtcNow;
        ExpectedDeliveryDate = expectedDeliveryDate;
        Notes = notes?.Trim();
        Status = PurchaseOrderStatus.Draft;
        TotalAmount = 0;
    }

    public PurchaseOrderItem AddItem(int inventoryItemId, decimal quantityOrdered, decimal unitPrice)
    {
        if (Status != PurchaseOrderStatus.Draft)
            throw new BusinessException($"Không thể thêm mặt hàng vào đơn mua hàng ở trạng thái '{Status}'. Chỉ đơn hàng Nháp (Draft) mới có thể chỉnh sửa.");

        var item = new PurchaseOrderItem(Id, inventoryItemId, quantityOrdered, unitPrice);
        _items.Add(item);
        RecalculateTotal();
        return item;
    }

    public void RemoveItem(int inventoryItemId)
    {
        if (Status != PurchaseOrderStatus.Draft)
            throw new BusinessException($"Không thể xóa mặt hàng khỏi đơn mua hàng ở trạng thái '{Status}'.");

        var existing = _items.FirstOrDefault(i => i.InventoryItemId == inventoryItemId);
        if (existing != null)
        {
            _items.Remove(existing);
            RecalculateTotal();
        }
    }

    public void Approve(int managerUserId)
    {
        if (Status != PurchaseOrderStatus.Draft)
            throw new BusinessException($"Không thể phê duyệt đơn mua hàng ở trạng thái '{Status}'. Chỉ đơn hàng Nháp (Draft) mới có thể phê duyệt.");
        if (!_items.Any())
            throw new BusinessException("Không thể phê duyệt đơn mua hàng không có mặt hàng nào.");
        if (managerUserId <= 0)
            throw new BusinessException("Mã quản lý phê duyệt không hợp lệ.");

        Status = PurchaseOrderStatus.Approved;
        ApprovedByUserId = managerUserId;
        UpdatedAt = DateTime.UtcNow;
        UpdatedByUserId = managerUserId;
    }

    public void Receive()
    {
        if (Status != PurchaseOrderStatus.Approved)
            throw new BusinessException($"Không thể nhận hàng cho đơn ở trạng thái '{Status}'. Đơn hàng phải được Phê duyệt (Approved) trước khi nhận hàng.");

        Status = PurchaseOrderStatus.Received;
        ReceivedDate = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Cancel(string reason)
    {
        if (Status == PurchaseOrderStatus.Received)
            throw new BusinessException("Không thể hủy đơn mua hàng đã được nhập kho hoàn tất.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy đơn mua hàng không được để trống.");

        Status = PurchaseOrderStatus.Cancelled;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Đã hủy: {reason.Trim()}" : $"{Notes} | Đã hủy: {reason.Trim()}";
        UpdatedAt = DateTime.UtcNow;
    }

    private void RecalculateTotal()
    {
        TotalAmount = _items.Sum(i => i.LineTotal);
    }
}
