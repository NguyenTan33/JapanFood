using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class InventoryAuditItemConfiguration : IEntityTypeConfiguration<InventoryAuditItem>
{
    public void Configure(EntityTypeBuilder<InventoryAuditItem> builder)
    {
        builder.ToTable("INVENTORY_AUDIT_ITEMS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("AUDIT_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.AuditId)
            .HasColumnName("AUDIT_ID")
            .IsRequired();

        builder.Property(e => e.InventoryItemId)
            .HasColumnName("INVENTORY_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.SystemExpectedQuantity)
            .HasColumnName("SYSTEM_EXPECTED_QUANTITY")
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(e => e.ActualQuantity)
            .HasColumnName("ACTUAL_QUANTITY")
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(e => e.DiscrepancyQuantity)
            .HasColumnName("DISCREPANCY_QUANTITY")
            .HasPrecision(18, 4)
            .IsRequired();

        builder.Property(e => e.Reason)
            .HasColumnName("REASON")
            .HasMaxLength(500);

        builder.HasIndex(e => e.AuditId);
        builder.HasIndex(e => e.InventoryItemId);

        builder.HasOne(e => e.Audit)
            .WithMany(a => a.Items)
            .HasForeignKey(e => e.AuditId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.InventoryItem)
            .WithMany()
            .HasForeignKey(e => e.InventoryItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
