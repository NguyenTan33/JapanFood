using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> builder)
    {
        builder.ToTable("ORDER_ITEMS", t =>
        {
            t.HasCheckConstraint("CK_ORDER_ITEMS_QUANTITY", "[QUANTITY] > 0");
            t.HasCheckConstraint("CK_ORDER_ITEMS_UNIT_PRICE", "[UNIT_PRICE] >= 0");
            t.HasCheckConstraint("CK_ORDER_ITEMS_MODIFIERS_PRICE", "[MODIFIERS_PRICE] >= 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("ORDER_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.OrderId)
            .HasColumnName("ORDER_ID")
            .IsRequired();

        builder.Property(e => e.MenuItemId)
            .HasColumnName("MENU_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.UnitPrice)
            .HasColumnName("UNIT_PRICE")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.ModifiersPrice)
            .HasColumnName("MODIFIERS_PRICE")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.Quantity)
            .HasColumnName("QUANTITY")
            .IsRequired();

        builder.Property(e => e.ItemStatus)
            .HasColumnName("ITEM_STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.KitchenStation)
            .HasColumnName("KITCHEN_STATION")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.SpecialInstructions)
            .HasColumnName("SPECIAL_INSTRUCTIONS")
            .HasMaxLength(500);

        builder.Property(e => e.CancellationReason)
            .HasColumnName("CANCELLATION_REASON")
            .HasMaxLength(500);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.ServedAt)
            .HasColumnName("SERVED_AT");

        builder.Ignore(e => e.TotalPrice);

        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.MenuItemId);
        builder.HasIndex(e => e.ItemStatus);

        builder.HasOne(e => e.Order)
            .WithMany(o => o.Items)
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.MenuItem)
            .WithMany()
            .HasForeignKey(e => e.MenuItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Modifiers)
            .WithOne(m => m.OrderItem)
            .HasForeignKey(m => m.OrderItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
