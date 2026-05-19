using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> builder)
    {
        builder.ToTable("INVENTORY_ITEMS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("INVENTORY_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.Sku)
            .HasColumnName("SKU")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Name)
            .HasColumnName("NAME")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Category)
            .HasColumnName("CATEGORY")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.PrimaryUomId)
            .HasColumnName("PRIMARY_UOM_ID")
            .IsRequired();

        builder.Property(e => e.CurrentStock)
            .HasColumnName("CURRENT_STOCK")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

        builder.Property(e => e.MinimumStock)
            .HasColumnName("MINIMUM_STOCK")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

        builder.Property(e => e.UnitCost)
            .HasColumnName("UNIT_COST")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.StorageLocation)
            .HasColumnName("STORAGE_LOCATION")
            .HasMaxLength(100);

        builder.Property(e => e.IsActive)
            .HasColumnName("IS_ACTIVE")
            .HasDefaultValue(true);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => e.Sku)
            .IsUnique();

        builder.HasIndex(e => e.Category);
        builder.HasIndex(e => e.PrimaryUomId);

        builder.HasOne(e => e.PrimaryUom)
            .WithMany()
            .HasForeignKey(e => e.PrimaryUomId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Recipes)
            .WithOne(r => r.InventoryItem)
            .HasForeignKey(r => r.InventoryItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
