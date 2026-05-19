using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class OrderItemModifierConfiguration : IEntityTypeConfiguration<OrderItemModifier>
{
    public void Configure(EntityTypeBuilder<OrderItemModifier> builder)
    {
        builder.ToTable("ORDER_ITEM_MODIFIERS", t =>
        {
            t.HasCheckConstraint("CK_OIM_PRICE_ADJUSTMENT", "[PRICE_ADJUSTMENT] >= 0");
            t.HasCheckConstraint("CK_OIM_QUANTITY", "[QUANTITY] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("ORDER_ITEM_MODIFIER_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.OrderItemId)
            .HasColumnName("ORDER_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.ModifierOptionId)
            .HasColumnName("MODIFIER_OPTION_ID")
            .IsRequired();

        builder.Property(e => e.ModifierOptionName)
            .HasColumnName("MODIFIER_OPTION_NAME")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.PriceAdjustment)
            .HasColumnName("PRICE_ADJUSTMENT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.Quantity)
            .HasColumnName("QUANTITY")
            .HasDefaultValue(1);

        builder.HasIndex(e => e.OrderItemId);
        builder.HasIndex(e => e.ModifierOptionId);

        builder.HasOne(e => e.OrderItem)
            .WithMany(i => i.Modifiers)
            .HasForeignKey(e => e.OrderItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.ModifierOption)
            .WithMany()
            .HasForeignKey(e => e.ModifierOptionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
