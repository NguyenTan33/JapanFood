using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class SupplierConfiguration : IEntityTypeConfiguration<Supplier>
{
    public void Configure(EntityTypeBuilder<Supplier> builder)
    {
        builder.ToTable("SUPPLIERS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("SUPPLIER_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.SupplierCode)
            .HasColumnName("SUPPLIER_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Name)
            .HasColumnName("NAME")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.ContactPerson)
            .HasColumnName("CONTACT_PERSON")
            .HasMaxLength(100);

        builder.Property(e => e.PhoneNumber)
            .HasColumnName("PHONE_NUMBER")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.Email)
            .HasColumnName("EMAIL")
            .HasMaxLength(100);

        builder.Property(e => e.Address)
            .HasColumnName("ADDRESS")
            .HasMaxLength(500);

        builder.Property(e => e.TaxCode)
            .HasColumnName("TAX_CODE")
            .HasMaxLength(50);

        builder.Property(e => e.PaymentTerms)
            .HasColumnName("PAYMENT_TERMS")
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

        builder.HasIndex(e => e.SupplierCode)
            .IsUnique();

        builder.HasMany(e => e.PurchaseOrders)
            .WithOne(po => po.Supplier)
            .HasForeignKey(po => po.SupplierId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
