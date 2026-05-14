using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.Entities.Inventory;

public class InventoryAudit : BaseAuditableEntity
{
    public string AuditNumber { get; protected set; } = string.Empty;
    public DateTime AuditDate { get; protected set; } = DateTime.UtcNow;
    public int AuditorUserId { get; protected set; }
    public int? ApprovedByUserId { get; protected set; }
    public AuditStatus Status { get; protected set; } = AuditStatus.Draft;
    public DateTime? ApprovedAt { get; protected set; }
    public string? Notes { get; protected set; }

    public virtual User? AuditorUser { get; protected set; }
    public virtual User? ApprovedByUser { get; protected set; }

    private readonly List<InventoryAuditItem> _items = new();
    public virtual IReadOnlyCollection<InventoryAuditItem> Items => _items.AsReadOnly();

    protected InventoryAudit() { }

    public InventoryAudit(string auditNumber, int auditorUserId, string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(auditNumber))
            throw new BusinessException("Mã phiếu kiểm kê không được để trống.");
        if (auditorUserId <= 0)
            throw new BusinessException("Mã nhân viên kiểm kê không hợp lệ.");

        AuditNumber = auditNumber.Trim().ToUpperInvariant();
        AuditorUserId = auditorUserId;
        CreatedByUserId = auditorUserId;
        AuditDate = DateTime.UtcNow;
        CreatedAt = DateTime.UtcNow;
        Status = AuditStatus.Draft;
        Notes = notes?.Trim();
    }

    public InventoryAuditItem RecordItem(int inventoryItemId, decimal systemExpectedQuantity, decimal actualQuantity, string? reason)
    {
        if (Status != AuditStatus.Draft)
            throw new BusinessException($"Không thể ghi nhận mặt hàng trên phiếu kiểm kê ở trạng thái '{Status}'.");

        var item = new InventoryAuditItem(Id, inventoryItemId, systemExpectedQuantity, actualQuantity, reason);
        _items.Add(item);
        return item;
    }

    public void Submit()
    {
        if (Status != AuditStatus.Draft)
            throw new BusinessException($"Chỉ có thể gửi duyệt phiếu kiểm kê ở trạng thái Nháp (Draft). Trạng thái hiện tại: '{Status}'.");
        if (!_items.Any())
            throw new BusinessException("Không thể gửi duyệt phiếu kiểm kê không có mặt hàng nào.");

        Status = AuditStatus.Submitted;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Approve(int managerUserId)
    {
        if (Status != AuditStatus.Submitted)
            throw new BusinessException($"Không thể phê duyệt phiếu kiểm kê ở trạng thái '{Status}'. Phiếu kiểm kê phải được Gửi duyệt (Submitted) trước.");
        if (managerUserId <= 0)
            throw new BusinessException("Mã quản lý phê duyệt không hợp lệ.");

        Status = AuditStatus.Approved;
        ApprovedByUserId = managerUserId;
        ApprovedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        UpdatedByUserId = managerUserId;
    }

    public void Cancel(string reason)
    {
        if (Status == AuditStatus.Approved)
            throw new BusinessException("Không thể hủy phiếu kiểm kê đã được phê duyệt.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy phiếu kiểm kê không được để trống.");

        Status = AuditStatus.Cancelled;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Đã hủy: {reason.Trim()}" : $"{Notes} | Đã hủy: {reason.Trim()}";
        UpdatedAt = DateTime.UtcNow;
    }
}
