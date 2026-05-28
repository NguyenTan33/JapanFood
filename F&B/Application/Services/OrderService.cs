using Application.Common.Validation;
using Application.DTOs.Ordering;
using Application.Interfaces;
using Application.Interfaces.Payment;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Domain.Entities;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.Operations;
using Domain.Entities.Payment;
using Domain.Entities.TableManagement;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class OrderService : IOrderService
{
    private const string OpenShiftRequiredMessage = "Vui lòng mở ca trực trước khi mở bàn hoặc thu tiền.";

    private readonly IUnitOfWork _unitOfWork;
    private readonly IOrderQueryRepository _orderQueryRepo;
    private readonly IValidationFactory _validationFactory;
    private readonly IVnPayService _vnPayService;
    private readonly IMoMoService _moMoService;
    private readonly ILogger<OrderService> _logger;
    private readonly IMenuQueryRepository? _menuQueryRepo;
    private readonly IVoucherQueryRepository? _voucherQueryRepo;
    private readonly IInventoryQueryRepository? _inventoryQueryRepo;

    public OrderService(
        IUnitOfWork unitOfWork,
        IOrderQueryRepository orderQueryRepo,
        IValidationFactory validationFactory,
        IVnPayService vnPayService,
        IMoMoService moMoService,
        ILogger<OrderService> logger,
        IMenuQueryRepository? menuQueryRepo = null,
        IVoucherQueryRepository? voucherQueryRepo = null,
        IInventoryQueryRepository? inventoryQueryRepo = null)
    {
        _unitOfWork = unitOfWork;
        _orderQueryRepo = orderQueryRepo;
        _validationFactory = validationFactory;
        _vnPayService = vnPayService;
        _moMoService = moMoService;
        _logger = logger;
        _menuQueryRepo = menuQueryRepo;
        _voucherQueryRepo = voucherQueryRepo;
        _inventoryQueryRepo = inventoryQueryRepo;
    }

    public async Task<OrderDetailViewDto> CreateOrderAsync(CreateOrderRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 1.1 Mandatory open-shift gate for Dine-In orders
        if (request.OrderType == OrderType.DineIn)
        {
            var hasOpenShift = await _unitOfWork.Context.CashierShifts
                .AnyAsync(s => s.Status == ShiftStatus.Open, ct);
            if (!hasOpenShift)
            {
                throw new BusinessException(OpenShiftRequiredMessage);
            }
        }

        // 2. Check dish availability
        var dishIds = request.Items.Select(x => x.MenuItemId).Distinct().ToList();
        if (_menuQueryRepo != null)
        {
            var unavailableDishes = await _menuQueryRepo.CheckDishAvailabilityAsync(dishIds, ct);
            if (unavailableDishes.Any())
            {
                throw new BusinessException($"Các món sau hiện đã hết hoặc ngừng phục vụ: {string.Join(", ", unavailableDishes)}");
            }
        }
        else
        {
            var unavailableDishes = await _unitOfWork.Context.MenuItems
                .Where(m => dishIds.Contains(m.Id) && !m.IsAvailable)
                .Select(m => m.Name)
                .ToListAsync(ct);
            if (unavailableDishes.Any())
            {
                throw new BusinessException($"Các món sau hiện đã hết hoặc ngừng phục vụ: {string.Join(", ", unavailableDishes)}");
            }
        }

        // 3. Multi-table operation wrapped in explicit transaction
        using var tx = await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            var order = new Order(
                request.OrderType,
                request.TableId,
                request.UserId,
                request.ReservationId,
                request.GuestCount,
                request.Notes);

            // Fetch MenuItems with ModifierGroups and Options
            var menuItems = await _unitOfWork.Context.MenuItems
                .Include(m => m.ModifierGroups)
                    .ThenInclude(mg => mg.ModifierGroup)
                        .ThenInclude(g => g.Options)
                .Where(m => dishIds.Contains(m.Id))
                .ToListAsync(ct);

            foreach (var itemDto in request.Items)
            {
                var menuItem = menuItems.FirstOrDefault(m => m.Id == itemDto.MenuItemId)
                    ?? throw new NotFoundException($"Không tìm thấy món ăn #{itemDto.MenuItemId}.");

                var selectedOptions = new List<(ModifierOption option, int quantity)>();
                if (itemDto.ModifierOptionIds != null && itemDto.ModifierOptionIds.Any())
                {
                    var allOptions = menuItem.ModifierGroups.SelectMany(g => g.ModifierGroup.Options).ToList();
                    foreach (var optId in itemDto.ModifierOptionIds)
                    {
                        var opt = allOptions.FirstOrDefault(o => o.Id == optId)
                            ?? throw new BusinessException($"Tùy chọn #{optId} không hợp lệ cho món '{menuItem.Name}'.");
                        selectedOptions.Add((opt, 1));
                    }
                }

                order.AddItem(menuItem, itemDto.Quantity, selectedOptions, itemDto.SpecialInstructions);
            }

            if (request.PaymentMethod.HasValue ||
                !string.IsNullOrWhiteSpace(request.DeliveryAddress) ||
                !string.IsNullOrWhiteSpace(request.RecipientName) ||
                !string.IsNullOrWhiteSpace(request.RecipientPhone))
            {
                order.SetDeliveryAndPayment(
                    request.DeliveryAddress,
                    request.RecipientName,
                    request.RecipientPhone,
                    request.PaymentMethod,
                    0m);
            }

            // Apply Voucher if provided
            if (!string.IsNullOrWhiteSpace(request.VoucherCode))
            {
                int userId = request.UserId ?? 0;
                if (_voucherQueryRepo != null)
                {
                    var voucherResult = await _voucherQueryRepo.GetActiveVoucherByCodeAsync(request.VoucherCode, order.SubTotal, userId, ct);
                    if (!voucherResult.IsValid || !voucherResult.VoucherId.HasValue)
                    {
                        throw new BusinessException(voucherResult.ErrorMessage ?? "Mã voucher không hợp lệ.");
                    }

                    var voucher = await _unitOfWork.Context.Vouchers.FirstOrDefaultAsync(v => v.Id == voucherResult.VoucherId.Value, ct);
                    if (voucher != null)
                    {
                        int userUsageCount = 0;
                        if (userId > 0)
                        {
                            userUsageCount = await _unitOfWork.Context.UserVoucherUsages
                                .CountAsync(u => u.VoucherId == voucher.Id && u.UserId == userId, ct);
                        }
                        order.ApplyVoucher(voucher, userUsageCount);
                    }
                }
                else
                {
                    var voucherCodeUpper = request.VoucherCode.Trim().ToUpperInvariant();
                    var voucher = await _unitOfWork.Context.Vouchers.FirstOrDefaultAsync(v => v.VoucherCode == voucherCodeUpper, ct)
                        ?? throw new BusinessException($"Không tìm thấy mã voucher '{request.VoucherCode}'.");

                    int userUsageCount = 0;
                    if (userId > 0)
                    {
                        userUsageCount = await _unitOfWork.Context.UserVoucherUsages
                            .CountAsync(u => u.VoucherId == voucher.Id && u.UserId == userId, ct);
                    }
                    order.ApplyVoucher(voucher, userUsageCount);
                }
            }

            _unitOfWork.Context.Orders.Add(order);
            await _unitOfWork.SaveChangesAsync(ct);

            // Table occupancy for DineIn
            if (request.OrderType == OrderType.DineIn && request.TableId.HasValue)
            {
                var table = await _unitOfWork.Context.Tables.FirstOrDefaultAsync(t => t.Id == request.TableId.Value, ct)
                    ?? throw new NotFoundException($"Không tìm thấy bàn #{request.TableId.Value}.");

                table.Occupy(order.Id, request.GuestCount);
                await _unitOfWork.SaveChangesAsync(ct);
            }

            await _unitOfWork.CommitTransactionAsync(ct);

            var result = await _orderQueryRepo.GetOrderWithDetailsByIdAsync(order.Id, ct);
            return result ?? throw new NotFoundException($"Không tìm thấy đơn hàng sau khi tạo #{order.Id}.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi tạo đơn hàng mới");
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    public async Task<bool> SendOrderToKitchenAsync(int orderId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        using var tx = await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            var order = await _unitOfWork.Context.Orders
                .Include(o => o.Table)
                .Include(o => o.Items)
                    .ThenInclude(i => i.Modifiers)
                .Include(o => o.Items)
                    .ThenInclude(i => i.MenuItem)
                .FirstOrDefaultAsync(o => o.Id == orderId, ct);

            if (order == null)
                throw new NotFoundException($"Không tìm thấy đơn hàng #{orderId}.");

            // 1. Transitions pending items to SentToKitchen and Order to InPreparation
            order.SendToKitchen();

            // 2. Identify existing ticket items for this order so we NEVER duplicate tickets
            var existingTicketItems = await _unitOfWork.Context.KitchenTicketItems
                .Include(kti => kti.Ticket)
                .Where(kti => kti.Ticket != null && kti.Ticket.OrderId == orderId && kti.Status != KitchenItemStatus.Cancelled)
                .ToListAsync(ct);

            var existingOrderItemIdsWithTicket = existingTicketItems
                .Select(kti => kti.OrderItemId)
                .Distinct()
                .ToHashSet();

            // 3. For any existing ticket item whose OrderItem quantity increased, update KitchenTicketItem quantity
            foreach (var item in order.Items)
            {
                if (existingOrderItemIdsWithTicket.Contains(item.Id))
                {
                    var matchingTicketItems = existingTicketItems
                        .Where(kti => kti.OrderItemId == item.Id && (kti.Status == KitchenItemStatus.Pending || kti.Status == KitchenItemStatus.Cooking))
                        .ToList();

                    if (matchingTicketItems.Any())
                    {
                        var firstTicketItem = matchingTicketItems.First();
                        if (firstTicketItem.Quantity != item.Quantity)
                        {
                            firstTicketItem.UpdateQuantity(item.Quantity);
                        }
                    }
                }
            }

            // 4. Only NEW order items (that do not yet have an active kitchen ticket) get sent to kitchen!
            var newItemsToSend = order.Items
                .Where(i => (i.ItemStatus == OrderItemStatus.SentToKitchen || i.ItemStatus == OrderItemStatus.Pending)
                         && !existingOrderItemIdsWithTicket.Contains(i.Id))
                .ToList();

            if (newItemsToSend.Any())
            {
                var itemsByStation = newItemsToSend.GroupBy(i => i.KitchenStation);
                string tableName = order.Table?.TableNumber ?? (order.OrderType == OrderType.Takeaway ? "MANG VỀ" : "GIAO HÀNG");
                var stations = await _unitOfWork.Context.KitchenStations.ToListAsync(ct);

                foreach (var group in itemsByStation)
                {
                    var stationType = group.Key;
                    var station = stations.FirstOrDefault(s => s.StationType == stationType)
                        ?? stations.FirstOrDefault();
                    int stationId = station?.Id ?? 1;

                    string ticketNumber = $"TKT-{order.OrderNumber}-{stationType}-{DateTime.UtcNow:HHmmss}";
                    var ticket = new KitchenTicket(order.Id, ticketNumber, tableName, order.Notes);

                    foreach (var item in group)
                    {
                        string? modSummary = item.Modifiers.Any()
                            ? string.Join(", ", item.Modifiers.Select(m => $"{m.ModifierOptionName} x{m.Quantity}"))
                            : null;
                        string itemName = item.MenuItem?.Name ?? $"Món #{item.MenuItemId}";
                        ticket.AddItem(item.Id, stationId, itemName, item.Quantity, modSummary);
                    }

                    _unitOfWork.Context.KitchenTickets.Add(ticket);
                }
            }

            await _unitOfWork.SaveChangesAsync(ct);
            await _unitOfWork.CommitTransactionAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi chuyển đơn hàng #{OrderId} sang bếp", orderId);
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    public async Task<string> CheckoutOrderAsync(int orderId, PaymentGateway gateway, string ipAddress, string returnUrl, CancellationToken ct = default)
    {
        var order = await _unitOfWork.Context.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{orderId}.");

        if (order.Status == OrderStatus.Completed)
            throw new BusinessException("Đơn hàng này đã hoàn tất trước đó.");

        if (order.Status == OrderStatus.Cancelled)
            throw new BusinessException("Không thể tạo giao dịch thanh toán cho đơn hàng đã bị hủy.");

        CashierShift? openShift = null;
        if (gateway == PaymentGateway.Cash)
        {
            openShift = await _unitOfWork.Context.CashierShifts
                .FirstOrDefaultAsync(s => s.Status == ShiftStatus.Open, ct);
            if (openShift == null)
                throw new BusinessException(OpenShiftRequiredMessage);
        }

        var transaction = order.AddPaymentTransaction(gateway, order.TotalAmount, ipAddress);
        if (openShift != null)
        {
            transaction.AssignShift(openShift.Id);
        }
        await _unitOfWork.SaveChangesAsync(ct);

        if (gateway == PaymentGateway.VnPay)
        {
            return _vnPayService.CreatePaymentUrl(transaction.TransactionNumber, order.TotalAmount, $"Thanh toan don hang #{order.OrderNumber}", returnUrl, ipAddress);
        }

        if (gateway == PaymentGateway.MoMo)
        {
            string rawData = $"action=checkout&amount={order.TotalAmount}&orderId={order.Id}&txnRef={transaction.TransactionNumber}";
            string signature = _moMoService.CreateSignature(rawData);
            return $"{returnUrl}?txnRef={transaction.TransactionNumber}&signature={signature}";
        }

        return returnUrl;
    }

    public async Task<bool> ProcessPaymentCallbackAsync(PaymentGateway gateway, IDictionary<string, string> callbackData, CancellationToken ct = default)
    {
        string txnNumber;
        string gatewayTxnId;
        string responseCode;
        bool isSuccess;

        if (gateway == PaymentGateway.VnPay)
        {
            if (!callbackData.TryGetValue("vnp_SecureHash", out var secureHash) || string.IsNullOrWhiteSpace(secureHash))
                throw new BusinessException("Chữ ký thanh toán không hợp lệ (Missing Secure Hash).");

            bool validSig = _vnPayService.ValidateSignature(callbackData, secureHash);
            if (!validSig)
                throw new BusinessException("Chữ ký thanh toán không hợp lệ (Invalid Signature).");

            txnNumber = callbackData.TryGetValue("vnp_TxnRef", out var refVal) ? refVal : string.Empty;
            gatewayTxnId = callbackData.TryGetValue("vnp_TransactionNo", out var noVal) ? noVal : string.Empty;
            responseCode = callbackData.TryGetValue("vnp_ResponseCode", out var codeVal) ? codeVal : string.Empty;
            isSuccess = responseCode == "00";
        }
        else if (gateway == PaymentGateway.MoMo)
        {
            if (!callbackData.TryGetValue("signature", out var signature) || string.IsNullOrWhiteSpace(signature)
                || !callbackData.TryGetValue("rawData", out var rawData) || string.IsNullOrWhiteSpace(rawData))
            {
                throw new BusinessException("Chữ ký MoMo không hợp lệ.");
            }

            if (rawData.Contains("action=checkout", StringComparison.OrdinalIgnoreCase))
            {
                throw new BusinessException("Chữ ký MoMo không hợp lệ (Không thể dùng chữ ký checkout cho callback IPN).");
            }

            if (!_moMoService.ValidateSignature(rawData, signature))
            {
                throw new BusinessException("Chữ ký MoMo không hợp lệ.");
            }

            // If rawData contains key=value pairs, verify critical fields are not tampered outside rawData
            if (rawData.Contains('='))
            {
                var signedPairs = rawData.Split('&', StringSplitOptions.RemoveEmptyEntries)
                    .Select(p => p.Split('=', 2))
                    .Where(p => p.Length == 2)
                    .ToDictionary(p => p[0].Trim(), p => p[1].Trim(), StringComparer.OrdinalIgnoreCase);

                if (signedPairs.TryGetValue("resultCode", out var signedResultCode) &&
                    callbackData.TryGetValue("resultCode", out var outerResultCode) &&
                    !string.Equals(signedResultCode, outerResultCode, StringComparison.Ordinal))
                {
                    throw new BusinessException("Dữ liệu trạng thái thanh toán MoMo không khớp với chữ ký.");
                }

                if (signedPairs.TryGetValue("txnRef", out var signedTxnRef) &&
                    callbackData.TryGetValue("txnRef", out var outerTxnRef) &&
                    !string.Equals(signedTxnRef, outerTxnRef, StringComparison.Ordinal))
                {
                    throw new BusinessException("Mã giao dịch MoMo không khớp với chữ ký.");
                }
            }

            txnNumber = callbackData.TryGetValue("orderId", out var refVal) ? refVal : (callbackData.TryGetValue("txnRef", out var tRef) ? tRef : string.Empty);
            gatewayTxnId = callbackData.TryGetValue("transId", out var transVal) ? transVal : string.Empty;
            responseCode = callbackData.TryGetValue("resultCode", out var rCode) ? rCode : string.Empty;
            isSuccess = responseCode == "0";
        }
        else
        {
            txnNumber = callbackData.TryGetValue("txnRef", out var refVal) ? refVal : string.Empty;
            gatewayTxnId = $"CASH-{DateTime.UtcNow.Ticks}";
            responseCode = "00";
            isSuccess = true;
        }

        using var tx = await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            var transaction = await _unitOfWork.Context.PaymentTransactions
                .Include(p => p.Order)
                    .ThenInclude(o => o!.Items)
                .Include(p => p.Order)
                    .ThenInclude(o => o!.Table)
                .Include(p => p.Order)
                    .ThenInclude(o => o!.Voucher)
                .FirstOrDefaultAsync(p => p.TransactionNumber == txnNumber, ct);

            if (transaction == null)
                throw new NotFoundException($"Không tìm thấy giao dịch thanh toán #{txnNumber}.");

            if (transaction.Gateway != gateway)
                throw new BusinessException($"Cổng thanh toán không khớp với giao dịch #{txnNumber}.");

            // Validate amount integrity if amount is provided in callback
            if (gateway == PaymentGateway.VnPay &&
                callbackData.TryGetValue("vnp_Amount", out var vnpAmountStr) &&
                !string.IsNullOrWhiteSpace(vnpAmountStr))
            {
                var expectedVnpAmount = (long)(transaction.Amount * 100);
                if (!long.TryParse(vnpAmountStr, out var actualVnpAmount) || actualVnpAmount != expectedVnpAmount)
                {
                    throw new BusinessException("Số tiền thanh toán VNPAY không khớp với giá trị đơn hàng.");
                }
            }
            else if (gateway == PaymentGateway.MoMo &&
                     callbackData.TryGetValue("amount", out var momoAmountStr) &&
                     !string.IsNullOrWhiteSpace(momoAmountStr))
            {
                if (!decimal.TryParse(momoAmountStr, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var actualMoMoAmount)
                    || actualMoMoAmount != transaction.Amount)
                {
                    throw new BusinessException("Số tiền thanh toán MoMo không khớp với giá trị đơn hàng.");
                }
            }

            // Idempotency: return immediately if transaction already succeeded
            if (transaction.Status == PaymentTransactionStatus.Success)
            {
                return true;
            }

            if (!isSuccess)
            {
                transaction.MarkFailed($"Cổng thanh toán phản hồi lỗi: {responseCode}", responseCode);
                await _unitOfWork.SaveChangesAsync(ct);
                await _unitOfWork.CommitTransactionAsync(ct);
                return false;
            }

            if (gateway == PaymentGateway.Cash)
            {
                var openShift = await _unitOfWork.Context.CashierShifts
                    .FirstOrDefaultAsync(s => s.Status == ShiftStatus.Open, ct);
                if (openShift == null)
                {
                    throw new BusinessException(OpenShiftRequiredMessage);
                }

                if (!transaction.ShiftId.HasValue)
                {
                    transaction.AssignShift(openShift.Id);
                }
            }
            else if (!transaction.ShiftId.HasValue)
            {
                var openShift = await _unitOfWork.Context.CashierShifts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.Status == ShiftStatus.Open, ct);
                if (openShift != null)
                {
                    transaction.AssignShift(openShift.Id);
                }
            }

            transaction.MarkSuccess(gatewayTxnId, responseCode);

            var order = transaction.Order;
            if (order != null)
            {
                // Advance any pending/cooking items to Served to allow order completion
                foreach (var item in order.Items.Where(i => i.ItemStatus != OrderItemStatus.Served && i.ItemStatus != OrderItemStatus.Cancelled))
                {
                    if (item.ItemStatus == OrderItemStatus.Pending) item.MarkSentToKitchen();
                    if (item.ItemStatus == OrderItemStatus.SentToKitchen) item.MarkCooking();
                    if (item.ItemStatus == OrderItemStatus.Cooking) item.MarkReady();
                    if (item.ItemStatus == OrderItemStatus.Ready) item.MarkServed();
                }

                order.CompleteOrder();

                // Record voucher usage if applicable
                if (order.VoucherId.HasValue && order.UserId.HasValue)
                {
                    var voucher = await _unitOfWork.Context.Vouchers.FirstOrDefaultAsync(v => v.Id == order.VoucherId.Value, ct);
                    if (voucher != null)
                    {
                        int userUsageCount = await _unitOfWork.Context.UserVoucherUsages
                            .CountAsync(u => u.VoucherId == voucher.Id && u.UserId == order.UserId.Value, ct);
                        voucher.RecordUsage(order.UserId.Value, order.Id, order.DiscountAmount, userUsageCount, order.SubTotal);
                    }
                }

                // Release tables to cleaning if DineIn (including merged child tables)
                await ReleaseTablesForCompletedOrderAsync(order, ct);

                // Trigger Recipe BOM inventory deduction
                if (_inventoryQueryRepo != null)
                {
                    await _inventoryQueryRepo.DeductInventoryForCompletedOrderAsync(order.Id, order.UserId ?? 1, ct);
                }
            }

            await _unitOfWork.SaveChangesAsync(ct);
            await _unitOfWork.CommitTransactionAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi xử lý callback thanh toán cho giao dịch #{TxnNumber}", txnNumber);
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    public async Task<bool> CancelOrderAsync(int orderId, string reason, int staffUserId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy đơn hàng không được để trống.");

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        using var tx = await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            var order = await _unitOfWork.Context.Orders
                .Include(o => o.Table)
                .Include(o => o.Items)
                .FirstOrDefaultAsync(o => o.Id == orderId, ct);

            if (order == null)
                throw new NotFoundException($"Không tìm thấy đơn hàng #{orderId}.");

            if (order.Status == OrderStatus.Completed)
                throw new BusinessException("Không thể hủy đơn hàng đã hoàn tất thanh toán.");

            order.CancelOrder(reason);

            // Cancel active kitchen tickets
            var kitchenTickets = await _unitOfWork.Context.KitchenTickets
                .Include(k => k.Items)
                .Where(k => k.OrderId == orderId && k.Status != KitchenTicketStatus.Served && k.Status != KitchenTicketStatus.Cancelled)
                .ToListAsync(ct);

            foreach (var ticket in kitchenTickets)
            {
                ticket.CancelTicket(reason);
            }

            // Release occupied tables (including merged child tables)
            await ReleaseTablesForCompletedOrderAsync(order, ct);

            await _unitOfWork.SaveChangesAsync(ct);
            await _unitOfWork.CommitTransactionAsync(ct);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi hủy đơn hàng #{OrderId}", orderId);
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    public async Task<List<OnlinePendingOrderDto>> GetPendingOnlineOrdersAsync(CancellationToken ct = default)
    {
        var orders = await _unitOfWork.Context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
                .ThenInclude(i => i.MenuItem)
            .Where(o => (o.OrderType == OrderType.Takeaway || o.OrderType == OrderType.Delivery)
                     && o.Status == OrderStatus.Pending)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(ct);

        return orders.Select(o => new OnlinePendingOrderDto
        {
            OrderId = o.Id,
            OrderNumber = o.OrderNumber,
            OrderType = o.OrderType,
            OrderTypeName = o.OrderType == OrderType.Takeaway ? "Mang về (Takeaway)" : "Giao hàng (Delivery)",
            CustomerName = o.RecipientName,
            CustomerPhone = o.RecipientPhone,
            DeliveryAddress = o.DeliveryAddress,
            TotalAmount = o.TotalAmount,
            TotalItems = o.Items.Sum(i => i.Quantity),
            Status = o.Status.ToString(),
            CreatedAt = o.CreatedAt,
            ItemsSummary = o.Items.Select(i => $"{i.MenuItem?.Name ?? "Món"} x{i.Quantity}").ToList()
        }).ToList();
    }

    public async Task<bool> ApproveOnlineOrderAsync(ApproveOnlineOrderRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên duyệt đơn không hợp lệ.");

        var order = await _unitOfWork.Context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{request.OrderId}.");

        if (order.Status != OrderStatus.Pending)
            throw new BusinessException($"Đơn hàng #{order.OrderNumber} đã ở trạng thái {order.Status}, không thể duyệt lại.");

        // Chuyển đơn sang InPreparation và tự động phân luồng bắn xuống trạm bếp KDS
        await SendOrderToKitchenAsync(order.Id, staffUserId, ct);
        return true;
    }

    public async Task<List<OnlinePendingOrderDto>> GetOrdersReadyForDispatchAsync(CancellationToken ct = default)
    {
        var orders = await _unitOfWork.Context.Orders
            .AsNoTracking()
            .Include(o => o.Items)
                .ThenInclude(i => i.MenuItem)
            .Where(o => (o.OrderType == OrderType.Takeaway || o.OrderType == OrderType.Delivery)
                     && o.Status == OrderStatus.ReadyForDispatch)
            .OrderBy(o => o.CreatedAt)
            .ToListAsync(ct);

        return orders.Select(o => new OnlinePendingOrderDto
        {
            OrderId = o.Id,
            OrderNumber = o.OrderNumber,
            OrderType = o.OrderType,
            OrderTypeName = o.OrderType == OrderType.Takeaway ? "Mang về (Takeaway)" : "Giao hàng (Delivery)",
            CustomerName = o.RecipientName,
            CustomerPhone = o.RecipientPhone,
            DeliveryAddress = o.DeliveryAddress,
            TotalAmount = o.TotalAmount,
            TotalItems = o.Items.Sum(i => i.Quantity),
            Status = o.Status.ToString(),
            CreatedAt = o.CreatedAt,
            ItemsSummary = o.Items.Select(i => $"{i.MenuItem?.Name ?? "Món"} x{i.Quantity}").ToList()
        }).ToList();
    }

    public async Task<bool> DispatchOnlineOrderAsync(int orderId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên xuất đơn không hợp lệ.");

        var order = await _unitOfWork.Context.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{orderId}.");

        order.Dispatch();
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> CompleteOnlineOrderDeliveryAsync(int orderId, int userId, bool isStaff, CancellationToken ct = default)
    {
        var order = await _unitOfWork.Context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == orderId, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{orderId}.");

        if (!isStaff && order.UserId != userId)
            throw new ForbiddenException("Bạn không có quyền xác nhận đơn hàng này.");

        if (order.Status == OrderStatus.Completed)
            return true;

        if (order.Status == OrderStatus.Cancelled)
            throw new BusinessException("Không thể hoàn tất đơn hàng đã bị hủy.");

        foreach (var item in order.Items.Where(i => i.ItemStatus != OrderItemStatus.Cancelled && i.ItemStatus != OrderItemStatus.Served))
        {
            item.MarkReady();
            item.MarkServed();
        }

        var ticketItems = await _unitOfWork.Context.KitchenTicketItems
            .Include(kti => kti.Ticket)
                .ThenInclude(t => t!.Items)
            .Where(kti => kti.Ticket != null && kti.Ticket.OrderId == orderId && kti.Status != KitchenItemStatus.Cancelled && kti.Status != KitchenItemStatus.Served)
            .ToListAsync(ct);

        foreach (var kti in ticketItems)
        {
            if (kti.Status == KitchenItemStatus.Pending)
                kti.StartCooking(userId > 0 ? userId : 1);
            if (kti.Status == KitchenItemStatus.Cooking)
                kti.MarkReady();
            if (kti.Status == KitchenItemStatus.Ready)
                kti.MarkServed();
            kti.Ticket?.SyncStatusFromItems();
        }

        order.CompleteOrder();

        // Cộng điểm thưởng hội viên nếu có UserId (10.000đ = 1 điểm)
        if (order.UserId.HasValue && order.UserId.Value > 0)
        {
            var customer = await _unitOfWork.Context.Users.FirstOrDefaultAsync(u => u.UserId == order.UserId.Value, ct);
            if (customer != null)
            {
                int earnedPoints = (int)Math.Floor(order.TotalAmount / 10000m);
                if (earnedPoints > 0)
                {
                    customer.LoyaltyPoints += earnedPoints;
                    if (customer.LoyaltyPoints >= 500) customer.MembershipTier = "PLATINUM";
                    else if (customer.LoyaltyPoints >= 200) customer.MembershipTier = "GOLD";
                    else if (customer.LoyaltyPoints >= 50) customer.MembershipTier = "SILVER";
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<TableQrSessionResponseDto> GetTableQrSessionAsync(int tableId, string? token, string? clientIp, CancellationToken ct = default)
    {
        if (tableId <= 0)
            throw new BusinessException("Mã bàn không hợp lệ.");

        var table = await _unitOfWork.Context.Tables
            .Include(t => t.Area)
            .Include(t => t.CurrentOrder)
                .ThenInclude(o => o!.Items)
                    .ThenInclude(i => i.MenuItem)
            .Include(t => t.CurrentOrder)
                .ThenInclude(o => o!.Items)
                    .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(t => t.Id == tableId, ct);

        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        // Đối soát danh sách WiFi
        var activeConfigs = await _unitOfWork.Context.BranchWifiConfigs
            .AsNoTracking()
            .Where(w => w.IsActive)
            .ToListAsync(ct);

        var activeSsids = activeConfigs.Select(w => w.Ssid).Distinct().ToList();
        bool isWifiValid = true;
        if (clientIp != "127.0.0.1" && clientIp != "::1" && clientIp != "localhost" && !string.IsNullOrWhiteSpace(clientIp))
        {
            if (activeConfigs.Any())
            {
                isWifiValid = activeConfigs.Any(w => !string.IsNullOrWhiteSpace(w.PublicIpSubnet) &&
                    (clientIp.Trim().Equals(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase) ||
                     clientIp.Trim().StartsWith(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase)));
            }
        }

        bool isServing = table.Status == TableStatus.Serving && table.CurrentOrderId.HasValue && !string.IsNullOrWhiteSpace(table.SessionToken);
        var fallbackToken = table.CurrentOrderId.HasValue ? $"table_{table.Id}_order_{table.CurrentOrderId.Value}" : string.Empty;
        bool isTokenValid = isServing && !string.IsNullOrWhiteSpace(token) &&
                            (string.Equals(token.Trim(), table.SessionToken, StringComparison.OrdinalIgnoreCase) ||
                             (!string.IsNullOrEmpty(fallbackToken) && string.Equals(token.Trim(), fallbackToken, StringComparison.OrdinalIgnoreCase)));

        // Nếu bàn không ở trạng thái Serving hoặc token không khớp: giấu toàn bộ danh sách món đã gọi và bắt buộc nhập PIN
        if (!isServing || !isTokenValid)
        {
            return new TableQrSessionResponseDto
            {
                TableId = table.Id,
                TableNumber = table.TableNumber,
                AreaName = table.Area?.AreaName ?? "Khu vực chung",
                Capacity = table.Capacity,
                Status = table.Status.ToString(),
                CurrentOrderId = isServing ? table.CurrentOrderId : null,
                OrderNumber = null,
                OpenedAt = null,
                SubTotal = 0,
                TotalAmount = 0,
                Items = new List<TableQrOrderedItemDto>(),
                ActiveSsids = activeSsids,
                IsWifiValid = isWifiValid,
                RequiresPin = isServing,
                IsPinVerified = false
            };
        }

        var order = table.CurrentOrder;
        var orderedItems = new List<TableQrOrderedItemDto>();

        if (order != null && order.Items.Any())
        {
            var orderItemIds = order.Items.Select(i => i.Id).ToList();
            var ticketItems = await _unitOfWork.Context.KitchenTicketItems
                .AsNoTracking()
                .Where(ti => orderItemIds.Contains(ti.OrderItemId))
                .ToListAsync(ct);

            var ticketItemMap = ticketItems
                .GroupBy(ti => ti.OrderItemId)
                .ToDictionary(g => g.Key, g => g.OrderByDescending(x => x.Id).First());

            foreach (var item in order.Items.Where(i => i.ItemStatus != OrderItemStatus.Cancelled))
            {
                string status = "Pending";
                if (ticketItemMap.TryGetValue(item.Id, out var ticketItem))
                {
                    status = ticketItem.Status switch
                    {
                        Domain.Entities.Kds.KitchenItemStatus.Pending => "Pending",
                        Domain.Entities.Kds.KitchenItemStatus.Cooking => "Cooking",
                        Domain.Entities.Kds.KitchenItemStatus.Ready => "Ready",
                        Domain.Entities.Kds.KitchenItemStatus.Served => "Served",
                        _ => "Pending"
                    };
                }
                else if (item.ItemStatus == OrderItemStatus.Served)
                {
                    status = "Served";
                }

                orderedItems.Add(new TableQrOrderedItemDto
                {
                    Id = item.Id,
                    MenuItemId = item.MenuItemId,
                    Name = item.MenuItem?.Name ?? $"Món #{item.MenuItemId}",
                    JapaneseName = item.MenuItem?.JapaneseName,
                    Quantity = item.Quantity,
                    Price = item.UnitPrice,
                    Total = item.TotalPrice,
                    Status = status,
                    Modifiers = item.Modifiers.Any()
                        ? string.Join(", ", item.Modifiers.Select(m => m.ModifierOptionName))
                        : null,
                    SpecialInstructions = item.SpecialInstructions,
                    CreatedAt = item.CreatedAt
                });
            }
        }

        var groupedOrderedItems = orderedItems
            .GroupBy(oi => new
            {
                oi.MenuItemId,
                Modifiers = (oi.Modifiers ?? string.Empty).Trim().ToUpperInvariant(),
                Instructions = (oi.SpecialInstructions ?? string.Empty).Trim().ToUpperInvariant(),
                oi.Status
            })
            .Select(g =>
            {
                var first = g.First();
                return new TableQrOrderedItemDto
                {
                    Id = first.Id,
                    MenuItemId = first.MenuItemId,
                    Name = first.Name,
                    JapaneseName = first.JapaneseName,
                    Quantity = g.Sum(x => x.Quantity),
                    Price = first.Price,
                    Total = g.Sum(x => x.Total),
                    Status = first.Status,
                    Modifiers = first.Modifiers,
                    SpecialInstructions = first.SpecialInstructions,
                    CreatedAt = g.Min(x => x.CreatedAt)
                };
            })
            .OrderBy(x => x.CreatedAt)
            .ToList();

        return new TableQrSessionResponseDto
        {
            TableId = table.Id,
            TableNumber = table.TableNumber,
            AreaName = table.Area?.AreaName ?? "Khu vực chung",
            Capacity = table.Capacity,
            Status = table.Status.ToString(),
            CurrentOrderId = table.CurrentOrderId,
            OrderNumber = order?.OrderNumber,
            OpenedAt = order?.CreatedAt ?? table.CreatedAt,
            SubTotal = order?.SubTotal ?? 0,
            TotalAmount = order?.TotalAmount ?? 0,
            Items = groupedOrderedItems,
            ActiveSsids = activeSsids,
            IsWifiValid = isWifiValid,
            RequiresPin = false,
            IsPinVerified = true
        };
    }

    public async Task<TableQrOrderResponseDto> CreateQrTableOrderAsync(TableQrOrderRequestDto request, string? clientIp, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        // 1. Lấy thông tin bàn và kiểm tra trạng thái
        var table = await _unitOfWork.Context.Tables
            .Include(t => t.CurrentOrder)
                .ThenInclude(o => o!.Items)
            .FirstOrDefaultAsync(t => t.Id == request.TableId, ct);

        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{request.TableId}.");

        if (table.Status != TableStatus.Serving || !table.CurrentOrderId.HasValue || table.CurrentOrder == null)
            throw new BusinessException($"Bàn {table.TableNumber} chưa được mở bàn trên hệ thống POS. Vui lòng liên hệ nhân viên phục vụ.");

        if (string.IsNullOrWhiteSpace(table.SessionToken))
            throw new BusinessException($"Bàn {table.TableNumber} chưa được cấp mã phiên gọi món. Vui lòng liên hệ nhân viên phục vụ.");

        // Xác thực mã QR phiên hoặc mã PIN: Ngăn chặn triệt để việc dùng lại mã QR cũ của lượt khách trước
        var fallbackToken = table.CurrentOrderId.HasValue ? $"table_{table.Id}_order_{table.CurrentOrderId.Value}" : string.Empty;
        bool isTokenValid = !string.IsNullOrWhiteSpace(request.Token) &&
                            (string.Equals(request.Token.Trim(), table.SessionToken, StringComparison.OrdinalIgnoreCase) ||
                             (!string.IsNullOrEmpty(fallbackToken) && string.Equals(request.Token.Trim(), fallbackToken, StringComparison.OrdinalIgnoreCase)));

        bool isPinValid = !string.IsNullOrWhiteSpace(request.PinCode) &&
                          !string.IsNullOrWhiteSpace(table.PinCode) &&
                          string.Equals(request.PinCode.Trim(), table.PinCode, StringComparison.OrdinalIgnoreCase);

        if (!isTokenValid && !isPinValid)
        {
            throw new ForbiddenException("Mã QR phiên gọi món không hợp lệ hoặc đã hết hạn từ lượt khách trước. Quý khách vui lòng quét lại mã QR trên phiếu mở bàn hiện tại hoặc nhập đúng mã PIN.");
        }

        // 2. Khóa chống Spam (Rate Limiting) giữa 2 lần đặt món (30 giây)
        if (table.LastOrderAt.HasValue && (DateTime.UtcNow - table.LastOrderAt.Value).TotalSeconds < 30)
        {
            var remainingSecs = 30 - (int)(DateTime.UtcNow - table.LastOrderAt.Value).TotalSeconds;
            throw new BusinessException($"Đơn trước đó của bàn đang được chuyển tới bếp. Vui lòng đợi {remainingSecs}s trước khi gửi tiếp.");
        }

        // Giới hạn an toàn số lượng món mỗi lần gọi
        if (request.Items == null || !request.Items.Any())
            throw new BusinessException("Danh sách món ăn không được để trống.");

        var totalQty = request.Items.Sum(i => i.Quantity);
        if (totalQty > 20)
            throw new BusinessException("Mỗi lượt gọi món qua QR tối đa 20 phần ăn. Vui lòng gọi trực tiếp nhân viên phục vụ nếu cần số lượng lớn.");

        // 4. Kiểm tra đối soát mạng WiFi IP WAN quán (Loại bỏ kiểm tra lỏng lẻo ClientSsid)
        bool isNetworkValid = false;
        if (clientIp == "127.0.0.1" || clientIp == "::1" || clientIp == "localhost")
        {
            isNetworkValid = true;
        }
        else
        {
            var activeConfigs = await _unitOfWork.Context.BranchWifiConfigs
                .AsNoTracking()
                .Where(w => w.IsActive)
                .ToListAsync(ct);

            if (!activeConfigs.Any())
            {
                isNetworkValid = true;
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(clientIp))
                {
                    isNetworkValid = activeConfigs.Any(w => !string.IsNullOrWhiteSpace(w.PublicIpSubnet) &&
                        (clientIp.Trim().Equals(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase) ||
                         clientIp.Trim().StartsWith(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase)));
                }
            }
        }

        if (!isNetworkValid)
        {
            var firstSsid = await _unitOfWork.Context.BranchWifiConfigs
                .Where(w => w.IsActive)
                .Select(w => w.Ssid)
                .FirstOrDefaultAsync(ct) ?? "WiFi quán";

            throw new ForbiddenException($"Vui lòng kết nối vào mạng WiFi '{firstSsid}' của nhà hàng để có thể gọi món tại bàn.");
        }

        table.RecordOrderTime();
        var order = table.CurrentOrder;

        // 3. Nạp danh mục món ăn và thêm món
        var menuItemIds = request.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await _unitOfWork.Context.MenuItems
            .Include(m => m.ModifierGroups)
                .ThenInclude(mg => mg.ModifierGroup)
                    .ThenInclude(g => g.Options)
            .Where(m => menuItemIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var modifierOptionIds = request.Items
            .SelectMany(i => i.ModifierOptionIds)
            .Distinct()
            .ToList();

        var modifierOptions = await _unitOfWork.Context.ModifierOptions
            .Where(mo => modifierOptionIds.Contains(mo.Id))
            .ToDictionaryAsync(mo => mo.Id, ct);

        // Consolidate identical items in request (Table QR)
        var consolidatedItems = request.Items
            .GroupBy(i => new
            {
                i.MenuItemId,
                ModifierOptionIds = string.Join(",", (i.ModifierOptionIds ?? new List<int>()).OrderBy(id => id)),
                Instructions = (i.SpecialInstructions ?? string.Empty).Trim().ToLowerInvariant()
            })
            .Select(g => new CreateOrderItemDto
            {
                MenuItemId = g.Key.MenuItemId,
                Quantity = g.Sum(x => x.Quantity),
                ModifierOptionIds = g.First().ModifierOptionIds,
                SpecialInstructions = g.First().SpecialInstructions
            })
            .ToList();

        foreach (var itemDto in consolidatedItems)
        {
            if (!menuItems.TryGetValue(itemDto.MenuItemId, out var menuItem))
                throw new NotFoundException($"Không tìm thấy món ăn #{itemDto.MenuItemId}.");

            var selectedMods = (itemDto.ModifierOptionIds ?? new List<int>()).Select(optId =>
            {
                if (!modifierOptions.TryGetValue(optId, out var opt))
                    throw new NotFoundException($"Không tìm thấy tùy chọn #{optId}.");
                return (opt, 1);
            }).ToList();

            order.AddItem(menuItem, itemDto.Quantity, selectedMods, itemDto.SpecialInstructions);
        }

        await _unitOfWork.SaveChangesAsync(ct);

        // 4. Bắn trực tiếp vào trạm bếp KDS (theo đúng yêu cầu của bạn)
        await SendOrderToKitchenAsync(order.Id, 1, ct);

        return new TableQrOrderResponseDto
        {
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            TableNumber = table.TableNumber,
            ItemsCount = request.Items.Sum(i => i.Quantity),
            SubTotal = order.SubTotal,
            TotalAmount = order.TotalAmount,
            SentDirectlyToKitchen = true,
            Message = "Gọi món thành công! Các món ăn đã được chuyển trực tiếp vào màn hình bếp KDS để chế biến."
        };
    }

    public async Task<OrderDetailViewDto> AddItemsToOrderAsync(AddOrderItemsRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        var order = await _unitOfWork.Context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{request.OrderId}.");

        var menuItemIds = request.Items.Select(i => i.MenuItemId).Distinct().ToList();
        var menuItems = await _unitOfWork.Context.MenuItems
            .Include(m => m.ModifierGroups)
                .ThenInclude(mg => mg.ModifierGroup)
                    .ThenInclude(g => g.Options)
            .Where(m => menuItemIds.Contains(m.Id))
            .ToDictionaryAsync(m => m.Id, ct);

        var modifierOptionIds = request.Items
            .SelectMany(i => i.ModifierOptionIds)
            .Distinct()
            .ToList();

        var modifierOptions = await _unitOfWork.Context.ModifierOptions
            .Where(mo => modifierOptionIds.Contains(mo.Id))
            .ToDictionaryAsync(mo => mo.Id, ct);

        // Consolidate identical items in request (POS)
        var consolidatedItems = request.Items
            .GroupBy(i => new
            {
                i.MenuItemId,
                ModifierOptionIds = string.Join(",", (i.ModifierOptionIds ?? new List<int>()).OrderBy(id => id)),
                Instructions = (i.SpecialInstructions ?? string.Empty).Trim().ToLowerInvariant()
            })
            .Select(g => new CreateOrderItemDto
            {
                MenuItemId = g.Key.MenuItemId,
                Quantity = g.Sum(x => x.Quantity),
                ModifierOptionIds = g.First().ModifierOptionIds,
                SpecialInstructions = g.First().SpecialInstructions
            })
            .ToList();

        foreach (var itemDto in consolidatedItems)
        {
            if (!menuItems.TryGetValue(itemDto.MenuItemId, out var menuItem))
                throw new NotFoundException($"Không tìm thấy món ăn #{itemDto.MenuItemId}.");

            var selectedMods = (itemDto.ModifierOptionIds ?? new List<int>()).Select(optId =>
            {
                if (!modifierOptions.TryGetValue(optId, out var opt))
                    throw new NotFoundException($"Không tìm thấy tùy chọn #{optId}.");
                return (opt, 1);
            }).ToList();

            order.AddItem(menuItem, itemDto.Quantity, selectedMods, itemDto.SpecialInstructions);
        }

        await _unitOfWork.SaveChangesAsync(ct);

        if (request.SendDirectlyToKitchen)
        {
            await SendOrderToKitchenAsync(order.Id, staffUserId, ct);
        }

        var detail = await _orderQueryRepo.GetOrderWithDetailsByIdAsync(order.Id, ct);
        return detail!;
    }

    public async Task<bool> CancelOrderItemAsync(CancelOrderItemRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        var order = await _unitOfWork.Context.Orders
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{request.OrderId}.");

        order.CancelItem(request.OrderItemId, request.Reason);

        // Đồng bộ hủy trên phiếu bếp KDS
        var kitchenItem = await _unitOfWork.Context.KitchenTicketItems
            .Include(ki => ki.Ticket)
                .ThenInclude(t => t!.Items)
            .FirstOrDefaultAsync(ki => ki.OrderItemId == request.OrderItemId, ct);

        if (kitchenItem != null && kitchenItem.Status != Domain.Entities.Kds.KitchenItemStatus.Served)
        {
            kitchenItem.Cancel(request.Reason);
            kitchenItem.Ticket?.SyncStatusFromItems();
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> SplitOrderAsync(SplitOrderRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        var sourceOrder = await _unitOfWork.Context.Orders
            .Include(o => o.Items)
                .ThenInclude(i => i.Modifiers)
            .FirstOrDefaultAsync(o => o.Id == request.SourceOrderId, ct);

        if (sourceOrder == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng nguồn #{request.SourceOrderId}.");

        var targetTable = await _unitOfWork.Context.Tables
            .Include(t => t.CurrentOrder)
                .ThenInclude(o => o!.Items)
            .FirstOrDefaultAsync(t => t.Id == request.TargetTableId, ct);

        if (targetTable == null)
            throw new NotFoundException($"Không tìm thấy bàn đích #{request.TargetTableId}.");

        Order targetOrder;
        if (targetTable.CurrentOrder == null)
        {
            // Bàn đích chưa có đơn -> Tạo đơn mới cho bàn đích
            targetOrder = new Order(OrderType.DineIn, targetTable.Id, null, null, 2, request.Notes ?? $"Tách từ đơn #{sourceOrder.OrderNumber}");
            await _unitOfWork.Context.Orders.AddAsync(targetOrder, ct);
            await _unitOfWork.SaveChangesAsync(ct);
            targetTable.Occupy(targetOrder.Id, 2);
        }
        else
        {
            targetOrder = targetTable.CurrentOrder;
        }

        var itemsToMove = sourceOrder.Items
            .Where(i => request.OrderItemIds.Contains(i.Id))
            .ToList();

        if (!itemsToMove.Any())
            throw new BusinessException("Không tìm thấy món ăn hợp lệ nào trong danh sách cần tách.");

        foreach (var item in itemsToMove)
        {
            sourceOrder.DetachItem(item.Id);
            item.ReassignOrder(targetOrder.Id);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    /// <summary>
    /// Làm tròn số tiền hóa đơn cần thanh toán theo bội số 1.000đ:
    /// Phần lẻ <= 700đ: làm tròn XUỐNG cho khách (bội số 1.000đ). VD: 22.700đ -> 22.000đ, 1.058.400đ -> 1.058.000đ.
    /// Phần lẻ > 700đ (từ 701đ trở lên): làm tròn LÊN (bội số 1.000đ). VD: 22.701đ -> 23.000đ, 1.058.800đ -> 1.059.000đ.
    /// </summary>
    public static decimal RoundBillAmount(decimal rawBill)
    {
        if (rawBill <= 0) return 0;
        var thousands = Math.Floor(rawBill / 1000m) * 1000m;
        var remainder = rawBill - thousands;
        return remainder <= 700m ? thousands : thousands + 1000m;
    }

    /// <summary>
    /// Làm tròn tiền thối tiền mặt về bội số 1.000đ tương ứng với quy tắc làm tròn hóa đơn:
    /// Phần lẻ hóa đơn <= 700đ (tương đương phần lẻ tiền thối >= 300đ) làm tròn lên cho khách.
    /// VD: Hóa đơn 22.700đ -> làm tròn xuống 22.000đ, khách đưa 30.000đ thối 8.000đ.
    ///     Hóa đơn 22.701đ -> làm tròn lên 23.000đ, khách đưa 30.000đ thối 7.000đ.
    /// </summary>
    public static decimal RoundCashChange(decimal rawChange)
    {
        if (rawChange <= 0) return 0;
        var thousands = Math.Floor(rawChange / 1000m) * 1000m;
        var remainder = rawChange - thousands;
        if (remainder == 0) return thousands;
        return remainder >= 300m ? thousands + 1000m : thousands;
    }

    public async Task<ConfirmCashPaymentResponseDto> ConfirmCashPaymentWithChangeAsync(ConfirmCashPaymentRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã thu ngân không hợp lệ.");

        var openShift = await _unitOfWork.Context.CashierShifts
            .FirstOrDefaultAsync(s => s.Status == ShiftStatus.Open, ct);
        if (openShift == null)
        {
            throw new BusinessException(OpenShiftRequiredMessage);
        }

        var order = await _unitOfWork.Context.Orders
            .Include(o => o.Items)
            .Include(o => o.Table)
            .FirstOrDefaultAsync(o => o.Id == request.OrderId, ct);

        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{request.OrderId}.");

        var roundedBill = RoundBillAmount(order.TotalAmount);

        if (order.Status == OrderStatus.Completed)
        {
            // Nếu đơn đã hoàn tất thanh toán trước đó, lập tức giải phóng bàn để không bị kẹt bàn
            await ReleaseTablesForCompletedOrderAsync(order, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            return new ConfirmCashPaymentResponseDto
            {
                Success = true,
                OrderId = order.Id,
                OrderNumber = order.OrderNumber,
                TotalAmount = order.TotalAmount,
                AmountGiven = request.AmountGiven,
                ChangeAmount = Math.Max(0, request.AmountGiven - roundedBill),
                Message = "Đơn hàng này đã thanh toán hoàn tất trước đó. Bàn đã được chuyển sang trạng thái chờ dọn dẹp."
            };
        }

        if (request.AmountGiven < roundedBill)
        {
            throw new BusinessException($"Số tiền khách đưa ({request.AmountGiven:N0} đ) không đủ để thanh toán hóa đơn ({roundedBill:N0} đ).");
        }

        var changeAmount = Math.Max(0, request.AmountGiven - roundedBill);

        // Ghi nhận giao dịch thanh toán tiền mặt theo số tiền hóa đơn đã làm tròn
        var txn = order.AddPaymentTransaction(PaymentGateway.Cash, roundedBill);
        txn.AssignShift(openShift.Id);
        txn.RecordCashPayment(request.AmountGiven, changeAmount);
        txn.MarkSuccess($"CASH-{order.OrderNumber}", "00");

        // Hoàn tất đơn hàng và giải phóng các bàn (kể cả bàn con gộp)
        foreach (var item in order.Items.Where(i => i.ItemStatus != OrderItemStatus.Served && i.ItemStatus != OrderItemStatus.Cancelled))
        {
            if (item.ItemStatus == OrderItemStatus.Pending) item.MarkSentToKitchen();
            if (item.ItemStatus == OrderItemStatus.SentToKitchen) item.MarkCooking();
            if (item.ItemStatus == OrderItemStatus.Cooking) item.MarkReady();
            if (item.ItemStatus == OrderItemStatus.Ready) item.MarkServed();
        }

        order.CompleteOrder();

        await ReleaseTablesForCompletedOrderAsync(order, ct);

        // Khấu trừ tồn kho theo BOM
        if (_inventoryQueryRepo != null)
        {
            await _inventoryQueryRepo.DeductInventoryForCompletedOrderAsync(order.Id, staffUserId, ct);
        }

        // Tích điểm thành viên
        int pointsEarned = (int)(order.TotalAmount / 10000m);
        int? newTotalPoints = null;
        string? tier = null;

        User? user = null;
        if (order.UserId.HasValue)
        {
            user = await _unitOfWork.Context.Users.FirstOrDefaultAsync(u => u.UserId == order.UserId.Value, ct);
        }
        else if (!string.IsNullOrWhiteSpace(request.CustomerPhone))
        {
            user = await _unitOfWork.Context.Users.FirstOrDefaultAsync(u => u.PhoneNumber == request.CustomerPhone.Trim(), ct);
        }

        if (user != null)
        {
            user.LoyaltyPoints += pointsEarned;
            if (user.LoyaltyPoints >= 500) user.MembershipTier = "DIAMOND";
            else if (user.LoyaltyPoints >= 200) user.MembershipTier = "GOLD";
            else if (user.LoyaltyPoints >= 50) user.MembershipTier = "SILVER";

            newTotalPoints = user.LoyaltyPoints;
            tier = user.MembershipTier;
        }

        await _unitOfWork.SaveChangesAsync(ct);

        return new ConfirmCashPaymentResponseDto
        {
            Success = true,
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            TotalAmount = order.TotalAmount,
            AmountGiven = request.AmountGiven,
            ChangeAmount = changeAmount,
            LoyaltyPointsEarned = pointsEarned,
            NewTotalLoyaltyPoints = newTotalPoints,
            MembershipTier = tier,
            Message = $"Thanh toán tiền mặt thành công! Tiền thối lại cho khách: {changeAmount:N0} đ. Đơn hàng hoàn tất và bàn đã chuyển sang chờ dọn dẹp."
        };
    }

    public async Task<VietQrPaymentResponseDto> GetVietQrForOrderAsync(int orderId, CancellationToken ct = default)
    {
        var order = await _unitOfWork.Context.Orders.FirstOrDefaultAsync(o => o.Id == orderId, ct);
        if (order == null)
            throw new NotFoundException($"Không tìm thấy đơn hàng #{orderId}.");

        var setting = await _unitOfWork.Context.RestaurantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        var bankId = setting?.BankId ?? "970422";
        var accountNo = setting?.AccountNumber ?? "0987654321";
        var accountName = setting?.AccountName ?? "NHA HANG JAPANFOOD";
        var template = setting?.DefaultQrTemplate ?? "compact2";

        var description = $"JF {order.OrderNumber}";
        var qrImageUrl = $"https://img.vietqr.io/image/{bankId}-{accountNo}-{template}.png?amount={order.TotalAmount:0}&addInfo={Uri.EscapeDataString(description)}&accountName={Uri.EscapeDataString(accountName)}";

        return new VietQrPaymentResponseDto
        {
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            Amount = order.TotalAmount,
            BankId = bankId,
            AccountNumber = accountNo,
            AccountName = accountName,
            Description = description,
            QrImageUrl = qrImageUrl,
            QrDataUrl = qrImageUrl
        };
    }

    private async Task ReleaseTablesForCompletedOrderAsync(Order order, CancellationToken ct)
    {
        var relatedTables = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .Where(t => t.CurrentOrderId == order.Id 
                     || (order.TableId.HasValue && t.Id == order.TableId.Value)
                     || (order.TableId.HasValue && t.MergedIntoTableId == order.TableId.Value))
            .ToListAsync(ct);

        foreach (var tbl in relatedTables)
        {
            if (tbl.Status == TableStatus.Serving)
            {
                tbl.ReleaseToCleaning();
            }
            else if (tbl.Status == TableStatus.Reserved)
            {
                tbl.CancelReservation();
            }
        }
    }
}
