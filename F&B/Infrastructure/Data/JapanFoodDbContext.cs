using Application.Interfaces;
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

namespace Infrastructure.Data;

public class JapanFoodDbContext : DbContext, IJapanFoodDbContext
{
    public JapanFoodDbContext(DbContextOptions<JapanFoodDbContext> options)
        : base(options)
    {
    }

    // Auth & Identity
    public DbSet<User> Users => Set<User>();
    public DbSet<UserAddress> UserAddresses => Set<UserAddress>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<OtpVerification> OtpVerifications => Set<OtpVerification>();

    // Subsystem 1: Reservations
    public DbSet<Reservation> Reservations => Set<Reservation>();

    // Subsystem 2: Table Management
    public DbSet<TableArea> TableAreas => Set<TableArea>();
    public DbSet<Table> Tables => Set<Table>();

    // Subsystem 3: Menu & Orders
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<ModifierGroup> ModifierGroups => Set<ModifierGroup>();
    public DbSet<ModifierOption> ModifierOptions => Set<ModifierOption>();
    public DbSet<MenuItemModifierGroup> MenuItemModifierGroups => Set<MenuItemModifierGroup>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderItemModifier> OrderItemModifiers => Set<OrderItemModifier>();

    // Subsystem 4: Kitchen Display System (KDS)
    public DbSet<KitchenStation> KitchenStations => Set<KitchenStation>();
    public DbSet<KitchenTicket> KitchenTickets => Set<KitchenTicket>();
    public DbSet<KitchenTicketItem> KitchenTicketItems => Set<KitchenTicketItem>();

    // Subsystem 5: Inventory & BOM
    public DbSet<UnitOfMeasure> UnitsOfMeasure => Set<UnitOfMeasure>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<RecipeBOM> RecipeBOMs => Set<RecipeBOM>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<InventoryAudit> InventoryAudits => Set<InventoryAudit>();
    public DbSet<InventoryAuditItem> InventoryAuditItems => Set<InventoryAuditItem>();

    // Subsystem 6: 5S / Kaizen Operations Checklists & Cashier Shifts
    public DbSet<ShiftChecklist> ShiftChecklists => Set<ShiftChecklist>();
    public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
    public DbSet<ChecklistExecution> ChecklistExecutions => Set<ChecklistExecution>();
    public DbSet<ChecklistItemResult> ChecklistItemResults => Set<ChecklistItemResult>();
    public DbSet<CashierShift> CashierShifts => Set<CashierShift>();
    public DbSet<CashDrawerWithdrawal> CashDrawerWithdrawals => Set<CashDrawerWithdrawal>();

    // Subsystem 7: Online Ordering, Payments, Vouchers & Reviews (ERD Alignment & Security Hardening)
    public DbSet<Voucher> Vouchers => Set<Voucher>();
    public DbSet<UserVoucherUsage> UserVoucherUsages => Set<UserVoucherUsage>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<CartItem> CartItems => Set<CartItem>();
    public DbSet<CartItemModifier> CartItemModifiers => Set<CartItemModifier>();
    public DbSet<MenuItemReview> MenuItemReviews => Set<MenuItemReview>();

    // Subsystem 8: Content & Restaurant Configuration
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<BranchWifiConfig> BranchWifiConfigs => Set<BranchWifiConfig>();
    public DbSet<BlogPost> BlogPosts => Set<BlogPost>();
    public DbSet<RestaurantSetting> RestaurantSettings => Set<RestaurantSetting>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        // 1. USERS
        builder.Entity<User>(entity =>
        {
            entity.ToTable("USERS");
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.UserId).HasColumnName("USER_ID").ValueGeneratedOnAdd();
            entity.Property(e => e.FullName).HasColumnName("FULL_NAME").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Email).HasColumnName("EMAIL").HasMaxLength(100).IsRequired();
            entity.Property(e => e.PhoneNumber).HasColumnName("PHONE_NUMBER").HasMaxLength(20).IsRequired();
            entity.Property(e => e.PasswordHash).HasColumnName("PASSWORD_HASH").HasMaxLength(255).IsRequired();
            entity.Property(e => e.LoyaltyPoints).HasColumnName("LOYALTY_POINTS").HasDefaultValue(0);
            entity.Property(e => e.MembershipTier).HasColumnName("MEMBERSHIP_TIER").HasMaxLength(20).HasDefaultValue("BRONZE");
            entity.Property(e => e.AccountStatus).HasColumnName("ACCOUNT_STATUS").HasMaxLength(20).HasDefaultValue("ACTIVE");
            entity.Property(e => e.Role).HasColumnName("ROLE").HasMaxLength(20).HasDefaultValue("CUSTOMER");
            entity.Property(e => e.AvatarUrl).HasColumnName("AVATAR_URL").HasMaxLength(500);
            entity.Property(e => e.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.LastLoginAt).HasColumnName("LAST_LOGIN_AT");

            entity.HasIndex(e => e.Email).IsUnique();
            entity.HasIndex(e => e.PhoneNumber);
        });

        // 2. USER_ADDRESSES
        builder.Entity<UserAddress>(entity =>
        {
            entity.ToTable("USER_ADDRESSES");
            entity.HasKey(e => e.AddressId);
            entity.Property(e => e.AddressId).HasColumnName("ADDRESS_ID").ValueGeneratedOnAdd();
            entity.Property(e => e.UserId).HasColumnName("USER_ID");
            entity.Property(e => e.RecipientName).HasColumnName("RECIPIENT_NAME").HasMaxLength(255).IsRequired();
            entity.Property(e => e.PhoneNumber).HasColumnName("PHONE_NUMBER").HasMaxLength(20).IsRequired();
            entity.Property(e => e.StreetAddress).HasColumnName("STREET_ADDRESS").HasMaxLength(500).IsRequired();
            entity.Property(e => e.Ward).HasColumnName("WARD").HasMaxLength(100).IsRequired();
            entity.Property(e => e.District).HasColumnName("DISTRICT").HasMaxLength(100).IsRequired();
            entity.Property(e => e.City).HasColumnName("CITY").HasMaxLength(100).IsRequired();
            entity.Property(e => e.IsDefault).HasColumnName("IS_DEFAULT").HasMaxLength(1).HasDefaultValue("N");

            entity.HasOne(e => e.User)
                .WithMany(u => u.Addresses)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // 3. REFRESH_TOKENS
        builder.Entity<RefreshToken>(entity =>
        {
            entity.ToTable("REFRESH_TOKENS");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("ID").ValueGeneratedOnAdd();
            entity.Property(e => e.AccountId).HasColumnName("ACCOUNT_ID").HasMaxLength(100).IsRequired();
            entity.Property(e => e.TokenHash).HasColumnName("TOKEN_HASH").HasMaxLength(255).IsRequired();
            entity.Property(e => e.ExpiresAt).HasColumnName("EXPIRES_AT");
            entity.Property(e => e.IsRevoked).HasColumnName("IS_REVOKED").HasDefaultValue(false);
            entity.Property(e => e.RevokedAt).HasColumnName("REVOKED_AT");
            entity.Property(e => e.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.TokenHash);
            entity.HasIndex(e => e.AccountId);
        });

        // 4. OTP_VERIFICATIONS
        builder.Entity<OtpVerification>(entity =>
        {
            entity.ToTable("OTP_VERIFICATIONS");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("ID").ValueGeneratedOnAdd();
            entity.Property(e => e.PhoneNumber).HasColumnName("PHONE_NUMBER").HasMaxLength(20).IsRequired();
            entity.Property(e => e.OtpHash).HasColumnName("OTP_HASH").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Purpose).HasColumnName("PURPOSE").HasMaxLength(50).IsRequired();
            entity.Property(e => e.ExpiresAt).HasColumnName("EXPIRES_AT");
            entity.Property(e => e.FailedAttempts).HasColumnName("FAILED_ATTEMPTS").HasDefaultValue(0);
            entity.Property(e => e.IsUsed).HasColumnName("IS_USED").HasDefaultValue(false);
            entity.Property(e => e.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => new { e.PhoneNumber, e.Purpose });
        });

        // Modular Entity Configurations
        builder.ApplyConfigurationsFromAssembly(typeof(JapanFoodDbContext).Assembly);
    }
}
