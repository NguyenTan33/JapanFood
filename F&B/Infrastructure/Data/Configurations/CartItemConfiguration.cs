using Domain.Entities.Ordering;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class CartItemConfiguration : IEntityTypeConfiguration<CartItem>
{
    public void Configure(EntityTypeBuilder<CartItem> builder)
    {
        builder.ToTable("CART_ITEMS", t =>
        {
            t.HasCheckConstraint("CK_CART_ITEMS_QUANTITY", "[QUANTITY] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("CART_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.UserId)
            .HasColumnName("USER_ID");

        builder.Property(e => e.MenuItemId)
            .HasColumnName("MENU_ITEM_ID");

        builder.Property(e => e.Quantity)
            .HasColumnName("QUANTITY")
            .HasDefaultValue(1);

        builder.Property(e => e.SpecialInstructions)
            .HasColumnName("SPECIAL_INSTRUCTIONS")
            .HasMaxLength(500);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => new { e.UserId, e.MenuItemId });

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.MenuItem)
            .WithMany()
            .HasForeignKey(e => e.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Modifiers)
            .WithOne(m => m.CartItem)
            .HasForeignKey(m => m.CartItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
