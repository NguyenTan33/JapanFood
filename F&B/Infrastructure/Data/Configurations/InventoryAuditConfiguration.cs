using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class InventoryAuditConfiguration : IEntityTypeConfiguration<InventoryAudit>
{
    public void Configure(EntityTypeBuilder<InventoryAudit> builder)
    {
        builder.ToTable("INVENTORY_AUDITS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("AUDIT_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.AuditNumber)
            .HasColumnName("AUDIT_NUMBER")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.AuditDate)
            .HasColumnName("AUDIT_DATE")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.AuditorUserId)
            .HasColumnName("AUDITOR_USER_ID")
            .IsRequired();

        builder.Property(e => e.ApprovedByUserId)
            .HasColumnName("APPROVED_BY_USER_ID");

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.ApprovedAt)
            .HasColumnName("APPROVED_AT");

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

        builder.HasIndex(e => e.AuditNumber)
            .IsUnique();

        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.AuditorUserId);
        builder.HasIndex(e => e.ApprovedByUserId);

        builder.HasOne(e => e.AuditorUser)
            .WithMany()
            .HasForeignKey(e => e.AuditorUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.ApprovedByUser)
            .WithMany()
            .HasForeignKey(e => e.ApprovedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Items)
            .WithOne(i => i.Audit)
            .HasForeignKey(i => i.AuditId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
