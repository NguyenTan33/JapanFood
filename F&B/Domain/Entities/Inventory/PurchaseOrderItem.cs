using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class PurchaseOrderItem : BaseEntity
{
    public int PoId { get; protected set; }
    public int InventoryItemId { get; protected set; }
    public decimal QuantityOrdered { get; protected set; }
    public decimal QuantityReceived { get; protected set; } = 0;
    public decimal UnitPrice { get; protected set; }
    public decimal LineTotal { get; protected set; }

    public virtual PurchaseOrder? PurchaseOrder { get; protected set; }
    public virtual InventoryItem? InventoryItem { get; protected set; }

    protected PurchaseOrderItem() { }

    public PurchaseOrderItem(int poId, int inventoryItemId, decimal quantityOrdered, decimal unitPrice)
    {
        if (inventoryItemId <= 0)
            throw new BusinessException("Mã nguyên liệu không hợp lệ.");
        if (quantityOrdered <= 0)
            throw new BusinessException("Số lượng đặt hàng phải lớn hơn 0.");
        if (unitPrice < 0)
            throw new BusinessException("Đơn giá nhập không được âm.");

        PoId = poId;
        InventoryItemId = inventoryItemId;
        QuantityOrdered = quantityOrdered;
        UnitPrice = unitPrice;
        LineTotal = Math.Round(quantityOrdered * unitPrice, 2);
    }

    public void RecordReceipt(decimal quantityReceived)
    {
        if (quantityReceived < 0)
            throw new BusinessException("Số lượng thực nhận không được âm.");

        QuantityReceived = quantityReceived;
    }
}
