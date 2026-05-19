using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> builder)
    {
        builder.ToTable("CATEGORIES");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("CATEGORY_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.CategoryCode)
            .HasColumnName("CATEGORY_CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.CategoryName)
            .HasColumnName("CATEGORY_NAME")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.JapaneseName)
            .HasColumnName("JAPANESE_NAME")
            .HasMaxLength(100);

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(500);

        builder.Property(e => e.IconName)
            .HasColumnName("ICON_NAME")
            .HasMaxLength(50);

        builder.Property(e => e.ImageUrl)
            .HasColumnName("IMAGE_URL")
            .HasMaxLength(500);

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

        builder.HasIndex(e => e.CategoryCode)
            .IsUnique();

        builder.HasMany(e => e.MenuItems)
            .WithOne(m => m.Category)
            .HasForeignKey(m => m.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
