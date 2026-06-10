using APIAuth.Services.Common;
using Application.DTOs.Content;
using Application.DTOs.Ordering;
using Application.DTOs.Reservations;
using Application.Services;
using Domain.Entities;
using Domain.Entities.Content;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.TableManagement;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class PosKdsWorkflowTests : TestApplicationBase
{
    private readonly WifiConfigService _wifiConfigService;
    private readonly TableReservationService _tableReservationService;
    private readonly OrderService _orderService;
    private readonly KitchenService _kitchenService;

    public PosKdsWorkflowTests()
    {
        _wifiConfigService = new WifiConfigService(UnitOfWork, ValidationFactory, NullLogger<WifiConfigService>.Instance);
        _tableReservationService = new TableReservationService(UnitOfWork, ReservationQueryRepo, ValidationFactory, EmailService, NullLogger<TableReservationService>.Instance);
        _orderService = new OrderService(UnitOfWork, OrderQueryRepo, ValidationFactory, VnPayService, MoMoService, NullLogger<OrderService>.Instance, MenuQueryRepo, VoucherQueryRepo, InventoryQueryRepo);
        _kitchenService = new KitchenService(UnitOfWork, KitchenQueryRepo, NullLogger<KitchenService>.Instance);
    }

    [Fact]
    public async Task WifiConfig_AdminCRUD_And_NetworkValidation_WorksCorrectly()
    {
        // Arrange
        var branch = new Branch("HN01", "Chi nhánh Hà Nội", "123 Phố Huế", "Hai Bà Trưng", "Hà Nội", "0901234567");
        await Context.Branches.AddAsync(branch);
        await Context.SaveChangesAsync();

        // Act 1: Admin tạo cấu hình WiFi
        var createRequest = new CreateBranchWifiConfigRequestDto
        {
            BranchId = branch.Id,
            Ssid = "JapanFood_Guest_5G",
            PublicIpSubnet = "14.161.20.",
            Description = "WiFi phòng ăn tầng 1",
            IsActive = true
        };
        var created = await _wifiConfigService.CreateConfigAsync(createRequest, 1);

        // Assert 1
        Assert.NotNull(created);
        Assert.Equal("JapanFood_Guest_5G", created.Ssid);

        // Act 2: Khách đối soát WiFi đúng SSID -> Hợp lệ
        var isAllowedSsid = await _wifiConfigService.IsNetworkAllowedAsync(branch.Id, "JapanFood_Guest_5G", "192.168.1.100");
        Assert.True(isAllowedSsid);

        // Act 3: Khách đối soát WiFi đúng IP Subnet -> Hợp lệ
        var isAllowedIp = await _wifiConfigService.IsNetworkAllowedAsync(branch.Id, "KhongDungSSID", "14.161.20.45");
        Assert.True(isAllowedIp);

        // Act 4: Khách dùng 4G ngoài quán với IP lạ và SSID sai -> Bị chặn
        var isDenied = await _wifiConfigService.IsNetworkAllowedAsync(branch.Id, "WiFi_Nha_Hang_Xom", "113.190.50.12");
        Assert.False(isDenied);

        // Act 5: Admin cập nhật WiFi
        var updateRequest = new UpdateBranchWifiConfigRequestDto
        {
            Ssid = "JapanFood_VIP_HighSpeed",
            PublicIpSubnet = "14.161.20.",
            Description = "Đổi tên WiFi phòng VIP",
            IsActive = true
        };
        var updated = await _wifiConfigService.UpdateConfigAsync(created.Id, updateRequest, 1);
        Assert.Equal("JapanFood_VIP_HighSpeed", updated.Ssid);

        // Act 6: Admin tắt WiFi
        await _wifiConfigService.ToggleActiveAsync(created.Id, false, 1);
        var configs = await _wifiConfigService.GetConfigsByBranchAsync(branch.Id);
        Assert.False(configs.First().IsActive);
    }

    [Fact]
    public async Task OpenTable_ForEmptyTable_CreatesOrder_And_GeneratesSessionToken()
    {
        // Arrange
        await SeedOpenShiftAsync();
        var area = new TableArea("T1", "Tầng 1");
        await Context.TableAreas.AddAsync(area);
        await Context.SaveChangesAsync();

        var table = new Table(area.Id, "T1-01", 4, 1);
        await Context.Tables.AddAsync(table);
        await Context.SaveChangesAsync();

        // Act: Phục vụ mở bàn
        var response = await _tableReservationService.OpenTableAsync(table.Id, new OpenTableRequestDto
        {
            GuestCount = 3,
            Notes = "Khách yêu cầu nước lọc trước"
        }, 1);

        // Assert
        Assert.NotNull(response);
        Assert.Equal("T1-01", response.TableNumber);
        Assert.NotEmpty(response.SessionToken);
        Assert.Contains(response.SessionToken, response.OrderQrUrl);

        var refreshedTable = await Context.Tables.FindAsync(table.Id);
        Assert.Equal(TableStatus.Serving, refreshedTable!.Status);
        Assert.NotNull(refreshedTable.CurrentOrderId);

        // Mở lại bàn đã Serving phải ném ngoại lệ
        await Assert.ThrowsAsync<BusinessException>(() =>
            _tableReservationService.OpenTableAsync(table.Id, new OpenTableRequestDto { GuestCount = 2 }, 1));
    }

    [Fact]
    public async Task OnlineOrder_PosApprove_SendsToKitchen_And_CompletionSetsReadyForDispatch()
    {
        // Arrange
        var category = new Category("RAMEN", "Mì Ramen");
        await Context.Categories.AddAsync(category);
        await Context.SaveChangesAsync();

        var menuItem = new MenuItem(category.Id, "RAMEN-SHOYU", "Ramen Shoyu", 120000m, kitchenStation: KitchenStationType.NoodleStation);
        await Context.MenuItems.AddAsync(menuItem);

        var station = new KitchenStation("Trạm Mì", KitchenStationType.NoodleStation);
        await Context.KitchenStations.AddAsync(station);
        await Context.SaveChangesAsync();

        // 1. Khách đặt đơn Takeaway online
        var createOrderRequest = new CreateOrderRequestDto
        {
            OrderType = OrderType.Takeaway,
            RecipientName = "Nguyễn Văn A",
            RecipientPhone = "0987654321",
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = menuItem.Id, Quantity = 2 }
            }
        };
        var createdOrder = await _orderService.CreateOrderAsync(createOrderRequest);
        Assert.NotNull(createdOrder);

        // 2. POS tra cứu danh sách đơn Online chờ duyệt
        var pendingOrders = await _orderService.GetPendingOnlineOrdersAsync();
        Assert.Contains(pendingOrders, o => o.OrderId == createdOrder.OrderId);

        // 3. POS duyệt đơn online
        var approved = await _orderService.ApproveOnlineOrderAsync(new ApproveOnlineOrderRequestDto
        {
            OrderId = createdOrder.OrderId,
            EstimatedPrepMinutes = 15
        }, 1);
        Assert.True(approved);

        // Đơn đã bắn xuống bếp: kiểm tra KitchenTicket
        var kitchenTickets = await Context.KitchenTickets
            .Include(t => t.Items)
            .Where(t => t.OrderId == createdOrder.OrderId)
            .ToListAsync();
        Assert.NotEmpty(kitchenTickets);
        var ticketItem = kitchenTickets.First().Items.First();

        // 4. Bếp nhận món và nấu xong
        await _kitchenService.StartCookingItemAsync(ticketItem.Id, 2);
        await _kitchenService.MarkItemReadyAsync(ticketItem.Id, 2);

        // 5. Kiểm tra đơn hàng tự động chuyển sang ReadyForDispatch
        var refreshedOrder = await Context.Orders.FindAsync(createdOrder.OrderId);
        Assert.Equal(OrderStatus.ReadyForDispatch, refreshedOrder!.Status);

        // POS thấy đơn trong danh sách chờ xuất đi giao
        var readyOrders = await _orderService.GetOrdersReadyForDispatchAsync();
        Assert.Contains(readyOrders, o => o.OrderId == createdOrder.OrderId);

        // 6. Thu ngân bấm xuất đơn cho shipper
        var dispatched = await _orderService.DispatchOnlineOrderAsync(createdOrder.OrderId, 1);
        Assert.True(dispatched);
        Assert.Equal(OrderStatus.Served, (await Context.Orders.FindAsync(createdOrder.OrderId))!.Status);
    }

    [Fact]
    public async Task CashPayment_CalculatesCorrectChange_And_AwardsLoyaltyPoints()
    {
        // Arrange
        await SeedOpenShiftAsync();
        var user = new User
        {
            FullName = "Khách VIP",
            Email = "vip@japanfood.vn",
            PhoneNumber = "0911222333",
            PasswordHash = "hash",
            LoyaltyPoints = 40,
            MembershipTier = "BRONZE"
        };
        await Context.Users.AddAsync(user);

        var area = new TableArea("T1", "Tầng 1");
        await Context.TableAreas.AddAsync(area);
        await Context.SaveChangesAsync();

        var table = new Table(area.Id, "T1-05", 4, 1);
        await Context.Tables.AddAsync(table);
        await Context.SaveChangesAsync();

        var category = new Category("DRINK", "Đồ uống");
        await Context.Categories.AddAsync(category);
        await Context.SaveChangesAsync();

        var dish = new MenuItem(category.Id, "SAKE-01", "Rượu Sake", 250000m, kitchenStation: KitchenStationType.BeverageStation);
        await Context.MenuItems.AddAsync(dish);
        await Context.SaveChangesAsync();

        var openTable = await _tableReservationService.OpenTableAsync(table.Id, new OpenTableRequestDto { GuestCount = 2 }, 1);

        // Thêm món vào đơn: 250,000đ + 8% VAT = 270,000đ
        await _orderService.AddItemsToOrderAsync(new AddOrderItemsRequestDto
        {
            OrderId = openTable.OrderId,
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish.Id, Quantity = 1 }
            },
            SendDirectlyToKitchen = true
        }, 1);

        var order = await Context.Orders.FindAsync(openTable.OrderId);
        var expectedTotal = order!.TotalAmount; // 270,000đ

        // Khách đưa 500,000đ
        var cashRequest = new ConfirmCashPaymentRequestDto
        {
            OrderId = order.Id,
            AmountGiven = 500000m,
            CustomerPhone = "0911222333"
        };

        // Act: Thu ngân bấm xác nhận tiền mặt
        var result = await _orderService.ConfirmCashPaymentWithChangeAsync(cashRequest, 1);

        // Assert
        Assert.True(result.Success);
        Assert.Equal(expectedTotal, result.TotalAmount);
        Assert.Equal(500000m, result.AmountGiven);
        Assert.Equal(OrderService.RoundCashChange(500000m - expectedTotal), result.ChangeAmount);
        Assert.True(result.LoyaltyPointsEarned > 0);

        // Kiểm tra User được nâng hạng thẻ (40 + 27 = 67 điểm -> SILVER)
        var refreshedUser = await Context.Users.FindAsync(user.UserId);
        Assert.Equal("SILVER", refreshedUser!.MembershipTier);

        // Bàn chuyển sang Cleaning
        var refreshedTable = await Context.Tables.FindAsync(table.Id);
        Assert.Equal(TableStatus.Cleaning, refreshedTable!.Status);
    }

    [Theory]
    [InlineData(22700, 22000)] // Lẻ 700đ <= 700đ: làm tròn xuống 22.000đ
    [InlineData(22701, 23000)] // Lẻ 701đ > 700đ: làm tròn lên 23.000đ
    [InlineData(1058400, 1058000)] // Lẻ 400đ <= 700đ: làm tròn xuống 1.058.000đ
    [InlineData(1058700, 1058000)] // Lẻ 700đ <= 700đ: làm tròn xuống 1.058.000đ
    [InlineData(1058750, 1059000)] // Lẻ 750đ > 700đ: làm tròn lên 1.059.000đ
    [InlineData(50000, 50000)]     // Không có phần lẻ
    public void RoundBillAmount_FollowsBusinessRule(decimal rawBill, decimal expectedRounded)
    {
        var actual = OrderService.RoundBillAmount(rawBill);
        Assert.Equal(expectedRounded, actual);
    }

    [Theory]
    [InlineData(30000, 22700, 8000)] // Hóa đơn 22.700đ làm tròn 22.000đ, khách đưa 30.000đ thối 8.000đ
    [InlineData(30000, 22701, 7000)] // Hóa đơn 22.701đ làm tròn 23.000đ, khách đưa 30.000đ thối 7.000đ
    [InlineData(2000000, 1058400, 942000)] // Hóa đơn 1.058.400đ làm tròn 1.058.000đ, khách đưa 2.000.000đ thối 942.000đ
    public void CashPayment_ChangeAmountMatchesUserRule(decimal amountGiven, decimal billAmount, decimal expectedChange)
    {
        var roundedBill = OrderService.RoundBillAmount(billAmount);
        var change = amountGiven - roundedBill;
        Assert.Equal(expectedChange, change);
        Assert.Equal(expectedChange, OrderService.RoundCashChange(amountGiven - billAmount));
    }

    [Fact]
    public async Task CashPayment_WhenAmountGivenIsInsufficient_ThrowsBusinessException()
    {
        // Arrange
        await SeedOpenShiftAsync();
        var area = new TableArea("T1", "Tầng 1");
        await Context.TableAreas.AddAsync(area);
        await Context.SaveChangesAsync();

        var table = new Table(area.Id, "T1-09", 2, 1);
        await Context.Tables.AddAsync(table);
        await Context.SaveChangesAsync();

        var openTable = await _tableReservationService.OpenTableAsync(table.Id, new OpenTableRequestDto { GuestCount = 2 }, 1);

        var category = new Category("MISO", "Súp");
        await Context.Categories.AddAsync(category);
        await Context.SaveChangesAsync();

        var dish = new MenuItem(category.Id, "MISO-01", "Súp Miso", 50000m, kitchenStation: KitchenStationType.NoodleStation);
        await Context.MenuItems.AddAsync(dish);
        await Context.SaveChangesAsync();

        await _orderService.AddItemsToOrderAsync(new AddOrderItemsRequestDto
        {
            OrderId = openTable.OrderId,
            Items = new List<CreateOrderItemDto> { new() { MenuItemId = dish.Id, Quantity = 2 } },
            SendDirectlyToKitchen = false
        }, 1);

        // Hóa đơn 100,000đ + VAT = 108,000đ nhưng khách đưa chỉ 50,000đ
        var cashRequest = new ConfirmCashPaymentRequestDto
        {
            OrderId = openTable.OrderId,
            AmountGiven = 50000m
        };

        // Act & Assert
        await Assert.ThrowsAsync<BusinessException>(() =>
            _orderService.ConfirmCashPaymentWithChangeAsync(cashRequest, 1));
    }

    [Fact]
    public async Task PosControl_AddItems_CancelItem_And_SplitOrder_WorksProperly()
    {
        // Arrange
        await SeedOpenShiftAsync();
        var area = new TableArea("T1", "Tầng 1");
        await Context.TableAreas.AddAsync(area);
        await Context.SaveChangesAsync();

        var tableSource = new Table(area.Id, "T1-03", 4, 1);
        var tableTarget = new Table(area.Id, "T1-04", 4, 1);
        await Context.Tables.AddRangeAsync(tableSource, tableTarget);
        await Context.SaveChangesAsync();

        var category = new Category("GRILL", "Đồ nướng");
        await Context.Categories.AddAsync(category);
        await Context.SaveChangesAsync();

        var dish1 = new MenuItem(category.Id, "WAGYU-01", "Bò Wagyu", 350000m, kitchenStation: KitchenStationType.FryGrillStation);
        var dish2 = new MenuItem(category.Id, "TERI-01", "Gà Teriyaki", 150000m, kitchenStation: KitchenStationType.FryGrillStation);
        await Context.MenuItems.AddRangeAsync(dish1, dish2);

        var station = new KitchenStation("Trạm Nướng", KitchenStationType.FryGrillStation);
        await Context.KitchenStations.AddAsync(station);
        await Context.SaveChangesAsync();

        var openTable = await _tableReservationService.OpenTableAsync(tableSource.Id, new OpenTableRequestDto { GuestCount = 4 }, 1);

        // 1. POS thêm món vào bàn
        var orderDetail = await _orderService.AddItemsToOrderAsync(new AddOrderItemsRequestDto
        {
            OrderId = openTable.OrderId,
            Items = new List<CreateOrderItemDto>
            {
                new() { MenuItemId = dish1.Id, Quantity = 1 },
                new() { MenuItemId = dish2.Id, Quantity = 2 }
            },
            SendDirectlyToKitchen = true
        }, 1);

        Assert.Equal(2, orderDetail.Items.Count);

        // 2. POS hủy 1 món (Bò Wagyu)
        var wagyuItem = orderDetail.Items.First(i => i.MenuItemId == dish1.Id);
        var cancelled = await _orderService.CancelOrderItemAsync(new CancelOrderItemRequestDto
        {
            OrderId = openTable.OrderId,
            OrderItemId = wagyuItem.OrderItemId,
            Reason = "Khách đổi ý không ăn bò"
        }, 1);
        Assert.True(cancelled);

        // 3. POS tách bàn (chuyển món Gà Teriyaki sang bàn T1-04)
        var teriItem = orderDetail.Items.First(i => i.MenuItemId == dish2.Id);
        var split = await _orderService.SplitOrderAsync(new SplitOrderRequestDto
        {
            SourceOrderId = openTable.OrderId,
            TargetTableId = tableTarget.Id,
            OrderItemIds = new List<int> { teriItem.OrderItemId },
            Notes = "Tách món cho bạn bè ngồi bàn khác"
        }, 1);
        Assert.True(split);

        // Bàn đích T1-04 tự động được mở và chiếm món
        var refreshedTargetTable = await Context.Tables.Include(t => t.CurrentOrder).FirstOrDefaultAsync(t => t.Id == tableTarget.Id);
        Assert.Equal(TableStatus.Serving, refreshedTargetTable!.Status);
        Assert.NotNull(refreshedTargetTable.CurrentOrder);
    }

    [Fact]
    public async Task TableQrSession_DynamicSingleUseToken_PreventsOldTokenReuseAndMaliciousOrders()
    {
        // 1. Arrange môi trường
        await SeedOpenShiftAsync();
        var area = new TableArea("VIP", "Khu VIP");
        await Context.TableAreas.AddAsync(area);

        var category = new Category("SASHIMI", "Sashimi tươi sống");
        await Context.Categories.AddAsync(category);

        var dish = new MenuItem(category.Id, "SA-SALMON", "Sashimi Cá Hồi", 180000m, kitchenStation: KitchenStationType.ColdDessertStation);
        await Context.MenuItems.AddAsync(dish);

        var station = new KitchenStation("Trạm Lạnh", KitchenStationType.ColdDessertStation);
        await Context.KitchenStations.AddAsync(station);

        var table = new Table(area.Id, "VIP-01", 4, 1);
        await Context.Tables.AddAsync(table);
        await Context.SaveChangesAsync();

        // 2. Lượt khách 1 vào bàn: Thu ngân mở bàn và cấp Dynamic Session QR kèm mã PIN
        var guest1Open = await _tableReservationService.OpenTableAsync(table.Id, new OpenTableRequestDto { GuestCount = 2 }, 1);
        var tokenGuest1 = guest1Open.SessionToken;
        var pinGuest1 = guest1Open.PinCode;
        Assert.NotEmpty(tokenGuest1);
        Assert.NotEmpty(pinGuest1);

        // a) Lượt khách 1 dùng đúng token để gọi món -> Thành công
        var orderResult1 = await _orderService.CreateQrTableOrderAsync(new TableQrOrderRequestDto
        {
            TableId = table.Id,
            Token = tokenGuest1,
            Items = new List<CreateOrderItemDto>
            {
                new CreateOrderItemDto { MenuItemId = dish.Id, Quantity = 2 }
            }
        }, "127.0.0.1");

        Assert.Equal("VIP-01", orderResult1.TableNumber);
        Assert.Equal(2, orderResult1.ItemsCount);

        // b) Kẻ xấu thử gọi món với mã Token giả / không hợp lệ -> Bị chặn 403 Forbidden
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            _orderService.CreateQrTableOrderAsync(new TableQrOrderRequestDto
            {
                TableId = table.Id,
                Token = "fake_or_stolen_token",
                Items = new List<CreateOrderItemDto>
                {
                    new CreateOrderItemDto { MenuItemId = dish.Id, Quantity = 5 }
                }
            }, "127.0.0.1"));

        // c) Xác thực mạng bằng PIN đúng -> Thành công
        var verifyWithPin = await _tableReservationService.VerifyTableNetworkAsync(new VerifyTableNetworkRequestDto
        {
            TableId = table.Id,
            PinCode = pinGuest1
        }, "127.0.0.1");
        Assert.True(verifyWithPin.IsAllowed);
        Assert.False(verifyWithPin.RequiresPin);
        Assert.Equal(tokenGuest1, verifyWithPin.SessionToken);

        // d) Xác thực mạng bằng PIN sai hoặc Token sai -> Bị từ chối
        var verifyWrongPin = await _tableReservationService.VerifyTableNetworkAsync(new VerifyTableNetworkRequestDto
        {
            TableId = table.Id,
            PinCode = "9999"
        }, "127.0.0.1");
        Assert.False(verifyWrongPin.IsAllowed);
        Assert.True(verifyWrongPin.RequiresPin);

        // 3. Khách 1 thanh toán xong tiền mặt và rời quán
        var paymentResult = await _orderService.ConfirmCashPaymentWithChangeAsync(new ConfirmCashPaymentRequestDto
        {
            OrderId = guest1Open.OrderId,
            AmountGiven = 500000m
        }, 1);
        Assert.True(paymentResult.Success);

        // Bàn chuyển sang Cleaning và SessionToken bị xóa sạch (ClearSessionPin)
        var tableAfterPay = await Context.Tables.FindAsync(table.Id);
        Assert.Equal(TableStatus.Cleaning, tableAfterPay!.Status);
        Assert.Null(tableAfterPay.SessionToken);
        Assert.Null(tableAfterPay.PinCode);

        // Khách 1 hoặc người lạ cố tình dùng token cũ của Khách 1 để gọi món -> Bị chặn
        await Assert.ThrowsAsync<BusinessException>(() =>
            _orderService.CreateQrTableOrderAsync(new TableQrOrderRequestDto
            {
                TableId = table.Id,
                Token = tokenGuest1,
                Items = new List<CreateOrderItemDto>
                {
                    new CreateOrderItemDto { MenuItemId = dish.Id, Quantity = 1 }
                }
            }, "127.0.0.1"));

        // 4. Nhân viên dọn bàn hoàn tất và Bàn đón Lượt khách 2
        await _tableReservationService.CompleteCleaningAsync(table.Id, 1);

        var guest2Open = await _tableReservationService.OpenTableAsync(table.Id, new OpenTableRequestDto { GuestCount = 3 }, 1);
        var tokenGuest2 = guest2Open.SessionToken;
        Assert.NotEqual(tokenGuest1, tokenGuest2); // Token mới hoàn toàn khác token cũ

        // Khách cũ (Khách 1) dùng token cũ của mình để gọi món vào bàn -> BỊ CHẶN BỞI TOKEN KHÔNG KHỚP
        var exOldToken = await Assert.ThrowsAsync<ForbiddenException>(() =>
            _orderService.CreateQrTableOrderAsync(new TableQrOrderRequestDto
            {
                TableId = table.Id,
                Token = tokenGuest1, // Token cũ của lượt khách trước
                Items = new List<CreateOrderItemDto>
                {
                    new CreateOrderItemDto { MenuItemId = dish.Id, Quantity = 10 }
                }
            }, "127.0.0.1"));
        Assert.Contains("hết hạn từ lượt khách trước", exOldToken.Message);

        // Khách mới (Khách 2) dùng token mới của mình -> Đặt món thành công
        var orderResult2 = await _orderService.CreateQrTableOrderAsync(new TableQrOrderRequestDto
        {
            TableId = table.Id,
            Token = tokenGuest2,
            Items = new List<CreateOrderItemDto>
            {
                new CreateOrderItemDto { MenuItemId = dish.Id, Quantity = 1 }
            }
        }, "127.0.0.1");

        Assert.Equal(1, orderResult2.ItemsCount);
    }
}
