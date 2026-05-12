using Domain.Entities.Common;
using Domain.Entities.Payment;
using Domain.Entities.Reservations;
using Domain.Entities.TableManagement;
using Domain.Entities.Vouchers;
using Domain.Exceptions;

namespace Domain.Entities.Menu;

public class Order : BaseAuditableEntity
{
    public string OrderNumber { get; protected set; } = string.Empty;
    public int? TableId { get; protected set; }
    public int? UserId { get; protected set; }
    public int? ReservationId { get; protected set; }
    public int? VoucherId { get; protected set; }
    public OrderStatus Status { get; protected set; } = OrderStatus.Pending;
    public OrderType OrderType { get; protected set; } = OrderType.DineIn;
    public int GuestCount { get; protected set; } = 1;
    public decimal SubTotal { get; protected set; } = 0m;
    public decimal TaxAmount { get; protected set; } = 0m;
    public decimal DiscountAmount { get; protected set; } = 0m;
    public decimal DeliveryFee { get; protected set; } = 0m;
    public decimal TotalAmount { get; protected set; } = 0m;
    public decimal DepositAmount { get; protected set; } = 0m;
    public decimal RemainingCodAmount { get; protected set; } = 0m;
    public OrderPaymentMethod? PaymentMethod { get; protected set; }
    public string? DeliveryAddress { get; protected set; }
    public string? RecipientName { get; protected set; }
    public string? RecipientPhone { get; protected set; }
    public string? Notes { get; protected set; }
    public DateTime? CompletedAt { get; protected set; }
    public byte[]? RowVersion { get; protected set; }

    // Navigation
    public virtual Table? Table { get; protected set; }
    public virtual User? User { get; protected set; }
    public virtual Reservation? Reservation { get; protected set; }
    public virtual Voucher? Voucher { get; protected set; }

    private readonly List<OrderItem> _items = new();
    public virtual IReadOnlyCollection<OrderItem> Items => _items.AsReadOnly();

    private readonly List<PaymentTransaction> _paymentTransactions = new();
    public virtual IReadOnlyCollection<PaymentTransaction> PaymentTransactions => _paymentTransactions.AsReadOnly();

    protected Order() { }

    public Order(
        OrderType orderType,
        int? tableId = null,
        int? userId = null,
        int? reservationId = null,
        int guestCount = 1,
        string? notes = null)
    {
        if (orderType == OrderType.DineIn && !tableId.HasValue)
            throw new BusinessException("Đơn ăn tại quán (DineIn) bắt buộc phải có thông tin bàn.");
        if (guestCount <= 0)
            throw new BusinessException("Số lượng khách phải lớn hơn 0.");

        OrderType = orderType;
        TableId = tableId;
        UserId = userId;
        ReservationId = reservationId;
        GuestCount = guestCount;
        Notes = notes?.Trim();
        Status = OrderStatus.Pending;
        OrderNumber = GenerateOrderNumber();
    }

    public OrderItem AddItem(
        MenuItem menuItem,
        int quantity,
        IEnumerable<(ModifierOption option, int quantity)>? selectedModifiers = null,
        string? specialInstructions = null)
    {
        ArgumentNullException.ThrowIfNull(menuItem);

        if (Status == OrderStatus.Completed || Status == OrderStatus.Cancelled)
            throw new BusinessException($"Không thể thêm món vào đơn hàng đã {Status}.");
        if (!menuItem.IsAvailable)
            throw new BusinessException($"Món '{menuItem.Name}' hiện đã hết hoặc ngừng phục vụ.");
        if (quantity <= 0)
            throw new BusinessException("Số lượng món ăn phải lớn hơn 0.");

        var modifierList = selectedModifiers?.ToList() ?? new List<(ModifierOption option, int quantity)>();

        // Validate Modifier Selections against MenuItem ModifierGroups
        ValidateModifiers(menuItem, modifierList);

        var orderItem = new OrderItem(Id, menuItem.Id, menuItem.BasePrice, quantity, menuItem.KitchenStation, specialInstructions);

        foreach (var (opt, modQty) in modifierList)
        {
            if (modQty <= 0)
                throw new BusinessException($"Số lượng tùy chọn '{opt.OptionName}' phải lớn hơn 0.");
            if (!opt.IsAvailable)
                throw new BusinessException($"Tùy chọn '{opt.OptionName}' hiện không khả dụng.");

            orderItem.AddModifier(opt, modQty);
        }

        _items.Add(orderItem);
        RecalculateTotals();
        return orderItem;
    }

    public void CancelItem(int orderItemId, string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy món không được để trống.");

        var item = _items.FirstOrDefault(i => i.Id == orderItemId);
        if (item == null)
            throw new BusinessException($"Món ăn (Id: {orderItemId}) không tồn tại trong đơn hàng {OrderNumber}.");

        item.Cancel(reason);
        RecalculateTotals();
    }

    public void SendToKitchen()
    {
        if (Status == OrderStatus.Completed || Status == OrderStatus.Cancelled)
            throw new BusinessException($"Không thể gửi bếp đơn hàng ở trạng thái {Status}.");

        var pendingItems = _items.Where(i => i.ItemStatus == OrderItemStatus.Pending).ToList();
        if (!pendingItems.Any())
            throw new BusinessException("Không có món ăn mới nào để gửi bếp.");

        foreach (var item in pendingItems)
        {
            item.MarkSentToKitchen();
        }

        Status = OrderStatus.InPreparation;
    }

    public void ApplyDiscount(decimal discountAmount)
    {
        if (discountAmount < 0)
            throw new BusinessException("Số tiền giảm giá không được âm.");
        if (discountAmount > SubTotal + TaxAmount + DeliveryFee)
            throw new BusinessException("Số tiền giảm giá không được vượt quá tổng hóa đơn trước giảm.");

        DiscountAmount = discountAmount;
        RecalculateTotals();
    }

    public void CompleteOrder()
    {
        if (Status == OrderStatus.Completed)
            throw new BusinessException("Đơn hàng này đã hoàn tất trước đó.");
        if (Status == OrderStatus.Cancelled)
            throw new BusinessException("Không thể hoàn tất đơn hàng đã bị hủy.");

        var activeUnserved = _items.Where(i => i.ItemStatus != OrderItemStatus.Served && i.ItemStatus != OrderItemStatus.Cancelled).ToList();
        if (activeUnserved.Any())
            throw new BusinessException($"Không thể hoàn tất thanh toán khi vẫn còn {activeUnserved.Count} món chưa phục vụ hoàn tất.");

        Status = OrderStatus.Completed;
        CompletedAt = DateTime.UtcNow;
    }

    public void CancelOrder(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy đơn hàng không được để trống.");
        if (Status == OrderStatus.Completed)
            throw new BusinessException("Không thể hủy đơn hàng đã hoàn tất thanh toán.");

        foreach (var item in _items.Where(i => i.ItemStatus != OrderItemStatus.Cancelled))
        {
            item.Cancel($"Order cancelled: {reason}");
        }

        Status = OrderStatus.Cancelled;
        Notes = $"{Notes} | Hủy: {reason}".TrimStart(' ', '|');
    }

    public void MarkReadyForDispatch()
    {
        if (Status == OrderStatus.Completed || Status == OrderStatus.Cancelled)
            throw new BusinessException($"Không thể chuyển sang trạng thái sẵn sàng đi đơn khi đơn ở trạng thái {Status}.");

        Status = OrderStatus.ReadyForDispatch;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Dispatch()
    {
        if (Status != OrderStatus.ReadyForDispatch && Status != OrderStatus.InPreparation && Status != OrderStatus.Confirmed)
            throw new BusinessException($"Đơn hàng ở trạng thái {Status} không thể xuất đơn đi giao.");

        Status = OrderStatus.Served;
        UpdatedAt = DateTime.UtcNow;
    }

    public OrderItem? DetachItem(int orderItemId)
    {
        var item = _items.FirstOrDefault(i => i.Id == orderItemId);
        if (item == null) return null;

        _items.Remove(item);
        RecalculateTotals();
        return item;
    }

    public void ApplyVoucher(Voucher voucher, int userUsageCount = 0)
    {
        ArgumentNullException.ThrowIfNull(voucher);

        if (Status == OrderStatus.Completed || Status == OrderStatus.Cancelled)
            throw new BusinessException($"Không thể áp dụng voucher cho đơn hàng đã {Status}.");

        voucher.ValidateApplicable(SubTotal, userUsageCount);

        VoucherId = voucher.Id;
        Voucher = voucher;
        DiscountAmount = voucher.CalculateDiscount(SubTotal);
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;
    }

    public void RemoveVoucher()
    {
        if (Status == OrderStatus.Completed || Status == OrderStatus.Cancelled)
            throw new BusinessException($"Không thể hủy voucher của đơn hàng đã {Status}.");

        VoucherId = null;
        Voucher = null;
        DiscountAmount = 0m;
        RecalculateTotals();
        UpdatedAt = DateTime.UtcNow;
    }

    public PaymentTransaction AddPaymentTransaction(PaymentGateway gateway, decimal amount, string? ipAddress = null)
    {
        if (Status == OrderStatus.Cancelled)
            throw new BusinessException("Không thể tạo giao dịch thanh toán cho đơn hàng đã bị hủy.");
        if (amount <= 0)
            throw new BusinessException("Số tiền thanh toán phải lớn hơn 0.");

        var transaction = new PaymentTransaction(Id, gateway, amount, ipAddress);
        _paymentTransactions.Add(transaction);
        UpdatedAt = DateTime.UtcNow;
        return transaction;
    }

    public void SetDeliveryAndPayment(
        string? deliveryAddress,
        string? recipientName,
        string? recipientPhone,
        OrderPaymentMethod? paymentMethod,
        decimal deliveryFee = 0m)
    {
        if (deliveryFee < 0)
            throw new BusinessException("Phí giao hàng không được âm.");

        DeliveryAddress = deliveryAddress?.Trim();
        RecipientName = recipientName?.Trim();
        RecipientPhone = recipientPhone?.Trim();
        PaymentMethod = paymentMethod;
        DeliveryFee = deliveryFee;
        RecalculateTotals();
    }

    public void RecalculateTotals()
    {
        SubTotal = _items.Where(i => i.ItemStatus != OrderItemStatus.Cancelled).Sum(i => i.TotalPrice);
        TaxAmount = Math.Round(SubTotal * 0.08m, 0); // Standard VAT 8% in F&B
        TotalAmount = Math.Max(0m, SubTotal + TaxAmount + DeliveryFee - DiscountAmount);

        if (PaymentMethod == OrderPaymentMethod.Cod50Deposit)
        {
            DepositAmount = Math.Round(TotalAmount * 0.5m, 0);
            RemainingCodAmount = Math.Max(0m, TotalAmount - DepositAmount);
        }
        else
        {
            DepositAmount = TotalAmount;
            RemainingCodAmount = 0m;
        }
    }

    private static void ValidateModifiers(MenuItem menuItem, List<(ModifierOption option, int quantity)> selectedModifiers)
    {
        // 1. Validate individual selections and ensure every selected option belongs to an attached modifier group
        foreach (var (opt, modQty) in selectedModifiers)
        {
            ArgumentNullException.ThrowIfNull(opt);
            if (modQty <= 0)
                throw new BusinessException($"Số lượng tùy chọn '{opt.OptionName}' phải lớn hơn 0.");
            if (!opt.IsAvailable)
                throw new BusinessException($"Tùy chọn '{opt.OptionName}' hiện không khả dụng.");

            bool belongsToAnyGroup = false;
            foreach (var mgJoin in menuItem.ModifierGroups)
            {
                var group = mgJoin.ModifierGroup;
                if (group != null && OptionBelongsToGroup(opt, group, mgJoin.ModifierGroupId))
                {
                    belongsToAnyGroup = true;
                    break;
                }
            }

            if (!belongsToAnyGroup)
            {
                throw new BusinessException($"Tùy chọn '{opt.OptionName}' không thuộc bất kỳ nhóm tùy chọn nào của món '{menuItem.Name}'.");
            }
        }

        // 2. Validate MinSelection and MaxSelection rules for each attached modifier group
        foreach (var mgJoin in menuItem.ModifierGroups)
        {
            var group = mgJoin.ModifierGroup;
            if (group == null)
            {
                throw new BusinessException($"Không tìm thấy thông tin nhóm tùy chọn cho món '{menuItem.Name}'.");
            }

            // Calculate total selections belonging to this group without dictionary key collisions
            int selectedCount = selectedModifiers
                .Where(m => OptionBelongsToGroup(m.option, group, mgJoin.ModifierGroupId))
                .Sum(m => m.quantity);

            if (selectedCount < group.MinSelection)
            {
                throw new BusinessException($"Bắt buộc phải chọn nhóm '{group.GroupName}' (Tối thiểu: {group.MinSelection}, Đã chọn: {selectedCount}).");
            }

            if (selectedCount > group.MaxSelection)
            {
                throw new BusinessException($"Số lượng chọn cho nhóm '{group.GroupName}' vượt quá tối đa ({group.MaxSelection}). Đã chọn: {selectedCount}.");
            }
        }
    }

    private static bool OptionBelongsToGroup(ModifierOption option, ModifierGroup group, int joinModifierGroupId)
    {
        // Direct object reference or navigation match
        if (option.ModifierGroup != null)
        {
            if (option.ModifierGroup == group)
                return true;

            if (!string.IsNullOrEmpty(option.ModifierGroup.GroupCode) &&
                !string.IsNullOrEmpty(group.GroupCode) &&
                option.ModifierGroup.GroupCode.Equals(group.GroupCode, StringComparison.OrdinalIgnoreCase))
                return true;
        }

        // Options collection match on ModifierGroup
        if (group.Options.Any(o =>
            o == option ||
            (!string.IsNullOrEmpty(o.OptionCode) && !string.IsNullOrEmpty(option.OptionCode) &&
             o.OptionCode.Equals(option.OptionCode, StringComparison.OrdinalIgnoreCase)) ||
            (o.Id != 0 && option.Id != 0 && o.Id == option.Id)))
        {
            return true;
        }

        // ModifierGroupId foreign key match when > 0
        if (option.ModifierGroupId > 0)
        {
            if (group.Id > 0 && option.ModifierGroupId == group.Id)
                return true;

            if (joinModifierGroupId > 0 && option.ModifierGroupId == joinModifierGroupId)
                return true;
        }

        return false;
    }

    private static string GenerateOrderNumber() =>
        $"ORD-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
}
