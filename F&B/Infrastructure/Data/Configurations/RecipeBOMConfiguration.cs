using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class RecipeBOMConfiguration : IEntityTypeConfiguration<RecipeBOM>
{
    public void Configure(EntityTypeBuilder<RecipeBOM> builder)
    {
        builder.ToTable("RECIPE_BOM");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("BOM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.MenuItemId)
            .HasColumnName("MENU_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.InventoryItemId)
            .HasColumnName("INVENTORY_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.QuantityRequired)
            .HasColumnName("QUANTITY_REQUIRED")
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(e => e.UomId)
            .HasColumnName("UOM_ID")
            .IsRequired();

        builder.Property(e => e.WastagePercentage)
            .HasColumnName("WASTAGE_PERCENTAGE")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

        builder.Property(e => e.PreparationNotes)
            .HasColumnName("PREPARATION_NOTES")
            .HasMaxLength(255);

        builder.HasIndex(e => new { e.MenuItemId, e.InventoryItemId })
            .IsUnique();

        builder.HasOne(e => e.MenuItem)
            .WithMany(m => m.Recipes)
            .HasForeignKey(e => e.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.InventoryItem)
            .WithMany(i => i.Recipes)
            .HasForeignKey(e => e.InventoryItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.Uom)
            .WithMany()
            .HasForeignKey(e => e.UomId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
