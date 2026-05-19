using Domain.Entities.Payment;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> builder)
    {
        builder.ToTable("PAYMENT_TRANSACTIONS", t =>
        {
            t.HasCheckConstraint("CK_PAYMENT_TXN_AMOUNT", "[AMOUNT] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("TRANSACTION_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.OrderId)
            .HasColumnName("ORDER_ID");

        builder.Property(e => e.TransactionNumber)
            .HasColumnName("TRANSACTION_NUMBER")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Gateway)
            .HasColumnName("GATEWAY")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.Amount)
            .HasColumnName("AMOUNT")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.GatewayTransactionId)
            .HasColumnName("GATEWAY_TRANSACTION_ID")
            .HasMaxLength(100);

        builder.Property(e => e.GatewayResponseCode)
            .HasColumnName("GATEWAY_RESPONSE_CODE")
            .HasMaxLength(50);

        builder.Property(e => e.IpAddress)
            .HasColumnName("IP_ADDRESS")
            .HasMaxLength(50);

        builder.Property(e => e.RawPayload)
            .HasColumnName("RAW_PAYLOAD")
            .HasColumnType("nvarchar(max)");

        builder.Property(e => e.FailureReason)
            .HasColumnName("FAILURE_REASON")
            .HasMaxLength(500);

        builder.Property(e => e.RefundReference)
            .HasColumnName("REFUND_REFERENCE")
            .HasMaxLength(100);

        builder.Property(e => e.AmountGiven)
            .HasColumnName("AMOUNT_GIVEN")
            .HasPrecision(18, 2);

        builder.Property(e => e.ChangeAmount)
            .HasColumnName("CHANGE_AMOUNT")
            .HasPrecision(18, 2);

        builder.Property(e => e.PaidAt)
            .HasColumnName("PAID_AT");

        builder.Property(e => e.ShiftId)
            .HasColumnName("SHIFT_ID");

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => e.TransactionNumber)
            .IsUnique();

        builder.HasIndex(e => e.GatewayTransactionId);

        builder.HasIndex(e => e.ShiftId);

        builder.HasOne(e => e.Order)
            .WithMany(o => o.PaymentTransactions)
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Shift)
            .WithMany(s => s.PaymentTransactions)
            .HasForeignKey(e => e.ShiftId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
