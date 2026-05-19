using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ModifierOptionConfiguration : IEntityTypeConfiguration<ModifierOption>
{
    public void Configure(EntityTypeBuilder<ModifierOption> builder)
    {
        builder.ToTable("MODIFIER_OPTIONS", t =>
        {
            t.HasCheckConstraint("CK_MODIFIER_OPTIONS_PRICE_ADJ", "[PRICE_ADJUSTMENT] >= 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("MODIFIER_OPTION_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ModifierGroupId)
            .HasColumnName("MODIFIER_GROUP_ID")
            .IsRequired();

        builder.Property(e => e.OptionCode)
            .HasColumnName("OPTION_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.OptionName)
            .HasColumnName("OPTION_NAME")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.PriceAdjustment)
            .HasColumnName("PRICE_ADJUSTMENT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.IsDefault)
            .HasColumnName("IS_DEFAULT")
            .HasDefaultValue(false);

        builder.Property(e => e.IsAvailable)
            .HasColumnName("IS_AVAILABLE")
            .HasDefaultValue(true);

        builder.Property(e => e.DisplayOrder)
            .HasColumnName("DISPLAY_ORDER")
            .HasDefaultValue(0);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => new { e.ModifierGroupId, e.OptionCode })
            .IsUnique();

        builder.HasOne(e => e.ModifierGroup)
            .WithMany(g => g.Options)
            .HasForeignKey(e => e.ModifierGroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
