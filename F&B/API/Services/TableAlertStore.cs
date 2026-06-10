namespace API.Services;

public static class TableAlertTypes
{
    public const string KitchenBuzz = "KITCHEN_BUZZ";
    public const string BillCall = "BILL_CALL";
}

public class TableAlertDto
{
    public long Id { get; set; }
    public string Type { get; set; } = string.Empty;
    public int TableId { get; set; }
    public string TableNumber { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsAcknowledged { get; set; }
    public string? AcknowledgedBy { get; set; }
}

/// <summary>
/// Kho thông báo tạm thời (in-memory) cho yêu cầu "Giục món" và "Gọi tính tiền" từ khách tại bàn.
/// POS / KDS polling định kỳ để nhận thông báo. Chỉ giữ thông báo trong 30 phút gần nhất.
/// </summary>
public class TableAlertStore
{
    public static readonly TimeSpan BuzzCooldown = TimeSpan.FromMinutes(3);
    public static readonly TimeSpan BillCooldown = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan Retention = TimeSpan.FromMinutes(30);

    private readonly object _lock = new();
    private readonly List<TableAlertDto> _alerts = new();
    private long _seq;

    /// <summary>Trả về số giây còn phải chờ nếu đang trong cooldown, ngược lại 0.</summary>
    public int GetCooldownRemainingSeconds(string type, int tableId)
    {
        var cooldown = type == TableAlertTypes.KitchenBuzz ? BuzzCooldown : BillCooldown;
        lock (_lock)
        {
            var last = _alerts.LastOrDefault(a => a.Type == type && a.TableId == tableId);
            if (last == null) return 0;
            var remaining = last.CreatedAt + cooldown - DateTime.UtcNow;
            return remaining > TimeSpan.Zero ? (int)Math.Ceiling(remaining.TotalSeconds) : 0;
        }
    }

    public TableAlertDto Add(string type, int tableId, string tableNumber, decimal totalAmount, string? note)
    {
        lock (_lock)
        {
            Prune();
            var alert = new TableAlertDto
            {
                Id = ++_seq,
                Type = type,
                TableId = tableId,
                TableNumber = tableNumber,
                TotalAmount = totalAmount,
                Note = note,
                CreatedAt = DateTime.UtcNow,
            };
            _alerts.Add(alert);
            return alert;
        }
    }

    public (List<TableAlertDto> Items, long LatestId) GetAfter(long afterId, string? type)
    {
        lock (_lock)
        {
            Prune();
            var items = _alerts
                .Where(a => a.Id > afterId && (type == null || a.Type == type))
                .Select(Clone)
                .ToList();
            return (items, _seq);
        }
    }

    public List<TableAlertDto> GetPendingBillCalls()
    {
        lock (_lock)
        {
            Prune();
            return _alerts
                .Where(a => a.Type == TableAlertTypes.BillCall && !a.IsAcknowledged)
                .Select(Clone)
                .ToList();
        }
    }

    public bool Acknowledge(long id, string? staffName)
    {
        lock (_lock)
        {
            var alert = _alerts.FirstOrDefault(a => a.Id == id);
            if (alert == null) return false;
            alert.IsAcknowledged = true;
            alert.AcknowledgedBy = staffName;
            // Xác nhận luôn các yêu cầu tính tiền trùng của cùng bàn
            foreach (var other in _alerts.Where(a => a.Type == alert.Type && a.TableId == alert.TableId))
            {
                other.IsAcknowledged = true;
                other.AcknowledgedBy ??= staffName;
            }
            return true;
        }
    }

    private void Prune()
    {
        var cutoff = DateTime.UtcNow - Retention;
        _alerts.RemoveAll(a => a.CreatedAt < cutoff);
    }

    private static TableAlertDto Clone(TableAlertDto a) => new()
    {
        Id = a.Id,
        Type = a.Type,
        TableId = a.TableId,
        TableNumber = a.TableNumber,
        TotalAmount = a.TotalAmount,
        Note = a.Note,
        CreatedAt = a.CreatedAt,
        IsAcknowledged = a.IsAcknowledged,
        AcknowledgedBy = a.AcknowledgedBy,
    };
}
