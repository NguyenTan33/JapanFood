using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class PurchaseOrderItemConfiguration : IEntityTypeConfiguration<PurchaseOrderItem>
{
    public void Configure(EntityTypeBuilder<PurchaseOrderItem> builder)
    {
        builder.ToTable("PURCHASE_ORDER_ITEMS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("PO_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.PoId)
            .HasColumnName("PO_ID")
            .IsRequired();

        builder.Property(e => e.InventoryItemId)
            .HasColumnName("INVENTORY_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.QuantityOrdered)
            .HasColumnName("QUANTITY_ORDERED")
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(e => e.QuantityReceived)
            .HasColumnName("QUANTITY_RECEIVED")
            .HasPrecision(18, 4)
            .HasDefaultValue(0m);

        builder.Property(e => e.UnitPrice)
            .HasColumnName("UNIT_PRICE")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.LineTotal)
            .HasColumnName("LINE_TOTAL")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.HasIndex(e => e.PoId);
        builder.HasIndex(e => e.InventoryItemId);

        builder.HasOne(e => e.PurchaseOrder)
            .WithMany(p => p.Items)
            .HasForeignKey(e => e.PoId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.InventoryItem)
            .WithMany()
            .HasForeignKey(e => e.InventoryItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
