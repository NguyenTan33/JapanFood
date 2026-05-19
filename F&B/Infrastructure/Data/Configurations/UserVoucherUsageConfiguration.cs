using Domain.Entities.Vouchers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UserVoucherUsageConfiguration : IEntityTypeConfiguration<UserVoucherUsage>
{
    public void Configure(EntityTypeBuilder<UserVoucherUsage> builder)
    {
        builder.ToTable("USER_VOUCHER_USAGES", t =>
        {
            t.HasCheckConstraint("CK_UVU_DISCOUNT_APPLIED", "[DISCOUNT_APPLIED] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("USAGE_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.VoucherId)
            .HasColumnName("VOUCHER_ID");

        builder.Property(e => e.UserId)
            .HasColumnName("USER_ID");

        builder.Property(e => e.OrderId)
            .HasColumnName("ORDER_ID");

        builder.Property(e => e.DiscountApplied)
            .HasColumnName("DISCOUNT_APPLIED")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.UsedAt)
            .HasColumnName("USED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.HasIndex(e => new { e.UserId, e.VoucherId, e.OrderId })
            .IsUnique();

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Order)
            .WithMany()
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
