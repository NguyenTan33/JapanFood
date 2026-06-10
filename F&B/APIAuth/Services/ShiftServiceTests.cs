using APIAuth.Services.Common;
using Application.DTOs.Operations;
using Application.DTOs.Ordering;
using Application.DTOs.Reservations;
using Application.Interfaces.Storage;
using Application.Services;
using Domain.Constants;
using Domain.Entities;
using Domain.Entities.Menu;
using Domain.Entities.Payment;
using Domain.Entities.Reservations;
using Domain.Exceptions;
using Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class ShiftServiceTests : TestApplicationBase
{
    private readonly ShiftQueryRepository _shiftQueryRepo;
    private readonly ShiftService _shiftService;
    private readonly TableReservationService _reservationService;
    private readonly OrderService _orderService;

    public ShiftServiceTests()
    {
        _shiftQueryRepo = new ShiftQueryRepository(Context);
        _shiftService = new ShiftService(
            UnitOfWork,
            _shiftQueryRepo,
            FileStorageService,
            ValidationFactory,
            NullLogger<ShiftService>.Instance);
        _reservationService = new TableReservationService(
            UnitOfWork,
            ReservationQueryRepo,
            ValidationFactory,
            EmailService,
            NullLogger<TableReservationService>.Instance);
        _orderService = new OrderService(
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
    public async Task OpenAndCloseShift_TracksSalesWithdrawalsAndVarianceAccurately()
    {
        var staff = new User { FullName = "Thu Ngân A", Email = "cashier@jf.vn", PhoneNumber = "+84901000001", PasswordHash = "h", Role = AppRoles.Staff, AccountStatus = "ACTIVE" };
        var admin = new User { FullName = "Chủ Quán", Email = "owner@jf.vn", PhoneNumber = "+84901000002", PasswordHash = "h", Role = AppRoles.Admin, AccountStatus = "ACTIVE" };
        Context.Users.AddRange(staff, admin);
        await Context.SaveChangesAsync();

        var initial = await _shiftQueryRepo.GetCurrentShiftAsync();
        Assert.False(initial.HasOpenShift);
        Assert.Null(initial.Shift);

        var opened = await _shiftService.OpenShiftAsync(new OpenShiftRequestDto { OpeningCash = 1000000m, Notes = "Ca chiều" }, staff.UserId);
        Assert.Equal("Open", opened.Status);
        Assert.Equal(1000000m, opened.OpeningCash);
        Assert.Equal(1000000m, opened.CurrentRemainingCash);
        Assert.Equal("Thu Ngân A", opened.OpenedByName);

        // Cannot open a second shift while one is open
        await Assert.ThrowsAsync<ConflictException>(() =>
            _shiftService.OpenShiftAsync(new OpenShiftRequestDto { OpeningCash = 500000m }, staff.UserId));

        // Seed cash + transfer payments in this shift
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-S1", "Ramen", 200000m);
        var order = new Order(OrderType.Takeaway);
        order.AddItem(dish, 1); // 200,000 + 8% VAT = 216,000
        Context.Orders.Add(order);
        await Context.SaveChangesAsync();

        var cashRes = await _orderService.ConfirmCashPaymentWithChangeAsync(new ConfirmCashPaymentRequestDto
        {
            OrderId = order.Id,
            AmountGiven = 300000m
        }, staff.UserId);
        Assert.True(cashRes.Success);

        // Owner withdraws 400,000 with photo
        using var photoStream = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 });
        var afterWithdraw = await _shiftService.WithdrawFromCurrentShiftAsync(
            400000m, "Thu két buổi tối", photoStream, "proof.jpg", admin.UserId);

        Assert.Equal(216000m, afterWithdraw.CashSalesTotal);
        Assert.Equal(400000m, afterWithdraw.TotalWithdrawn);
        // 1,000,000 + 216,000 - 400,000 = 816,000
        Assert.Equal(816000m, afterWithdraw.CurrentRemainingCash);
        Assert.Single(afterWithdraw.Withdrawals);
        Assert.Equal("Chủ Quán", afterWithdraw.Withdrawals[0].WithdrawnByName);

        // Withdrawal exceeding remaining cash throws BusinessException
        using var excessStream = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 });
        var excessEx = await Assert.ThrowsAsync<BusinessException>(() =>
            _shiftService.WithdrawFromCurrentShiftAsync(900000m, null, excessStream, "excess.jpg", admin.UserId));
        Assert.Contains("vượt quá số tiền mặt hiện có trong két", excessEx.Message);

        // Close shift with actual cash 800,000 (variance = -16,000)
        var closed = await _shiftService.CloseShiftAsync(new CloseShiftRequestDto { ActualCash = 800000m, Notes = "Đóng ca" }, staff.UserId);
        Assert.Equal("Closed", closed.Status);
        Assert.Equal(816000m, closed.ExpectedCash);
        Assert.Equal(800000m, closed.ClosingActualCash);
        Assert.Equal(-16000m, closed.VarianceAmount);

        var currentAfterClose = await _shiftQueryRepo.GetCurrentShiftAsync();
        Assert.False(currentAfterClose.HasOpenShift);

        var history = await _shiftQueryRepo.GetShiftsAsync(DateTime.UtcNow.Date, DateTime.UtcNow.Date);
        Assert.Equal(1, history.TotalCount);
    }

    [Fact]
    public async Task Withdraw_WhenSaveFails_DeletesOrphanedUploadedPhoto()
    {
        var admin = await SeedUserAsync("Admin", "adm@jf.vn", "+84901112233");
        await SeedOpenShiftAsync(admin.UserId, 1000000m);

        var trackingStorage = new TrackingFileStorageService();
        var failingUow = new FailingSaveUnitOfWork(Context);
        var failingService = new ShiftService(
            failingUow,
            _shiftQueryRepo,
            trackingStorage,
            ValidationFactory,
            NullLogger<ShiftService>.Instance);

        using var photoStream = new MemoryStream(new byte[] { 1, 2, 3, 4 });
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            failingService.WithdrawFromCurrentShiftAsync(100000m, "test", photoStream, "proof.png", admin.UserId));

        Assert.Single(trackingStorage.SavedFiles);
        Assert.Equal(trackingStorage.SavedFiles[0], Assert.Single(trackingStorage.DeletedFiles));
    }

    [Fact]
    public async Task MandatoryOpenShiftGate_BlocksOpenTableCheckInDineInOrderAndCash_AllowsTakeaway()
    {
        var area = await SeedAreaAsync();
        var table = await SeedTableAsync(area.Id, "T-GATE", 4, 1);
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "SUSHI-GATE", "Nigiri", 100000m);

        var reservation = new Reservation("Guest", "0901234567", null, 2, DateTime.UtcNow.Date.AddDays(1).Add(new TimeSpan(18, 30, 0)));
        reservation.AssignTable(table.Id);
        reservation.Confirm(1);
        Context.Reservations.Add(reservation);

        var existingOrder = new Order(OrderType.Takeaway);
        existingOrder.AddItem(dish, 1);
        Context.Orders.Add(existingOrder);
        await Context.SaveChangesAsync();

        // 1. OpenTableAsync blocked
        var openEx = await Assert.ThrowsAsync<BusinessException>(() =>
            _reservationService.OpenTableAsync(table.Id, new OpenTableRequestDto { GuestCount = 2 }, 1));
        Assert.Equal("Vui lòng mở ca trực trước khi mở bàn hoặc thu tiền.", openEx.Message);

        // 2. CheckInGuestAsync blocked
        var checkInEx = await Assert.ThrowsAsync<BusinessException>(() =>
            _reservationService.CheckInGuestAsync(reservation.Id, 1));
        Assert.Equal("Vui lòng mở ca trực trước khi mở bàn hoặc thu tiền.", checkInEx.Message);

        // 3. DineIn CreateOrderAsync blocked
        var dineInEx = await Assert.ThrowsAsync<BusinessException>(() =>
            _orderService.CreateOrderAsync(new CreateOrderRequestDto
            {
                OrderType = OrderType.DineIn,
                TableId = table.Id,
                GuestCount = 2,
                Items = [new CreateOrderItemDto { MenuItemId = dish.Id, Quantity = 1 }]
            }));
        Assert.Equal("Vui lòng mở ca trực trước khi mở bàn hoặc thu tiền.", dineInEx.Message);

        // 4. ConfirmCashPaymentWithChangeAsync blocked
        var cashEx = await Assert.ThrowsAsync<BusinessException>(() =>
            _orderService.ConfirmCashPaymentWithChangeAsync(new ConfirmCashPaymentRequestDto
            {
                OrderId = existingOrder.Id,
                AmountGiven = 200000m
            }, 1));
        Assert.Equal("Vui lòng mở ca trực trước khi mở bàn hoặc thu tiền.", cashEx.Message);

        // 5. CheckoutOrderAsync(Cash) blocked
        var checkoutEx = await Assert.ThrowsAsync<BusinessException>(() =>
            _orderService.CheckoutOrderAsync(existingOrder.Id, PaymentGateway.Cash, "127.0.0.1", "http://localhost"));
        Assert.Equal("Vui lòng mở ca trực trước khi mở bàn hoặc thu tiền.", checkoutEx.Message);

        // 6. Takeaway online order STILL allowed without an open shift
        var takeaway = await _orderService.CreateOrderAsync(new CreateOrderRequestDto
        {
            OrderType = OrderType.Takeaway,
            GuestCount = 1,
            Items = [new CreateOrderItemDto { MenuItemId = dish.Id, Quantity = 1 }]
        });
        Assert.NotNull(takeaway);
    }

    private sealed class TrackingFileStorageService : IFileStorageService
    {
        public List<string> SavedFiles { get; } = new();
        public List<string> DeletedFiles { get; } = new();

        public Task<string> SaveFileAsync(Stream fileStream, string originalFileName, string subFolder, CancellationToken ct = default)
        {
            var path = $"/uploads/{subFolder}/{Guid.NewGuid():N}{Path.GetExtension(originalFileName)}";
            SavedFiles.Add(path);
            return Task.FromResult(path);
        }

        public Task<bool> DeleteFileAsync(string relativePath, CancellationToken ct = default)
        {
            DeletedFiles.Add(relativePath);
            return Task.FromResult(true);
        }
    }

    private sealed class FailingSaveUnitOfWork : Application.Interfaces.IUnitOfWork
    {
        public FailingSaveUnitOfWork(Infrastructure.Data.JapanFoodDbContext context) => Context = context;
        public Application.Interfaces.IJapanFoodDbContext Context { get; }
        public Task<int> SaveChangesAsync(CancellationToken ct = default) => throw new InvalidOperationException("Simulated DB failure");
        public Task<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction> BeginTransactionAsync(CancellationToken ct = default) => Task.FromResult<Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction>(new DummyTx());
        public Task CommitTransactionAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task RollbackTransactionAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Dispose() { }

        private sealed class DummyTx : Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction
        {
            public Guid TransactionId => Guid.NewGuid();
            public void Commit() { }
            public Task CommitAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
            public void Dispose() { }
            public ValueTask DisposeAsync() => ValueTask.CompletedTask;
            public void Rollback() { }
            public Task RollbackAsync(CancellationToken cancellationToken = default) => Task.CompletedTask;
        }
    }
}
