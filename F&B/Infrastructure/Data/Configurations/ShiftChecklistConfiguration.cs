using Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ShiftChecklistConfiguration : IEntityTypeConfiguration<ShiftChecklist>
{
    public void Configure(EntityTypeBuilder<ShiftChecklist> builder)
    {
        builder.ToTable("SHIFT_CHECKLISTS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("CHECKLIST_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ChecklistType)
            .HasColumnName("CHECKLIST_TYPE")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.Title)
            .HasColumnName("TITLE")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(500);

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

        builder.HasIndex(e => e.ChecklistType);

        builder.HasMany(e => e.Items)
            .WithOne(i => i.Checklist)
            .HasForeignKey(i => i.ChecklistId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
