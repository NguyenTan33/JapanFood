using Domain.Entities;
using Domain.Entities.Content;
using Domain.Entities.Inventory;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.Operations;
using Domain.Entities.Ordering;
using Domain.Entities.Payment;
using Domain.Entities.Reservations;
using Domain.Entities.Reviews;
using Domain.Entities.TableManagement;
using Domain.Entities.Vouchers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

namespace Application.Interfaces;

public interface IJapanFoodDbContext
{
    // Auth & Identity
    DbSet<User> Users { get; }
    DbSet<UserAddress> UserAddresses { get; }
    DbSet<RefreshToken> RefreshTokens { get; }
    DbSet<OtpVerification> OtpVerifications { get; }

    // Subsystem 1: Reservations
    DbSet<Reservation> Reservations { get; }

    // Subsystem 2: Table Management
    DbSet<TableArea> TableAreas { get; }
    DbSet<Table> Tables { get; }

    // Subsystem 3: Menu & Orders
    DbSet<Category> Categories { get; }
    DbSet<MenuItem> MenuItems { get; }
    DbSet<ModifierGroup> ModifierGroups { get; }
    DbSet<ModifierOption> ModifierOptions { get; }
    DbSet<MenuItemModifierGroup> MenuItemModifierGroups { get; }
    DbSet<Order> Orders { get; }
    DbSet<OrderItem> OrderItems { get; }
    DbSet<OrderItemModifier> OrderItemModifiers { get; }

    // Subsystem 4: Kitchen Display System (KDS)
    DbSet<KitchenStation> KitchenStations { get; }
    DbSet<KitchenTicket> KitchenTickets { get; }
    DbSet<KitchenTicketItem> KitchenTicketItems { get; }

    // Subsystem 5: Inventory & BOM
    DbSet<UnitOfMeasure> UnitsOfMeasure { get; }
    DbSet<InventoryItem> InventoryItems { get; }
    DbSet<RecipeBOM> RecipeBOMs { get; }
    DbSet<Supplier> Suppliers { get; }
    DbSet<PurchaseOrder> PurchaseOrders { get; }
    DbSet<PurchaseOrderItem> PurchaseOrderItems { get; }
    DbSet<InventoryAudit> InventoryAudits { get; }
    DbSet<InventoryAuditItem> InventoryAuditItems { get; }

    // Subsystem 6: 5S / Kaizen Operations Checklists & Cashier Shifts
    DbSet<ShiftChecklist> ShiftChecklists { get; }
    DbSet<ChecklistItem> ChecklistItems { get; }
    DbSet<ChecklistExecution> ChecklistExecutions { get; }
    DbSet<ChecklistItemResult> ChecklistItemResults { get; }
    DbSet<CashierShift> CashierShifts { get; }
    DbSet<CashDrawerWithdrawal> CashDrawerWithdrawals { get; }

    // Subsystem 7: Online Ordering, Payments, Vouchers & Reviews
    DbSet<Voucher> Vouchers { get; }
    DbSet<UserVoucherUsage> UserVoucherUsages { get; }
    DbSet<PaymentTransaction> PaymentTransactions { get; }
    DbSet<CartItem> CartItems { get; }
    DbSet<CartItemModifier> CartItemModifiers { get; }
    DbSet<MenuItemReview> MenuItemReviews { get; }

    // Subsystem 8: Content & Restaurant Configuration
    DbSet<Branch> Branches { get; }
    DbSet<BranchWifiConfig> BranchWifiConfigs { get; }
    DbSet<BlogPost> BlogPosts { get; }
    DbSet<RestaurantSetting> RestaurantSettings { get; }

    DatabaseFacade Database { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
