using Domain.Entities.TableManagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TableAreaConfiguration : IEntityTypeConfiguration<TableArea>
{
    public void Configure(EntityTypeBuilder<TableArea> builder)
    {
        builder.ToTable("TABLE_AREAS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("AREA_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.AreaCode)
            .HasColumnName("AREA_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.AreaName)
            .HasColumnName("AREA_NAME")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.JapaneseName)
            .HasColumnName("JAPANESE_NAME")
            .HasMaxLength(100);

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(500);

        builder.Property(e => e.ImageUrl)
            .HasColumnName("IMAGE_URL")
            .HasMaxLength(500);

        builder.Property(e => e.Features)
            .HasColumnName("FEATURES")
            .HasMaxLength(2000);

        builder.Property(e => e.CapacityPerTable)
            .HasColumnName("CAPACITY_PER_TABLE")
            .HasMaxLength(100);

        builder.Property(e => e.MinGuests)
            .HasColumnName("MIN_GUESTS")
            .HasDefaultValue(1);

        builder.Property(e => e.MaxGuests)
            .HasColumnName("MAX_GUESTS")
            .HasDefaultValue(10);

        builder.Property(e => e.RequiresDeposit)
            .HasColumnName("REQUIRES_DEPOSIT")
            .HasDefaultValue(false);

        builder.Property(e => e.DepositPerGuest)
            .HasColumnName("DEPOSIT_PER_GUEST")
            .HasPrecision(18, 2);

        builder.Property(e => e.IsActive)
            .HasColumnName("IS_ACTIVE")
            .HasDefaultValue(true);

        builder.Property(e => e.DisplayOrder)
            .HasColumnName("DISPLAY_ORDER")
            .HasDefaultValue(0);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => e.AreaCode)
            .IsUnique();

        builder.HasMany(e => e.Tables)
            .WithOne(t => t.Area)
            .HasForeignKey(t => t.AreaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
