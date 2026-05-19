using Domain.Entities.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ChecklistExecutionConfiguration : IEntityTypeConfiguration<ChecklistExecution>
{
    public void Configure(EntityTypeBuilder<ChecklistExecution> builder)
    {
        builder.ToTable("CHECKLIST_EXECUTIONS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("EXECUTION_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.ChecklistId)
            .HasColumnName("CHECKLIST_ID")
            .IsRequired();

        builder.Property(e => e.ShiftDate)
            .HasColumnName("SHIFT_DATE")
            .HasColumnType("date")
            .IsRequired();

        builder.Property(e => e.ShiftName)
            .HasColumnName("SHIFT_NAME")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.PerformerUserId)
            .HasColumnName("PERFORMER_USER_ID")
            .IsRequired();

        builder.Property(e => e.PerformerSignature)
            .HasColumnName("PERFORMER_SIGNATURE")
            .HasMaxLength(255);

        builder.Property(e => e.PerformedAt)
            .HasColumnName("PERFORMED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.ManagerUserId)
            .HasColumnName("MANAGER_USER_ID");

        builder.Property(e => e.ManagerSignature)
            .HasColumnName("MANAGER_SIGNATURE")
            .HasMaxLength(255);

        builder.Property(e => e.ApprovedAt)
            .HasColumnName("APPROVED_AT");

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.ManagerNotes)
            .HasColumnName("MANAGER_NOTES")
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

        builder.HasIndex(e => new { e.ChecklistId, e.ShiftDate });
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.PerformerUserId);
        builder.HasIndex(e => e.ManagerUserId);

        builder.HasOne(e => e.Checklist)
            .WithMany()
            .HasForeignKey(e => e.ChecklistId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.PerformerUser)
            .WithMany()
            .HasForeignKey(e => e.PerformerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.ManagerUser)
            .WithMany()
            .HasForeignKey(e => e.ManagerUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.Results)
            .WithOne(r => r.Execution)
            .HasForeignKey(r => r.ExecutionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
