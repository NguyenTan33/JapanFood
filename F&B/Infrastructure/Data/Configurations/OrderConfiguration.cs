using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> builder)
    {
        builder.ToTable("ORDERS", t =>
        {
            t.HasCheckConstraint("CK_ORDERS_SUB_TOTAL", "[SUB_TOTAL] >= 0");
            t.HasCheckConstraint("CK_ORDERS_TAX_AMOUNT", "[TAX_AMOUNT] >= 0");
            t.HasCheckConstraint("CK_ORDERS_DISCOUNT_AMOUNT", "[DISCOUNT_AMOUNT] >= 0");
            t.HasCheckConstraint("CK_ORDERS_DELIVERY_FEE", "[DELIVERY_FEE] >= 0");
            t.HasCheckConstraint("CK_ORDERS_TOTAL_AMOUNT", "[TOTAL_AMOUNT] >= 0");
            t.HasCheckConstraint("CK_ORDERS_GUEST_COUNT", "[GUEST_COUNT] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("ORDER_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.OrderNumber)
            .HasColumnName("ORDER_NUMBER")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.TableId)
            .HasColumnName("TABLE_ID");

        builder.Property(e => e.UserId)
            .HasColumnName("USER_ID");

        builder.Property(e => e.ReservationId)
            .HasColumnName("RESERVATION_ID");

        builder.Property(e => e.VoucherId)
            .HasColumnName("VOUCHER_ID");

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.OrderType)
            .HasColumnName("ORDER_TYPE")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.GuestCount)
            .HasColumnName("GUEST_COUNT")
            .HasDefaultValue(1);

        builder.Property(e => e.SubTotal)
            .HasColumnName("SUB_TOTAL")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.TaxAmount)
            .HasColumnName("TAX_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.DiscountAmount)
            .HasColumnName("DISCOUNT_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.DeliveryFee)
            .HasColumnName("DELIVERY_FEE")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.TotalAmount)
            .HasColumnName("TOTAL_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.DepositAmount)
            .HasColumnName("DEPOSIT_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.RemainingCodAmount)
            .HasColumnName("REMAINING_COD_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.PaymentMethod)
            .HasColumnName("PAYMENT_METHOD")
            .HasConversion<string>()
            .HasMaxLength(30);

        builder.Property(e => e.DeliveryAddress)
            .HasColumnName("DELIVERY_ADDRESS")
            .HasMaxLength(500);

        builder.Property(e => e.RecipientName)
            .HasColumnName("RECIPIENT_NAME")
            .HasMaxLength(200);

        builder.Property(e => e.RecipientPhone)
            .HasColumnName("RECIPIENT_PHONE")
            .HasMaxLength(30);

        builder.Property(e => e.Notes)
            .HasColumnName("NOTES")
            .HasMaxLength(500);

        builder.Property(e => e.CompletedAt)
            .HasColumnName("COMPLETED_AT");

        builder.Property(e => e.RowVersion)
            .HasColumnName("ROW_VERSION")
            .IsRowVersion();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => e.OrderNumber)
            .IsUnique();

        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.OrderType);
        builder.HasIndex(e => e.TableId)
            .IsUnique(false);
        builder.HasIndex(e => e.UserId);

        builder.HasOne(e => e.Table)
            .WithMany()
            .HasForeignKey(e => e.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Reservation)
            .WithMany()
            .HasForeignKey(e => e.ReservationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Voucher)
            .WithMany()
            .HasForeignKey(e => e.VoucherId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(e => e.PaymentTransactions)
            .WithOne(p => p.Order)
            .HasForeignKey(p => p.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.Items)
            .WithOne(i => i.Order)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
