using Domain.Entities.Vouchers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class VoucherConfiguration : IEntityTypeConfiguration<Voucher>
{
    public void Configure(EntityTypeBuilder<Voucher> builder)
    {
        builder.ToTable("VOUCHERS", t =>
        {
            t.HasCheckConstraint("CK_VOUCHERS_DISCOUNT_VALUE", "[DISCOUNT_VALUE] > 0");
            t.HasCheckConstraint("CK_VOUCHERS_MIN_ORDER_AMOUNT", "[MIN_ORDER_AMOUNT] >= 0");
            t.HasCheckConstraint("CK_VOUCHERS_USAGE_LIMIT", "[USAGE_LIMIT] > 0");
            t.HasCheckConstraint("CK_VOUCHERS_USED_COUNT", "[USED_COUNT] >= 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("VOUCHER_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.VoucherCode)
            .HasColumnName("VOUCHER_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Title)
            .HasColumnName("TITLE")
            .HasMaxLength(200);

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(500);

        builder.Property(e => e.DiscountType)
            .HasColumnName("DISCOUNT_TYPE")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.DiscountValue)
            .HasColumnName("DISCOUNT_VALUE")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.MinOrderAmount)
            .HasColumnName("MIN_ORDER_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.MaxDiscountAmount)
            .HasColumnName("MAX_DISCOUNT_AMOUNT")
            .HasPrecision(18, 2);

        builder.Property(e => e.UsageLimit)
            .HasColumnName("USAGE_LIMIT")
            .HasDefaultValue(100);

        builder.Property(e => e.UsedCount)
            .HasColumnName("USED_COUNT")
            .HasDefaultValue(0);

        builder.Property(e => e.UsagePerUserLimit)
            .HasColumnName("USAGE_PER_USER_LIMIT")
            .HasDefaultValue(1);

        builder.Property(e => e.StartDate)
            .HasColumnName("START_DATE")
            .IsRequired();

        builder.Property(e => e.EndDate)
            .HasColumnName("END_DATE")
            .IsRequired();

        builder.Property(e => e.IsActive)
            .HasColumnName("IS_ACTIVE")
            .HasDefaultValue(true);

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

        builder.HasIndex(e => e.VoucherCode)
            .IsUnique();

        builder.HasMany(e => e.Usages)
            .WithOne(u => u.Voucher)
            .HasForeignKey(u => u.VoucherId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
