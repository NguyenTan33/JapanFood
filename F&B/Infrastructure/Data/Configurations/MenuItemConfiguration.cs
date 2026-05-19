using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class MenuItemConfiguration : IEntityTypeConfiguration<MenuItem>
{
    public void Configure(EntityTypeBuilder<MenuItem> builder)
    {
        builder.ToTable("MENU_ITEMS", t =>
        {
            t.HasCheckConstraint("CK_MENU_ITEMS_BASE_PRICE", "[BASE_PRICE] >= 0");
            t.HasCheckConstraint("CK_MENU_ITEMS_ORIGINAL_PRICE", "[ORIGINAL_PRICE] IS NULL OR [ORIGINAL_PRICE] >= 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("MENU_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.CategoryId)
            .HasColumnName("CATEGORY_ID")
            .IsRequired();

        builder.Property(e => e.Code)
            .HasColumnName("CODE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Name)
            .HasColumnName("NAME")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.JapaneseName)
            .HasColumnName("JAPANESE_NAME")
            .HasMaxLength(200);

        builder.Property(e => e.Slug)
            .HasColumnName("SLUG")
            .HasMaxLength(200);

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(1000);

        builder.Property(e => e.BasePrice)
            .HasColumnName("BASE_PRICE")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.OriginalPrice)
            .HasColumnName("ORIGINAL_PRICE")
            .HasPrecision(18, 2);

        builder.Property(e => e.ImageUrl)
            .HasColumnName("IMAGE_URL")
            .HasMaxLength(500);

        builder.Property(e => e.Tags)
            .HasColumnName("TAGS")
            .HasMaxLength(1000);

        builder.Property(e => e.Ingredients)
            .HasColumnName("INGREDIENTS")
            .HasMaxLength(2000);

        builder.Property(e => e.SpiceLevel)
            .HasColumnName("SPICE_LEVEL")
            .HasDefaultValue(0);

        builder.Property(e => e.Calories)
            .HasColumnName("CALORIES");

        builder.Property(e => e.IsFeatured)
            .HasColumnName("IS_FEATURED")
            .HasDefaultValue(false);

        builder.Property(e => e.IsAvailable)
            .HasColumnName("IS_AVAILABLE")
            .HasDefaultValue(true);

        builder.Property(e => e.IsKitchenItem)
            .HasColumnName("IS_KITCHEN_ITEM")
            .HasDefaultValue(true);

        builder.Property(e => e.KitchenStation)
            .HasColumnName("KITCHEN_STATION")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.EstimatedPrepMinutes)
            .HasColumnName("ESTIMATED_PREP_MINUTES")
            .HasDefaultValue(10);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => e.Code)
            .IsUnique();

        builder.HasIndex(e => e.Slug)
            .IsUnique()
            .HasFilter("[SLUG] IS NOT NULL");

        builder.HasIndex(e => e.IsFeatured);
        builder.HasIndex(e => e.CategoryId);
        builder.HasIndex(e => e.KitchenStation);

        builder.HasOne(e => e.Category)
            .WithMany(c => c.MenuItems)
            .HasForeignKey(e => e.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(e => e.ModifierGroups)
            .WithOne(mg => mg.MenuItem)
            .HasForeignKey(mg => mg.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(e => e.Recipes)
            .WithOne(r => r.MenuItem)
            .HasForeignKey(r => r.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
