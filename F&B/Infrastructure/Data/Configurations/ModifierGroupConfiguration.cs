using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class ModifierGroupConfiguration : IEntityTypeConfiguration<ModifierGroup>
{
    public void Configure(EntityTypeBuilder<ModifierGroup> builder)
    {
        builder.ToTable("MODIFIER_GROUPS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("MODIFIER_GROUP_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.GroupCode)
            .HasColumnName("GROUP_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.GroupName)
            .HasColumnName("GROUP_NAME")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(500);

        builder.Property(e => e.MinSelection)
            .HasColumnName("MIN_SELECTION")
            .HasDefaultValue(0);

        builder.Property(e => e.MaxSelection)
            .HasColumnName("MAX_SELECTION")
            .HasDefaultValue(1);

        builder.Property(e => e.DisplayOrder)
            .HasColumnName("DISPLAY_ORDER")
            .HasDefaultValue(0);

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

        builder.Ignore(e => e.IsRequired);
        builder.Ignore(e => e.IsMultiple);

        builder.HasIndex(e => e.GroupCode)
            .IsUnique();

        builder.HasMany(e => e.Options)
            .WithOne(o => o.ModifierGroup)
            .HasForeignKey(o => o.ModifierGroupId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
