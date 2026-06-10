using APIAuth.Services.Common;
using Application.DTOs.Reservations;
using Application.Services;
using Domain.Entities.Menu;
using Domain.Entities.Reservations;
using Domain.Entities.TableManagement;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class AdminAreasTablesAndReservationsTests : TestApplicationBase
{
    private readonly TableReservationService _service;

    public AdminAreasTablesAndReservationsTests()
    {
        _service = new TableReservationService(
            UnitOfWork,
            ReservationQueryRepo,
            ValidationFactory,
            EmailService,
            NullLogger<TableReservationService>.Instance);
    }

    [Fact]
    public async Task AreaCrud_CreateUpdateStatusAndSafeDelete_WorksCorrectly()
    {
        var created = await _service.CreateAreaAsync(new CreateTableAreaRequestDto
        {
            AreaCode = "ROOF",
            AreaName = "Sân Thượng",
            JapaneseName = "屋上",
            MinGuests = 2,
            MaxGuests = 8,
            Features = ["View thành phố", "Ngoài trời"],
            DisplayOrder = 5
        });

        Assert.Equal("ROOF", created.Code);
        Assert.Equal("Sân Thượng", created.Name);
        Assert.True(created.IsActive);

        await Assert.ThrowsAsync<ConflictException>(() => _service.CreateAreaAsync(new CreateTableAreaRequestDto
        {
            AreaCode = "roof",
            AreaName = "Dup",
            MinGuests = 1,
            MaxGuests = 4
        }));

        var updated = await _service.UpdateAreaAsync(created.Id, new UpdateTableAreaRequestDto
        {
            AreaName = "Sân Thượng VIP",
            MinGuests = 2,
            MaxGuests = 12,
            DisplayOrder = 6
        });
        Assert.Equal("Sân Thượng VIP", updated.Name);

        await _service.SetAreaStatusAsync(created.Id, false);
        var adminAreas = await ReservationQueryRepo.GetAllAreasForAdminAsync();
        Assert.Contains(adminAreas, a => a.Id == created.Id && !a.IsActive);

        var activeAreas = await ReservationQueryRepo.GetActiveAreasAsync();
        Assert.DoesNotContain(activeAreas, a => a.Id == created.Id);

        // Attach a table -> DeleteAreaAsync should block
        var table = await _service.CreateTableAsync(new CreateTableRequestDto { AreaId = created.Id, TableNumber = "R-01", Capacity = 4, MinCapacity = 1 });
        await Assert.ThrowsAsync<BusinessException>(() => _service.DeleteAreaAsync(created.Id));

        // Delete empty table first -> then DeleteAreaAsync succeeds
        await _service.DeleteTableAsync(table.TableId);
        Assert.True(await _service.DeleteAreaAsync(created.Id));
    }

    [Fact]
    public async Task TableCrud_AndGetAllTablesRealFields_ProjectsOrderAndUpcomingReservation()
    {
        await SeedOpenShiftAsync();
        var area = await SeedAreaAsync("MAIN", "Sảnh Chính");

        var t1 = await _service.CreateTableAsync(new CreateTableRequestDto { AreaId = area.Id, TableNumber = "M-01", Capacity = 4, MinCapacity = 1 });
        var t2 = await _service.CreateTableAsync(new CreateTableRequestDto { AreaId = area.Id, TableNumber = "M-02", Capacity = 6, MinCapacity = 2 });

        await Assert.ThrowsAsync<ConflictException>(() =>
            _service.CreateTableAsync(new CreateTableRequestDto { AreaId = area.Id, TableNumber = "m-01", Capacity = 4, MinCapacity = 1 }));

        // Occupy t1 with an order containing a dish
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "D-01", "Sushi Set", 200000m);
        var opened = await _service.OpenTableAsync(t1.TableId, new OpenTableRequestDto { GuestCount = 3 }, 1);

        var orderEntity = await Context.Orders.FirstAsync(o => o.Id == opened.OrderId);
        orderEntity.AddItem(dish, 1); // Total with 8% VAT = 216,000
        await Context.SaveChangesAsync();

        // Reserve t2 and mark TableStatus.Reserved
        var resTime = DateTime.UtcNow.Date.AddDays(1).Add(new TimeSpan(18, 30, 0));
        var res = new Reservation("Tanaka", "0901234567", null, 5, resTime);
        res.AssignTable(t2.TableId);
        res.Confirm(1);
        Context.Reservations.Add(res);
        var t2Entity = await Context.Tables.FirstAsync(t => t.Id == t2.TableId);
        t2Entity.Reserve();
        await Context.SaveChangesAsync();

        var posTables = await ReservationQueryRepo.GetAllTablesAsync();
        var dto1 = posTables.First(t => t.TableId == t1.TableId);
        Assert.Equal(opened.OrderId, dto1.ActiveOrderId);
        Assert.Equal(opened.OrderId, dto1.CurrentOrderId);
        Assert.NotNull(dto1.OpenedAt);
        Assert.Equal(216000m, dto1.CurrentTotal);
        Assert.Equal(216000m, dto1.TotalAmount);
        Assert.Equal(3, dto1.GuestCount);

        var dto2 = posTables.First(t => t.TableId == t2.TableId);
        Assert.Equal("Reserved", dto2.Status);
        Assert.Equal(5, dto2.GuestCount);
        Assert.NotNull(dto2.ReservationTime);

        // Delete t1 while serving -> blocked; delete t2 after order history -> soft-deactivates
        await Assert.ThrowsAsync<BusinessException>(() => _service.DeleteTableAsync(t1.TableId));

        await _service.SetTableStatusAsync(t2.TableId, false);
        var allAdminTables = await ReservationQueryRepo.GetAllTablesForAdminAsync();
        Assert.Contains(allAdminTables, t => t.TableId == t2.TableId && !t.IsActive);

        // t2 has a reservation -> DeleteTableAsync soft-deactivates instead of throwing FK violation
        await _service.SetTableStatusAsync(t2.TableId, true);
        await _service.DeleteTableAsync(t2.TableId);
        var t2AfterDelete = await Context.Tables.FirstAsync(t => t.Id == t2.TableId);
        Assert.False(t2AfterDelete.IsActive);
    }

    [Fact]
    public async Task ManagedReservations_ComputesStatusCountsAndFiltersCorrectly()
    {
        var area = await SeedAreaAsync("VIP", "Phòng VIP");
        var table = await SeedTableAsync(area.Id, "VIP-01", 6, 2);

        var day = DateTime.UtcNow.Date.AddDays(1);
        var rPending = new Reservation("Khách A", "0901111111", "a@test.vn", 2, day.AddHours(18), preferredAreaId: area.Id);
        rPending.AssignTable(table.Id);

        var rConfirmed = new Reservation("Khách B", "0902222222", null, 4, day.AddHours(19), preferredAreaId: area.Id);
        rConfirmed.AssignTable(table.Id);
        rConfirmed.Confirm(1);

        var rCancelled = new Reservation("Khách C", "0903333333", null, 3, day.AddHours(20), preferredAreaId: area.Id);
        rCancelled.Cancel("Bận việc", 1);

        var rNoShow = new Reservation("Khách D", "0904444444", null, 2, day.AddHours(17), preferredAreaId: area.Id);
        rNoShow.AssignTable(table.Id);
        rNoShow.Confirm(1);
        rNoShow.MarkNoShow("Quá 30 phút", rNoShow.ReservationTime.AddMinutes(30));

        Context.Reservations.AddRange(rPending, rConfirmed, rCancelled, rNoShow);
        await Context.SaveChangesAsync();

        // Grace-period check via service on upcoming confirmed reservation
        await Assert.ThrowsAsync<BusinessException>(() => _service.MarkNoShowAsync(rConfirmed.Id, "Quá sớm"));

        var manageResult = await ReservationQueryRepo.GetManagedReservationsAsync(new ReservationManageFilterDto
        {
            FromDate = day,
            ToDate = day,
            AreaId = area.Id,
            Status = "Confirmed"
        });

        Assert.Equal(4, manageResult.Counts.Total);
        Assert.Equal(1, manageResult.Counts.Pending);
        Assert.Equal(1, manageResult.Counts.Confirmed);
        Assert.Equal(1, manageResult.Counts.Cancelled);
        Assert.Equal(1, manageResult.Counts.NoShow);
        Assert.Single(manageResult.Items);
        Assert.Equal("Khách B", manageResult.Items[0].CustomerName);
    }

    [Fact]
    public async Task CheckInGuest_RejectsInactiveOrServingTable()
    {
        await SeedOpenShiftAsync();
        var area = await SeedAreaAsync();
        var table = await SeedTableAsync(area.Id, "T-INACTIVE", 4, 1);

        var res = new Reservation("Khách Checkin", "0909888777", null, 2, DateTime.UtcNow.Date.AddDays(1).Add(new TimeSpan(18, 30, 0)));
        res.AssignTable(table.Id);
        res.Confirm(1);
        Context.Reservations.Add(res);
        await Context.SaveChangesAsync();

        await _service.SetTableStatusAsync(table.Id, false);
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CheckInGuestAsync(res.Id, 1));
        Assert.Contains("ngừng hoạt động", ex.Message);
    }
}
