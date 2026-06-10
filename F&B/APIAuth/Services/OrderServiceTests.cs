using APIAuth.Services.Common;
using Application.DTOs.Ordering;
using Application.Services;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.Payment;
using Domain.Entities.TableManagement;
using Domain.Entities.Vouchers;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class OrderServiceTests : TestApplicationBase
{
    private readonly OrderService _service;

    public OrderServiceTests()
    {
        _service = new OrderService(
            UnitOfWork,
            OrderQueryRepo,
            ValidationFactory,
            VnPayService,
            MoMoService,
            NullLogger<OrderService>.Instance,
            MenuQueryRepo,
            VoucherQueryRepo,
            InventoryQueryRepo);
    }

    [Fact]
    public async Task CreateOrder_DineIn_ValidRequest_OccupiesTable_CommitsTransaction()
    {
        // Arrange
        await SeedOpenShiftAsync();
        var area = await SeedAreaAsync("MAIN", "Sảnh chính");
        var table = await SeedTableAsync(area.Id, "T-10", 4, 2);
        var cat = await SeedCategoryAsync();
        var dish1 = await SeedMenuItemAsync(cat.Id, "RAMEN-01", "Tonkotsu Ramen", 120000m);
        var dish2 = await SeedMenuItemAsync(cat.Id, "GYOZA-01", "Gyoza 6 pcs", 60000m);

        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.DineIn,
            TableId = table.Id,
            GuestCount = 2,
            Notes = "Không hành cho ramen",
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish1.Id, Quantity = 2, SpecialInstructions = "Không hành" },
                new() { MenuItemId = dish2.Id, Quantity = 1 }
            }
        };

        // Act
        var result = await _service.CreateOrderAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.OrderId > 0);
        Assert.Equal("T-10", result.TableNumber);
        Assert.Equal(2, result.Items.Count);
        Assert.Equal(300000m, result.SubTotal); // 120000*2 + 60000*1
        Assert.True(UnitOfWork.HasCommitted);
        Assert.True(UnitOfWork.CommitTransactionCount > 0);

        // Verify Table status updated to Serving
        var updatedTable = await Context.Tables.FirstOrDefaultAsync(t => t.Id == table.Id);
        Assert.NotNull(updatedTable);
        Assert.Equal(TableStatus.Serving, updatedTable.Status);
        Assert.Equal(result.OrderId, updatedTable.CurrentOrderId);
    }

    [Fact]
    public async Task CreateOrder_Takeaway_ValidRequest_NoTableRequired_CommitsTransaction()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "BENTO-01", "Salmon Bento", 150000m);

        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.Takeaway,
            TableId = null,
            GuestCount = 1,
            Notes = "Mang về gấp",
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish.Id, Quantity = 1 }
            }
        };

        // Act
        var result = await _service.CreateOrderAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Takeaway", result.OrderType);
        Assert.Null(result.TableNumber);
        Assert.True(UnitOfWork.HasCommitted);
    }

    [Fact]
    public async Task CreateOrder_WithPercentageVoucher_AppliesDiscount()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-03", "Miso Ramen", 200000m);
        var voucher = await SeedVoucherAsync("RAMEN20", DiscountType.Percentage, 20m, minOrderAmount: 100000m, maxDiscount: 50000m);

        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.Takeaway,
            UserId = user.UserId,
            GuestCount = 1,
            VoucherCode = "RAMEN20",
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish.Id, Quantity = 1 } // Subtotal 200000
            }
        };

        // Act
        var result = await _service.CreateOrderAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("RAMEN20", result.VoucherCode);
        Assert.Equal(40000m, result.DiscountAmount); // 20% of 200000 = 40000 (<= max 50000)
        Assert.Equal(200000m, result.SubTotal);
        Assert.True(UnitOfWork.HasCommitted);
    }

    [Fact]
    public async Task CreateOrder_UnavailableDish_ThrowsBusinessException_RollsBackTransaction()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "DISH-OUT", "Món hết", 100000m, isAvailable: false);

        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.Takeaway,
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish.Id, Quantity = 1 }
            }
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateOrderAsync(request));
        Assert.Contains("ngừng phục vụ", ex.Message);
        Assert.False(UnitOfWork.HasCommitted);
    }

    [Fact]
    public async Task CreateOrder_DineInWithoutTable_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);

        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.DineIn,
            TableId = null, // Missing table for DineIn
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish.Id, Quantity = 1 }
            }
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateOrderAsync(request));
        Assert.Contains("bắt buộc phải chọn bàn", ex.Message);
    }

    [Fact]
    public async Task CreateOrder_NonExistentTable_ThrowsNotFoundException_RollsBackTransaction()
    {
        // Arrange
        await SeedOpenShiftAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);

        var request = new CreateOrderRequestDto
        {
            OrderType = OrderType.DineIn,
            TableId = 99999, // Non-existent
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish.Id, Quantity = 1 }
            }
        };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.CreateOrderAsync(request));
        Assert.True(UnitOfWork.HasRolledBack);
    }

    [Fact]
    public async Task SendOrderToKitchen_ValidOrder_CreatesKitchenTicketsGroupedByStation_CommitsTransaction()
    {
        // Arrange
        var station1 = await SeedKitchenStationAsync(KitchenStationType.NoodleStation, "Bếp Nấu Mì");
        var station2 = await SeedKitchenStationAsync(KitchenStationType.FryGrillStation, "Bếp Nướng Yakitori");

        var cat = await SeedCategoryAsync();
        var ramen = await SeedMenuItemAsync(cat.Id, "RAMEN-K1", "Ramen", 120000m, KitchenStationType.NoodleStation);
        var yakitori = await SeedMenuItemAsync(cat.Id, "YAKI-K1", "Yakitori", 50000m, KitchenStationType.FryGrillStation);

        var order = new Order(OrderType.Takeaway, guestCount: 1, notes: "Giao nhanh");
        order.AddItem(ramen, 2);
        order.AddItem(yakitori, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        int staffUserId = 3;

        // Act
        var success = await _service.SendOrderToKitchenAsync(order.Id, staffUserId);

        // Assert
        Assert.True(success);
        Assert.True(UnitOfWork.HasCommitted);

        // Verify Order transitioned to InPreparation
        var updatedOrder = await Context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == order.Id);
        Assert.NotNull(updatedOrder);
        Assert.Equal(OrderStatus.InPreparation, updatedOrder.Status);
        Assert.All(updatedOrder.Items, i => Assert.Equal(OrderItemStatus.SentToKitchen, i.ItemStatus));

        // Verify KitchenTickets created (grouped into 2 tickets by 2 stations)
        var tickets = await Context.KitchenTickets.Include(k => k.Items).Where(k => k.OrderId == order.Id).ToListAsync();
        Assert.Equal(2, tickets.Count);
    }

    [Fact]
    public async Task SendOrderToKitchen_OrderNotFound_ThrowsNotFoundException_RollsBackTransaction()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.SendOrderToKitchenAsync(99999, 1));
        Assert.True(UnitOfWork.HasRolledBack);
    }

    [Fact]
    public async Task SendOrderToKitchen_InvalidStaffId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.SendOrderToKitchenAsync(1, 0));
        Assert.Contains("Mã nhân viên", ex.Message);
    }

    [Fact]
    public async Task CheckoutOrder_VnPay_GeneratesValidPaymentUrl()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 150000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        // Act
        var paymentUrl = await _service.CheckoutOrderAsync(
            order.Id,
            PaymentGateway.VnPay,
            "127.0.0.1",
            "https://japanfood.vn/payment/callback");

        // Assert
        Assert.NotNull(paymentUrl);
        Assert.StartsWith("https://sandbox.vnpayment.vn", paymentUrl);
        Assert.Contains("vnp_TxnRef=", paymentUrl);

        // Verify payment transaction created
        var txn = await Context.PaymentTransactions.FirstOrDefaultAsync(p => p.OrderId == order.Id);
        Assert.NotNull(txn);
        Assert.Equal(PaymentGateway.VnPay, txn.Gateway);
        Assert.Equal(PaymentTransactionStatus.Pending, txn.Status);
    }

    [Fact]
    public async Task CheckoutOrder_MoMo_GeneratesValidPaymentUrlWithSignature()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 200000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        // Act
        var paymentUrl = await _service.CheckoutOrderAsync(
            order.Id,
            PaymentGateway.MoMo,
            "127.0.0.1",
            "https://japanfood.vn/payment/momo-callback");

        // Assert
        Assert.NotNull(paymentUrl);
        Assert.Contains("txnRef=", paymentUrl);
        Assert.Contains("signature=", paymentUrl);
    }

    [Fact]
    public async Task CheckoutOrder_OrderAlreadyCompleted_ThrowsBusinessException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 100000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        order.SendToKitchen();
        foreach (var item in order.Items)
        {
            item.MarkReady();
            item.MarkServed();
        }
        order.CompleteOrder();
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CheckoutOrderAsync(order.Id, PaymentGateway.VnPay, "127.0.0.1", "returnUrl"));
        Assert.Contains("đã hoàn tất", ex.Message);
    }

    [Fact]
    public async Task CheckoutOrder_OrderCancelled_ThrowsBusinessException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 100000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        order.CancelOrder("Khách đổi ý");
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CheckoutOrderAsync(order.Id, PaymentGateway.VnPay, "127.0.0.1", "returnUrl"));
        Assert.Contains("đã bị hủy", ex.Message);
    }

    [Fact]
    public async Task ProcessPaymentCallback_VnPaySuccess_MarksSuccess_CompletesOrder_ReleasesTable()
    {
        // Arrange
        var area = await SeedAreaAsync();
        var table = await SeedTableAsync(area.Id);
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 150000m);

        var order = new Order(OrderType.DineIn, table.Id);
        order.AddItem(dish, 1);
        order.SendToKitchen();
        foreach (var item in order.Items)
        {
            item.MarkReady();
        }
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        table.Occupy(order.Id, 1);
        var txn = order.AddPaymentTransaction(PaymentGateway.VnPay, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "vnp_TxnRef", txn.TransactionNumber },
            { "vnp_TransactionNo", "VNPAY-12345678" },
            { "vnp_ResponseCode", "00" },
            { "vnp_SecureHash", "VALID_HASH" }
        };

        // Act
        var result = await _service.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, callbackData);

        // Assert
        Assert.True(result);
        Assert.True(UnitOfWork.HasCommitted);

        var updatedTxn = await Context.PaymentTransactions.FirstOrDefaultAsync(p => p.Id == txn.Id);
        Assert.NotNull(updatedTxn);
        Assert.Equal(PaymentTransactionStatus.Success, updatedTxn.Status);
        Assert.Equal("VNPAY-12345678", updatedTxn.GatewayTransactionId);

        var updatedOrder = await Context.Orders.FirstOrDefaultAsync(o => o.Id == order.Id);
        Assert.NotNull(updatedOrder);
        Assert.Equal(OrderStatus.Completed, updatedOrder.Status);

        var updatedTable = await Context.Tables.FirstOrDefaultAsync(t => t.Id == table.Id);
        Assert.NotNull(updatedTable);
        Assert.Equal(TableStatus.Cleaning, updatedTable.Status);
    }

    [Fact]
    public async Task ProcessPaymentCallback_VnPayFailure_MarksFailed_DoesNotCompleteOrder()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 100000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.VnPay, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "vnp_TxnRef", txn.TransactionNumber },
            { "vnp_TransactionNo", "VNPAY-FAILED" },
            { "vnp_ResponseCode", "24" }, // Customer cancelled
            { "vnp_SecureHash", "VALID_HASH" }
        };

        // Act
        var result = await _service.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, callbackData);

        // Assert
        Assert.False(result);
        Assert.True(UnitOfWork.HasCommitted);

        var updatedTxn = await Context.PaymentTransactions.FirstOrDefaultAsync(p => p.Id == txn.Id);
        Assert.NotNull(updatedTxn);
        Assert.Equal(PaymentTransactionStatus.Failed, updatedTxn.Status);

        var updatedOrder = await Context.Orders.FirstOrDefaultAsync(o => o.Id == order.Id);
        Assert.NotNull(updatedOrder);
        Assert.NotEqual(OrderStatus.Completed, updatedOrder.Status);
    }

    [Fact]
    public async Task ProcessPaymentCallback_VnPayInvalidSignature_ThrowsBusinessException()
    {
        // Arrange
        VnPayService.ValidSignature = false;
        var callbackData = new Dictionary<string, string>
        {
            { "vnp_TxnRef", "TXN-123" },
            { "vnp_SecureHash", "INVALID_HASH" }
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, callbackData));
        Assert.Contains("Chữ ký thanh toán không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ProcessPaymentCallback_MoMoSuccess_MarksSuccess_CompletesOrder()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 180000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        order.SendToKitchen();
        foreach (var item in order.Items)
        {
            item.MarkReady();
        }
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.MoMo, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "orderId", txn.TransactionNumber },
            { "transId", "MOMO-999888" },
            { "resultCode", "0" },
            { "signature", "VALID_SIG" },
            { "rawData", "DATA" }
        };

        // Act
        var result = await _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData);

        // Assert
        Assert.True(result);
        Assert.True(UnitOfWork.HasCommitted);

        var updatedTxn = await Context.PaymentTransactions.FirstOrDefaultAsync(p => p.Id == txn.Id);
        Assert.NotNull(updatedTxn);
        Assert.Equal(PaymentTransactionStatus.Success, updatedTxn.Status);
    }

    [Fact]
    public async Task ProcessPaymentCallback_Idempotent_AlreadySuccessfulReturnsTrue()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 100000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.VnPay, order.TotalAmount, "127.0.0.1");
        txn.MarkSuccess("GW-123", "00");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "vnp_TxnRef", txn.TransactionNumber },
            { "vnp_TransactionNo", "GW-123" },
            { "vnp_ResponseCode", "00" },
            { "vnp_SecureHash", "VALID_HASH" }
        };

        // Act
        var result = await _service.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, callbackData);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task CancelOrder_ValidOrder_CancelsOrder_CancelsKitchenTickets_ReleasesTable_CommitsTransaction()
    {
        // Arrange
        var area = await SeedAreaAsync();
        var table = await SeedTableAsync(area.Id);
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 120000m);

        var order = new Order(OrderType.DineIn, table.Id);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        table.Occupy(order.Id, 2);
        var ticket = new KitchenTicket(order.Id, "TKT-01", "T-01");
        ticket.AddItem(order.Items.First().Id, 1, "Dish 1", 1, null);

        Context.KitchenTickets.Add(ticket);
        await Context.SaveChangesAsync();

        int staffUserId = 8;

        // Act
        var success = await _service.CancelOrderAsync(order.Id, "Khách có việc đột xuất", staffUserId);

        // Assert
        Assert.True(success);
        Assert.True(UnitOfWork.HasCommitted);

        var updatedOrder = await Context.Orders.FirstOrDefaultAsync(o => o.Id == order.Id);
        Assert.NotNull(updatedOrder);
        Assert.Equal(OrderStatus.Cancelled, updatedOrder.Status);
        Assert.Contains("Khách có việc đột xuất", updatedOrder.Notes);

        var updatedTicket = await Context.KitchenTickets.FirstOrDefaultAsync(k => k.Id == ticket.Id);
        Assert.NotNull(updatedTicket);
        Assert.Equal(KitchenTicketStatus.Cancelled, updatedTicket.Status);

        var updatedTable = await Context.Tables.FirstOrDefaultAsync(t => t.Id == table.Id);
        Assert.NotNull(updatedTable);
        Assert.Equal(TableStatus.Cleaning, updatedTable.Status);
    }

    [Fact]
    public async Task CancelOrder_CompletedOrder_ThrowsBusinessException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 100000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        order.SendToKitchen();
        foreach (var item in order.Items)
        {
            item.MarkReady();
            item.MarkServed();
        }
        order.CompleteOrder();
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CancelOrderAsync(order.Id, "Lý do", 1));
        Assert.Contains("đã hoàn tất", ex.Message);
    }

    [Fact]
    public async Task CancelOrder_EmptyReason_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CancelOrderAsync(1, "   ", 1));
        Assert.Contains("Lý do hủy đơn hàng không được để trống", ex.Message);
    }

    [Fact]
    public async Task CancelOrder_OrderNotFound_ThrowsNotFoundException_RollsBackTransaction()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.CancelOrderAsync(99999, "Lý do", 1));
        Assert.True(UnitOfWork.HasRolledBack);
    }

    [Fact]
    public async Task ProcessPaymentCallback_MoMoMissingSignature_ThrowsBusinessException()
    {
        // Arrange
        var callbackData = new Dictionary<string, string>
        {
            { "orderId", "TXN-12345" },
            { "transId", "MOMO-999" },
            { "resultCode", "0" },
            { "rawData", "amount=100000&orderId=1" }
            // signature omitted
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData));
        Assert.Contains("Chữ ký MoMo không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ProcessPaymentCallback_MoMoMissingRawData_ThrowsBusinessException()
    {
        // Arrange
        var callbackData = new Dictionary<string, string>
        {
            { "orderId", "TXN-12345" },
            { "transId", "MOMO-999" },
            { "resultCode", "0" },
            { "signature", "VALID_SIG" }
            // rawData omitted
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData));
        Assert.Contains("Chữ ký MoMo không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ProcessPaymentCallback_MoMoInvalidSignature_ThrowsBusinessException()
    {
        // Arrange
        MoMoService.ValidSignature = false;
        var callbackData = new Dictionary<string, string>
        {
            { "orderId", "TXN-12345" },
            { "transId", "MOMO-999" },
            { "resultCode", "0" },
            { "signature", "INVALID_SIG" },
            { "rawData", "DATA" }
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData));
        Assert.Contains("Chữ ký MoMo không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ProcessPaymentCallback_OrderWithPendingItems_TransitionsToServedAndCompletesSuccessfully()
    {
        // Arrange: Items are in Pending state (not sent to kitchen or cooked)
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 150000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 2);
        // Do NOT call order.SendToKitchen() or item.MarkReady()
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.MoMo, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        MoMoService.ValidSignature = true;
        var callbackData = new Dictionary<string, string>
        {
            { "orderId", txn.TransactionNumber },
            { "transId", "MOMO-111222" },
            { "resultCode", "0" },
            { "signature", "VALID_SIG" },
            { "rawData", "DATA" }
        };

        // Act
        var result = await _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData);

        // Assert
        Assert.True(result);
        var updatedOrder = await Context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == order.Id);
        Assert.NotNull(updatedOrder);
        Assert.Equal(OrderStatus.Completed, updatedOrder.Status);
        Assert.All(updatedOrder.Items, i => Assert.Equal(OrderItemStatus.Served, i.ItemStatus));
    }

    [Fact]
    public async Task ProcessPaymentCallback_OrderWithSentToKitchenItems_TransitionsToServedAndCompletesSuccessfully()
    {
        // Arrange: Items are in SentToKitchen state
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 120000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        order.SendToKitchen(); // Items now SentToKitchen
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.MoMo, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        MoMoService.ValidSignature = true;
        var callbackData = new Dictionary<string, string>
        {
            { "orderId", txn.TransactionNumber },
            { "transId", "MOMO-333444" },
            { "resultCode", "0" },
            { "signature", "VALID_SIG" },
            { "rawData", "DATA" }
        };

        // Act
        var result = await _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData);

        // Assert
        Assert.True(result);
        var updatedOrder = await Context.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == order.Id);
        Assert.NotNull(updatedOrder);
        Assert.Equal(OrderStatus.Completed, updatedOrder.Status);
        Assert.All(updatedOrder.Items, i => Assert.Equal(OrderItemStatus.Served, i.ItemStatus));
    }

    [Fact]
    public async Task ProcessPaymentCallback_OrderWithVoucherWhereMinOrderExceedsDiscount_CompletesAndRecordsVoucherUsage()
    {
        // Arrange: Voucher requires MinOrderAmount = 300,000đ, Discount = 50,000đ
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 200000m);
        var voucher = await SeedVoucherAsync("JAPAN50K", DiscountType.FixedAmount, 50000m, minOrderAmount: 300000m, maxDiscount: 50000m);

        var order = new Order(OrderType.Takeaway, userId: user.UserId);
        order.AddItem(dish, 2); // SubTotal = 400,000đ
        order.ApplyVoucher(voucher, 0);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.VnPay, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "vnp_TxnRef", txn.TransactionNumber },
            { "vnp_TransactionNo", "VNPAY-VOUCHER-01" },
            { "vnp_ResponseCode", "00" },
            { "vnp_Amount", ((long)(order.TotalAmount * 100)).ToString() },
            { "vnp_SecureHash", "VALID_HASH" }
        };

        // Act
        var result = await _service.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, callbackData);

        // Assert
        Assert.True(result);
        var updatedVoucher = await Context.Vouchers.FirstOrDefaultAsync(v => v.Id == voucher.Id);
        Assert.NotNull(updatedVoucher);
        Assert.Equal(1, updatedVoucher.UsedCount);
    }

    [Fact]
    public async Task ProcessPaymentCallback_MoMoReplayedCheckoutSignature_ThrowsBusinessException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 150000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.MoMo, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "orderId", txn.TransactionNumber },
            { "transId", "FAKE-123" },
            { "resultCode", "0" },
            { "signature", "VALID_SIG" },
            { "rawData", $"action=checkout&amount={order.TotalAmount}&orderId={order.Id}&txnRef={txn.TransactionNumber}" }
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData));
        Assert.Contains("Chữ ký MoMo không hợp lệ", ex.Message);
    }

    [Fact]
    public async Task ProcessPaymentCallback_VnPayTamperedAmount_ThrowsBusinessException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 200000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.VnPay, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "vnp_TxnRef", txn.TransactionNumber },
            { "vnp_TransactionNo", "VNPAY-TAMPER" },
            { "vnp_ResponseCode", "00" },
            { "vnp_Amount", "100000" }, // Tampered: 1,000 VND instead of 216,000 VND
            { "vnp_SecureHash", "VALID_HASH" }
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            _service.ProcessPaymentCallbackAsync(PaymentGateway.VnPay, callbackData));
        Assert.Contains("Số tiền thanh toán VNPAY không khớp", ex.Message);
    }

    [Fact]
    public async Task ProcessPaymentCallback_CrossGatewaySpoofing_ThrowsBusinessException()
    {
        // Arrange: Transaction initiated as VnPay, attacker tries to confirm via MoMo
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 150000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1);
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var txn = order.AddPaymentTransaction(PaymentGateway.VnPay, order.TotalAmount, "127.0.0.1");
        await Context.SaveChangesAsync();

        var callbackData = new Dictionary<string, string>
        {
            { "orderId", txn.TransactionNumber },
            { "transId", "MOMO-SPOOF" },
            { "resultCode", "0" },
            { "signature", "VALID_SIG" },
            { "rawData", "DATA" }
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            _service.ProcessPaymentCallbackAsync(PaymentGateway.MoMo, callbackData));
        Assert.Contains("Cổng thanh toán không khớp", ex.Message);
    }
}
