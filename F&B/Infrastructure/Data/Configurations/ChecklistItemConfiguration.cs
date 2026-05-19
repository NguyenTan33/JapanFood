using Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ChecklistItemConfiguration : IEntityTypeConfiguration<ChecklistItem>
{
    public void Configure(EntityTypeBuilder<ChecklistItem> builder)
    {
        builder.ToTable("CHECKLIST_ITEMS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("CHECKLIST_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ChecklistId)
            .HasColumnName("CHECKLIST_ID")
            .IsRequired();

        builder.Property(e => e.Section)
            .HasColumnName("SECTION")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.IsMandatory)
            .HasColumnName("IS_MANDATORY")
            .HasDefaultValue(true);

        builder.Property(e => e.DisplayOrder)
            .HasColumnName("DISPLAY_ORDER")
            .HasDefaultValue(0);

        builder.Property(e => e.ExpectedStandard)
            .HasColumnName("EXPECTED_STANDARD")
            .HasMaxLength(255);

        builder.HasIndex(e => new { e.ChecklistId, e.DisplayOrder });

        builder.HasOne(e => e.Checklist)
            .WithMany(c => c.Items)
            .HasForeignKey(e => e.ChecklistId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
