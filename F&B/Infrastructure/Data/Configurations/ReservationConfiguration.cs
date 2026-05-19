using Domain.Entities.Reservations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("RESERVATIONS", t =>
        {
            t.HasCheckConstraint("CK_RESERVATIONS_GUEST_COUNT", "[GUEST_COUNT] > 0");
            t.HasCheckConstraint("CK_RESERVATIONS_DEPOSIT_AMOUNT", "[DEPOSIT_AMOUNT] >= 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("RESERVATION_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ReservationCode)
            .HasColumnName("RESERVATION_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.CustomerName)
            .HasColumnName("CUSTOMER_NAME")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.CustomerPhone)
            .HasColumnName("PHONE_NUMBER")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.CustomerEmail)
            .HasColumnName("EMAIL")
            .HasMaxLength(100);

        builder.Property(e => e.GuestCount)
            .HasColumnName("GUEST_COUNT")
            .IsRequired();

        builder.Property(e => e.ReservationTime)
            .HasColumnName("RESERVATION_TIME")
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.SpecialRequests)
            .HasColumnName("SPECIAL_REQUESTS")
            .HasMaxLength(500);

        builder.Property(e => e.Allergies)
            .HasColumnName("ALLERGIES")
            .HasMaxLength(500);

        builder.Property(e => e.PreferredAreaId)
            .HasColumnName("PREFERRED_AREA_ID");

        builder.Property(e => e.AssignedTableId)
            .HasColumnName("ASSIGNED_TABLE_ID");

        builder.Property(e => e.UserId)
            .HasColumnName("USER_ID");

        builder.Property(e => e.ConfirmedAt)
            .HasColumnName("CONFIRMED_AT");

        builder.Property(e => e.ConfirmedByUserId)
            .HasColumnName("CONFIRMED_BY_USER_ID");

        builder.Property(e => e.SeatedAt)
            .HasColumnName("SEATED_AT");

        builder.Property(e => e.CancelledAt)
            .HasColumnName("CANCELLED_AT");

        builder.Property(e => e.CancelledByUserId)
            .HasColumnName("CANCELLED_BY_USER_ID");

        builder.Property(e => e.CancellationReason)
            .HasColumnName("CANCELLATION_REASON")
            .HasMaxLength(500);

        builder.Property(e => e.Notes)
            .HasColumnName("NOTES")
            .HasMaxLength(500);

        builder.Property(e => e.DepositAmount)
            .HasColumnName("DEPOSIT_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.DepositStatus)
            .HasColumnName("DEPOSIT_STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .HasDefaultValue(DepositStatus.None);

        builder.Property(e => e.DepositPaidAt)
            .HasColumnName("DEPOSIT_PAID_AT");

        builder.Property(e => e.DepositTransactionCode)
            .HasColumnName("DEPOSIT_TRANSACTION_CODE")
            .HasMaxLength(100);

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

        builder.HasIndex(e => e.ReservationCode)
            .IsUnique();

        builder.HasIndex(e => e.CustomerPhone);
        builder.HasIndex(e => e.ReservationTime);
        builder.HasIndex(e => e.Status);

        builder.HasOne(e => e.PreferredArea)
            .WithMany()
            .HasForeignKey(e => e.PreferredAreaId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.AssignedTable)
            .WithMany()
            .HasForeignKey(e => e.AssignedTableId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
