using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class PurchaseOrderConfiguration : IEntityTypeConfiguration<PurchaseOrder>
{
    public void Configure(EntityTypeBuilder<PurchaseOrder> builder)
    {
        builder.ToTable("PURCHASE_ORDERS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("PO_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.PoNumber)
            .HasColumnName("PO_NUMBER")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.SupplierId)
            .HasColumnName("SUPPLIER_ID")
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.OrderDate)
            .HasColumnName("ORDER_DATE")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.ExpectedDeliveryDate)
            .HasColumnName("EXPECTED_DELIVERY_DATE");

        builder.Property(e => e.ReceivedDate)
            .HasColumnName("RECEIVED_DATE");

        builder.Property(e => e.ApprovedByUserId)
            .HasColumnName("APPROVED_BY_USER_ID");

        builder.Property(e => e.TotalAmount)
            .HasColumnName("TOTAL_AMOUNT")
            .HasPrecision(18, 2)
            .HasDefaultValue(0m);

        builder.Property(e => e.Notes)
            .HasColumnName("NOTES")
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

        builder.HasIndex(e => e.PoNumber)
            .IsUnique();

        builder.HasIndex(e => e.SupplierId);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedByUserId);
        builder.HasIndex(e => e.ApprovedByUserId);

        builder.HasOne(e => e.Supplier)
            .WithMany(s => s.PurchaseOrders)
            .HasForeignKey(e => e.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.CreatedByUser)
            .WithMany()
            .HasForeignKey(e => e.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.ApprovedByUser)
            .WithMany()
            .HasForeignKey(e => e.ApprovedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Items)
            .WithOne(i => i.PurchaseOrder)
            .HasForeignKey(i => i.PoId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
