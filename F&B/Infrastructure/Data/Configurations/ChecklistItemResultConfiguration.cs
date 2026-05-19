using Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ChecklistItemResultConfiguration : IEntityTypeConfiguration<ChecklistItemResult>
{
    public void Configure(EntityTypeBuilder<ChecklistItemResult> builder)
    {
        builder.ToTable("CHECKLIST_ITEM_RESULTS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("RESULT_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ExecutionId)
            .HasColumnName("EXECUTION_ID")
            .IsRequired();

        builder.Property(e => e.ChecklistItemId)
            .HasColumnName("CHECKLIST_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.IsPassed)
            .HasColumnName("IS_PASSED")
            .IsRequired();

        builder.Property(e => e.ActualValue)
            .HasColumnName("ACTUAL_VALUE")
            .HasMaxLength(255);

        builder.Property(e => e.PhotoUrl)
            .HasColumnName("PHOTO_URL")
            .HasMaxLength(500);

        builder.Property(e => e.Remarks)
            .HasColumnName("REMARKS")
            .HasMaxLength(500);

        builder.HasIndex(e => new { e.ExecutionId, e.ChecklistItemId });

        builder.HasOne(e => e.Execution)
            .WithMany(ex => ex.Results)
            .HasForeignKey(e => e.ExecutionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.ChecklistItem)
            .WithMany()
            .HasForeignKey(e => e.ChecklistItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
