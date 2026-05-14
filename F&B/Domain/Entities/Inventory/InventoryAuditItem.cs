using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class InventoryAuditItem : BaseEntity
{
    public int AuditId { get; protected set; }
    public int InventoryItemId { get; protected set; }
    public decimal SystemExpectedQuantity { get; protected set; }
    public decimal ActualQuantity { get; protected set; }
    public decimal DiscrepancyQuantity { get; protected set; }
    public string? Reason { get; protected set; }

    public virtual InventoryAudit? Audit { get; protected set; }
    public virtual InventoryItem? InventoryItem { get; protected set; }

    protected InventoryAuditItem() { }

    public InventoryAuditItem(int auditId, int inventoryItemId, decimal systemExpectedQuantity, decimal actualQuantity, string? reason)
    {
        if (inventoryItemId <= 0)
            throw new BusinessException("Mã nguyên liệu không hợp lệ.");
        if (systemExpectedQuantity < 0)
            throw new BusinessException("Số lượng tồn sổ sách không được âm.");
        if (actualQuantity < 0)
            throw new BusinessException("Số lượng kiểm kê thực tế không được âm.");

        AuditId = auditId;
        InventoryItemId = inventoryItemId;
        SystemExpectedQuantity = systemExpectedQuantity;
        ActualQuantity = actualQuantity;
        DiscrepancyQuantity = actualQuantity - systemExpectedQuantity;

        if (DiscrepancyQuantity != 0 && string.IsNullOrWhiteSpace(reason))
            throw new BusinessException($"Lý do chênh lệch là bắt buộc khi số lượng kiểm tế khác sổ sách (Mã NL: {inventoryItemId}, Chênh lệch: {DiscrepancyQuantity}).");

        Reason = reason?.Trim();
    }
}
