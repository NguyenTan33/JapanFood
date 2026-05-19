using Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class CashierShiftConfiguration : IEntityTypeConfiguration<CashierShift>
{
    public void Configure(EntityTypeBuilder<CashierShift> builder)
    {
        builder.ToTable("CASHIER_SHIFTS", t =>
        {
            t.HasCheckConstraint("CK_SHIFT_OPENING_CASH", "[OPENING_CASH] >= 0");
            t.HasCheckConstraint("CK_SHIFT_CLOSING_CASH", "[CLOSING_ACTUAL_CASH] IS NULL OR [CLOSING_ACTUAL_CASH] >= 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("SHIFT_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ShiftCode)
            .HasColumnName("SHIFT_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.OpenedByUserId)
            .HasColumnName("OPENED_BY_USER_ID");

        builder.Property(e => e.OpenedAt)
            .HasColumnName("OPENED_AT")
            .IsRequired();

        builder.Property(e => e.OpeningCash)
            .HasColumnName("OPENING_CASH")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.ClosedByUserId)
            .HasColumnName("CLOSED_BY_USER_ID");

        builder.Property(e => e.ClosedAt)
            .HasColumnName("CLOSED_AT");

        builder.Property(e => e.ClosingActualCash)
            .HasColumnName("CLOSING_ACTUAL_CASH")
            .HasPrecision(18, 2);

        builder.Property(e => e.ExpectedCash)
            .HasColumnName("EXPECTED_CASH")
            .HasPrecision(18, 2);

        builder.Property(e => e.VarianceAmount)
            .HasColumnName("VARIANCE_AMOUNT")
            .HasPrecision(18, 2);

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.Notes)
            .HasColumnName("NOTES")
            .HasMaxLength(500);

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

        builder.HasIndex(e => e.ShiftCode).IsUnique();
        builder.HasIndex(e => e.OpenedAt);
        builder.HasIndex(e => e.Status)
            .IsUnique()
            .HasFilter("[STATUS] = 'Open'");

        builder.HasOne(e => e.OpenedByUser)
            .WithMany()
            .HasForeignKey(e => e.OpenedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.ClosedByUser)
            .WithMany()
            .HasForeignKey(e => e.ClosedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Withdrawals)
            .WithOne(w => w.Shift)
            .HasForeignKey(w => w.ShiftId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
