using Application.Common.Validation;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Services;
using Domain.Entities;
using Domain.Entities.Inventory;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.Operations;
using Domain.Entities.TableManagement;
using Domain.Entities.Vouchers;
using Infrastructure.Data;
using Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace APIAuth.Services.Common;

public abstract class TestApplicationBase : IDisposable
{
    protected readonly JapanFoodDbContext Context;
    protected readonly TestUnitOfWork UnitOfWork;
    protected readonly IValidationFactory ValidationFactory;
    protected readonly TestEmailService EmailService;
    protected readonly TestVnPayService VnPayService;
    protected readonly TestMoMoService MoMoService;
    protected readonly TestFileStorageService FileStorageService;

    // Query Repositories
    protected readonly IMenuQueryRepository MenuQueryRepo;
    protected readonly ITableReservationQueryRepository ReservationQueryRepo;
    protected readonly IOrderQueryRepository OrderQueryRepo;
    protected readonly IVoucherQueryRepository VoucherQueryRepo;
    protected readonly IDishReviewQueryRepository DishReviewQueryRepo;
    protected readonly ICartQueryRepository CartQueryRepo;
    protected readonly IKitchenQueryRepository KitchenQueryRepo;
    protected readonly IInventoryQueryRepository InventoryQueryRepo;

    protected TestApplicationBase()
    {
        var options = new DbContextOptionsBuilder<JapanFoodDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        Context = new JapanFoodDbContext(options);
        UnitOfWork = new TestUnitOfWork(Context);

        // Validation DI
        var services = new ServiceCollection();
        services.AddScoped<IJapanFoodDbContext>(_ => Context);
        services.AddSingleton<IPhoneService, PhoneService>();
        services.AddAppValidation(typeof(IValidationFactory).Assembly);
        ValidationFactory = services.BuildServiceProvider().GetRequiredService<IValidationFactory>();

        // Test doubles
        EmailService = new TestEmailService();
        VnPayService = new TestVnPayService();
        MoMoService = new TestMoMoService();
        FileStorageService = new TestFileStorageService();

        // Repositories
        MenuQueryRepo = new MenuQueryRepository(Context);
        ReservationQueryRepo = new TableReservationQueryRepository(Context);
        OrderQueryRepo = new OrderQueryRepository(Context);
        VoucherQueryRepo = new VoucherQueryRepository(Context);
        DishReviewQueryRepo = new DishReviewQueryRepository(Context);
        CartQueryRepo = new CartQueryRepository(Context);
        KitchenQueryRepo = new KitchenQueryRepository(Context);
        InventoryQueryRepo = new InventoryQueryRepository(Context);
    }

    #region Helper Seed Methods
    protected async Task<User> SeedUserAsync(string fullName = "Nguyễn Văn A", string email = "user@japanfood.vn", string phone = "0901234567")
    {
        var user = new User
        {
            FullName = fullName,
            Email = email,
            PhoneNumber = phone,
            PasswordHash = "hashed_password",
            AccountStatus = "ACTIVE",
            Role = "CUSTOMER"
        };
        Context.Users.Add(user);
        await Context.SaveChangesAsync();
        return user;
    }

    protected async Task<TableArea> SeedAreaAsync(string code = "MAIN", string name = "Sảnh chính")
    {
        var area = new TableArea(code, name);
        Context.TableAreas.Add(area);
        await Context.SaveChangesAsync();
        return area;
    }

    protected async Task<Table> SeedTableAsync(int areaId, string tableNumber = "T-01", int capacity = 4, int minCapacity = 2)
    {
        var table = new Table(areaId, tableNumber, capacity, minCapacity);
        Context.Tables.Add(table);
        await Context.SaveChangesAsync();
        return table;
    }

    protected async Task<Category> SeedCategoryAsync(string code = "RAMEN", string name = "Ramen Nhật", int displayOrder = 1)
    {
        var category = new Category(code, name, "Mô tả category", displayOrder);
        Context.Categories.Add(category);
        await Context.SaveChangesAsync();
        return category;
    }

    protected async Task<MenuItem> SeedMenuItemAsync(
        int categoryId,
        string code = "RAMEN-01",
        string name = "Tonkotsu Ramen",
        decimal price = 120000m,
        KitchenStationType station = KitchenStationType.NoodleStation,
        bool isAvailable = true)
    {
        var item = new MenuItem(categoryId, code, name, price, "豚骨ラーメン", "Nước dùng hầm xương", station, 15, true);
        if (!isAvailable)
        {
            item.SetAvailability(false);
        }
        Context.MenuItems.Add(item);
        await Context.SaveChangesAsync();
        return item;
    }

    protected async Task<KitchenStation> SeedKitchenStationAsync(KitchenStationType stationType = KitchenStationType.NoodleStation, string name = "Bếp Mì")
    {
        var station = new KitchenStation(name, stationType);
        Context.KitchenStations.Add(station);
        await Context.SaveChangesAsync();
        return station;
    }

    protected async Task<InventoryItem> SeedInventoryItemAsync(
        string sku = "ING-FLOUR",
        string name = "Bột mì Ramen",
        decimal initialStock = 100m,
        decimal unitCost = 25000m)
    {
        var uom = await Context.UnitsOfMeasure.FirstOrDefaultAsync(u => u.Code == "KG");
        if (uom == null)
        {
            uom = new UnitOfMeasure("KG", "Kilogram");
            Context.UnitsOfMeasure.Add(uom);
            await Context.SaveChangesAsync();
        }

        var item = new InventoryItem(sku, name, "Nguyên liệu chính", uom.Id, 10m, unitCost, "Kho lạnh A");
        item.AddStock(initialStock, unitCost, "Khởi tạo tồn kho ban đầu");
        Context.InventoryItems.Add(item);
        await Context.SaveChangesAsync();
        return item;
    }

    protected async Task<Voucher> SeedVoucherAsync(
        string code = "SUMMER20",
        DiscountType type = DiscountType.Percentage,
        decimal discountValue = 20m,
        decimal minOrderAmount = 100000m,
        decimal? maxDiscount = 50000m)
    {
        var voucher = new Voucher(
            code,
            type,
            discountValue,
            DateTime.UtcNow.AddDays(-1),
            DateTime.UtcNow.AddDays(30),
            minOrderAmount,
            maxDiscount,
            usageLimit: 100,
            usagePerUserLimit: 2);

        Context.Vouchers.Add(voucher);
        await Context.SaveChangesAsync();
        return voucher;
    }

    protected async Task<CashierShift> SeedOpenShiftAsync(int openedByUserId = 1, decimal openingCash = 1000000m, string? notes = null)
    {
        var shift = new CashierShift(openedByUserId, openingCash, notes);
        Context.CashierShifts.Add(shift);
        await Context.SaveChangesAsync();
        return shift;
    }
    #endregion

    public void Dispose()
    {
        Context.Dispose();
        UnitOfWork.Dispose();
        GC.SuppressFinalize(this);
    }
}
