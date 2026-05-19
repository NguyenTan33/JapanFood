using Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class CashDrawerWithdrawalConfiguration : IEntityTypeConfiguration<CashDrawerWithdrawal>
{
    public void Configure(EntityTypeBuilder<CashDrawerWithdrawal> builder)
    {
        builder.ToTable("CASH_DRAWER_WITHDRAWALS", t =>
        {
            t.HasCheckConstraint("CK_WITHDRAWAL_AMOUNT", "[AMOUNT] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("WITHDRAWAL_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ShiftId)
            .HasColumnName("SHIFT_ID");

        builder.Property(e => e.WithdrawnByUserId)
            .HasColumnName("WITHDRAWN_BY_USER_ID");

        builder.Property(e => e.Amount)
            .HasColumnName("AMOUNT")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.PhotoUrl)
            .HasColumnName("PHOTO_URL")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.Note)
            .HasColumnName("NOTE")
            .HasMaxLength(500);

        builder.Property(e => e.WithdrawnAt)
            .HasColumnName("WITHDRAWN_AT")
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => e.ShiftId);
        builder.HasIndex(e => e.WithdrawnAt);

        builder.HasOne(e => e.Shift)
            .WithMany(s => s.Withdrawals)
            .HasForeignKey(e => e.ShiftId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.WithdrawnByUser)
            .WithMany()
            .HasForeignKey(e => e.WithdrawnByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
