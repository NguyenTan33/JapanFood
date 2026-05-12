using Domain.Entities.Common;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Domain.Entities.TableManagement;

public class Table : BaseAuditableEntity
{
    public int AreaId { get; protected set; }
    public string TableNumber { get; protected set; } = string.Empty;
    public int Capacity { get; protected set; }
    public int MinCapacity { get; protected set; } = 1;
    public TableStatus Status { get; protected set; } = TableStatus.Empty;
    public int? CurrentOrderId { get; protected set; }
    public int? MergedIntoTableId { get; protected set; }
    public bool IsActive { get; protected set; } = true;
    public string? SessionToken { get; protected set; }
    public string? PinCode { get; protected set; }
    public DateTime? PinCreatedAt { get; protected set; }
    public DateTime? LastOrderAt { get; protected set; }
    public DateTime? LastBellAt { get; protected set; }
    public byte[]? RowVersion { get; protected set; }

    // Navigation
    public virtual TableArea Area { get; protected set; } = null!;
    public virtual Order? CurrentOrder { get; protected set; }
    public virtual Table? MergedIntoTable { get; protected set; }

    private readonly List<Table> _mergedChildren = new();
    public virtual IReadOnlyCollection<Table> MergedChildren => _mergedChildren.AsReadOnly();

    protected Table() { }

    public Table(int areaId, string tableNumber, int capacity, int minCapacity = 1)
    {
        if (string.IsNullOrWhiteSpace(tableNumber))
            throw new BusinessException("Số bàn không được để trống.");
        if (capacity <= 0)
            throw new BusinessException("Sức chứa của bàn phải lớn hơn 0.");
        if (minCapacity <= 0 || minCapacity > capacity)
            throw new BusinessException("Sức chứa tối thiểu không hợp lệ.");

        AreaId = areaId;
        TableNumber = tableNumber.Trim().ToUpperInvariant();
        Capacity = capacity;
        MinCapacity = minCapacity;
        Status = TableStatus.Empty;
        IsActive = true;
    }

    public void Occupy(int orderId, int guestCount)
    {
        if (orderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");
        if (!IsActive)
            throw new BusinessException($"Bàn {TableNumber} hiện đang ngừng hoạt động.");
        if (MergedIntoTableId.HasValue)
            throw new BusinessException($"Bàn {TableNumber} đang được gộp vào bàn khác. Không thể mở bàn riêng.");
        if (Status == TableStatus.Serving)
            throw new BusinessException($"Bàn {TableNumber} đang có khách phục vụ.");
        if (Status == TableStatus.Cleaning)
            throw new BusinessException($"Bàn {TableNumber} đang chờ dọn dẹp vệ sinh. Vui lòng hoàn tất dọn bàn trước khi đón khách.");

        int totalCap = GetTotalEffectiveCapacity();
        if (guestCount <= 0)
            throw new BusinessException("Số lượng khách phải lớn hơn 0.");
        if (guestCount > totalCap + 2) // Grace allowance +2
            throw new BusinessException($"Số lượng khách ({guestCount}) vượt quá sức chứa tối đa của bàn ({totalCap}).");

        Status = TableStatus.Serving;
        CurrentOrderId = orderId;
        LastOrderAt = null;
        LastBellAt = null;
    }

    public void MergeTable(Table secondaryTable)
    {
        ArgumentNullException.ThrowIfNull(secondaryTable);

        if ((Id == secondaryTable.Id && Id != 0) || TableNumber.Equals(secondaryTable.TableNumber, StringComparison.OrdinalIgnoreCase))
            throw new BusinessException("Không thể gộp một bàn vào chính nó.");
        if (!IsActive || !secondaryTable.IsActive)
            throw new BusinessException("Cả hai bàn phải đang ở trạng thái hoạt động để gộp bàn.");
        if (MergedIntoTableId.HasValue)
            throw new BusinessException($"Bàn chính {TableNumber} đang được gộp vào bàn khác. Không thể làm bàn chính.");
        if (secondaryTable.MergedIntoTableId.HasValue)
            throw new BusinessException($"Bàn phụ {secondaryTable.TableNumber} đã được gộp vào một bàn khác.");
        if (secondaryTable.MergedChildren.Any())
            throw new BusinessException("Cannot merge a table that already has merged child tables.");
        if (Status == TableStatus.Cleaning || secondaryTable.Status == TableStatus.Cleaning)
            throw new BusinessException("Không thể gộp bàn khi có bàn đang chờ dọn dẹp vệ sinh.");

        // If master table is serving, secondary table joins the serving session
        if (Status == TableStatus.Serving)
        {
            secondaryTable.MergedIntoTableId = Id;
            secondaryTable.MergedIntoTable = this;
            secondaryTable.Status = TableStatus.Serving;
            secondaryTable.CurrentOrderId = CurrentOrderId;
            _mergedChildren.Add(secondaryTable);
        }
        else if (Status == TableStatus.Empty)
        {
            // Pre-merging empty tables for incoming large group
            secondaryTable.MergedIntoTableId = Id;
            secondaryTable.MergedIntoTable = this;
            secondaryTable.Status = TableStatus.Empty;
            _mergedChildren.Add(secondaryTable);
        }
        else
        {
            throw new BusinessException($"Trạng thái bàn chính ({Status}) không hỗ trợ gộp bàn.");
        }
    }

    public void UnmergeTable(Table secondaryTable)
    {
        ArgumentNullException.ThrowIfNull(secondaryTable);

        if (secondaryTable.MergedIntoTableId != Id && !_mergedChildren.Contains(secondaryTable))
            throw new BusinessException($"Bàn {secondaryTable.TableNumber} không thuộc danh sách bàn gộp của bàn {TableNumber}.");

        _mergedChildren.Remove(secondaryTable);
        secondaryTable.MergedIntoTableId = null;
        secondaryTable.MergedIntoTable = null;
        secondaryTable.CurrentOrderId = null;
        secondaryTable.Status = (Status == TableStatus.Serving || secondaryTable.Status == TableStatus.Serving)
            ? TableStatus.Cleaning
            : TableStatus.Empty;
    }

    public void TransferTo(Table targetTable)
    {
        ArgumentNullException.ThrowIfNull(targetTable);

        if ((Id == targetTable.Id && Id != 0) || TableNumber.Equals(targetTable.TableNumber, StringComparison.OrdinalIgnoreCase))
            throw new BusinessException("Không thể chuyển bàn sang chính nó.");
        if (Status != TableStatus.Serving || !CurrentOrderId.HasValue)
            throw new BusinessException($"Bàn nguồn {TableNumber} không có đơn hàng đang phục vụ để chuyển.");
        if (MergedIntoTableId.HasValue)
            throw new BusinessException($"Bàn {TableNumber} là bàn phụ gộp. Chỉ có thể thực hiện thao tác trên bàn chính.");
        if (!targetTable.IsActive)
            throw new BusinessException($"Bàn đích {targetTable.TableNumber} hiện đang ngừng hoạt động.");
        if (targetTable.Status != TableStatus.Empty)
            throw new BusinessException($"Bàn đích {targetTable.TableNumber} không trống (Trạng thái: {targetTable.Status}).");
        if (targetTable.MergedIntoTableId.HasValue)
            throw new BusinessException($"Bàn đích {targetTable.TableNumber} đang là bàn gộp của bàn khác.");

        // Transfer active order to target table
        targetTable.Status = TableStatus.Serving;
        targetTable.CurrentOrderId = CurrentOrderId;
        if (!string.IsNullOrWhiteSpace(SessionToken) && !string.IsNullOrWhiteSpace(PinCode))
        {
            targetTable.SetSessionSecurity(SessionToken, PinCode);
        }

        // Source table becomes Cleaning
        CurrentOrderId = null;
        Status = TableStatus.Cleaning;
        ClearSessionPin();

        // If source table had merged children, unmerge them and mark for cleaning
        foreach (var child in _mergedChildren)
        {
            child.MergedIntoTableId = null;
            child.MergedIntoTable = null;
            child.CurrentOrderId = null;
            child.Status = TableStatus.Cleaning;
            child.ClearSessionPin();
        }
        _mergedChildren.Clear();
    }

    public void Reserve()
    {
        if (Status != TableStatus.Empty)
            throw new BusinessException($"Chỉ có thể đặt trước bàn trống. Trạng thái hiện tại: {Status}.");

        Status = TableStatus.Reserved;
    }

    public void CancelReservation()
    {
        if (Status != TableStatus.Reserved)
            throw new BusinessException($"Bàn {TableNumber} không ở trạng thái Đặt trước (Reserved).");

        Status = TableStatus.Empty;
    }

    public void ReleaseToCleaning()
    {
        if (Status != TableStatus.Serving)
            throw new BusinessException($"Chỉ có thể giải phóng bàn đang phục vụ. Trạng thái hiện tại: {Status}.");

        Status = TableStatus.Cleaning;
        CurrentOrderId = null;
        MergedIntoTableId = null;
        MergedIntoTable = null;
        LastOrderAt = null;
        LastBellAt = null;
        ClearSessionPin();

        foreach (var child in _mergedChildren)
        {
            child.MergedIntoTableId = null;
            child.MergedIntoTable = null;
            child.CurrentOrderId = null;
            child.Status = TableStatus.Cleaning;
            child.ClearSessionPin();
        }
        _mergedChildren.Clear();
    }

    public void CompleteCleaning()
    {
        if (Status != TableStatus.Cleaning)
            throw new BusinessException($"Bàn {TableNumber} không ở trạng thái Chờ dọn dẹp (Cleaning). Trạng thái hiện tại: {Status}.");

        Status = TableStatus.Empty;
        MergedIntoTableId = null;
        MergedIntoTable = null;
    }

    public void CancelEmptySession()
    {
        if (Status != TableStatus.Serving && Status != TableStatus.Cleaning)
            throw new BusinessException($"Chỉ có thể hủy bàn khi đang ở trạng thái phục vụ hoặc chờ dọn. Trạng thái hiện tại: {Status}.");

        Status = TableStatus.Empty;
        CurrentOrderId = null;
        MergedIntoTableId = null;
        MergedIntoTable = null;
        LastOrderAt = null;
        LastBellAt = null;
        ClearSessionPin();

        foreach (var child in _mergedChildren)
        {
            child.MergedIntoTableId = null;
            child.MergedIntoTable = null;
            child.CurrentOrderId = null;
            child.Status = TableStatus.Empty;
            child.ClearSessionPin();
        }
        _mergedChildren.Clear();
    }

    public int GetTotalEffectiveCapacity() => Capacity + _mergedChildren.Sum(c => c.Capacity);

    public void UpdateDetails(int areaId, string tableNumber, int capacity, int minCapacity)
    {
        if (areaId <= 0)
            throw new BusinessException("Mã khu vực không hợp lệ.");
        if (string.IsNullOrWhiteSpace(tableNumber))
            throw new BusinessException("Số bàn không được để trống.");
        if (capacity <= 0)
            throw new BusinessException("Sức chứa của bàn phải lớn hơn 0.");
        if (minCapacity <= 0 || minCapacity > capacity)
            throw new BusinessException("Sức chứa tối thiểu không hợp lệ.");
        if (Status == TableStatus.Serving && AreaId != areaId)
            throw new BusinessException("Không thể chuyển khu vực khi bàn đang có khách phục vụ.");

        AreaId = areaId;
        TableNumber = tableNumber.Trim().ToUpperInvariant();
        Capacity = capacity;
        MinCapacity = minCapacity;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (Status == TableStatus.Serving || CurrentOrderId.HasValue)
            throw new BusinessException($"Không thể ngừng hoạt động bàn {TableNumber} khi đang phục vụ khách.");
        if (MergedIntoTableId.HasValue || _mergedChildren.Any())
            throw new BusinessException($"Không thể ngừng hoạt động bàn {TableNumber} khi đang gộp bàn.");

        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SetSessionSecurity(string sessionToken, string pinCode)
    {
        SessionToken = sessionToken;
        PinCode = pinCode;
        PinCreatedAt = DateTime.UtcNow;
    }

    public string RegeneratePin()
    {
        var newPin = System.Security.Cryptography.RandomNumberGenerator.GetInt32(1000, 10000).ToString();
        PinCode = newPin;
        PinCreatedAt = DateTime.UtcNow;

        var rawEntropy = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
        var tokenBytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"TABLE_{Id}_{CurrentOrderId}_{rawEntropy}_{DateTime.UtcNow.Ticks}_{newPin}"));
        SessionToken = Convert.ToHexString(tokenBytes)[..32].ToLowerInvariant();
        return newPin;
    }

    public void ClearSessionPin()
    {
        SessionToken = null;
        PinCode = null;
        PinCreatedAt = null;
    }

    public void RecordOrderTime()
    {
        LastOrderAt = DateTime.UtcNow;
    }

    public void RecordBellTime()
    {
        LastBellAt = DateTime.UtcNow;
    }
}
