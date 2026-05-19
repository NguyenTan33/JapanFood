using Domain.Entities.Ordering;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class CartItemModifierConfiguration : IEntityTypeConfiguration<CartItemModifier>
{
    public void Configure(EntityTypeBuilder<CartItemModifier> builder)
    {
        builder.ToTable("CART_ITEM_MODIFIERS", t =>
        {
            t.HasCheckConstraint("CK_CIM_QUANTITY", "[QUANTITY] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("CART_ITEM_MODIFIER_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.CartItemId)
            .HasColumnName("CART_ITEM_ID");

        builder.Property(e => e.ModifierOptionId)
            .HasColumnName("MODIFIER_OPTION_ID");

        builder.Property(e => e.Quantity)
            .HasColumnName("QUANTITY")
            .HasDefaultValue(1);

        builder.HasOne(e => e.CartItem)
            .WithMany(c => c.Modifiers)
            .HasForeignKey(e => e.CartItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.ModifierOption)
            .WithMany()
            .HasForeignKey(e => e.ModifierOptionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
