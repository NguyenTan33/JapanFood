using Domain.Entities.Menu;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class MenuItemModifierGroupConfiguration : IEntityTypeConfiguration<MenuItemModifierGroup>
{
    public void Configure(EntityTypeBuilder<MenuItemModifierGroup> builder)
    {
        builder.ToTable("MENU_ITEM_MODIFIER_GROUPS");

        builder.HasKey(e => new { e.MenuItemId, e.ModifierGroupId });
        builder.Ignore(e => e.Id);

        builder.Property(e => e.MenuItemId)
            .HasColumnName("MENU_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.ModifierGroupId)
            .HasColumnName("MODIFIER_GROUP_ID")
            .IsRequired();

        builder.Property(e => e.DisplayOrder)
            .HasColumnName("DISPLAY_ORDER")
            .HasDefaultValue(0);

        builder.HasOne(e => e.MenuItem)
            .WithMany(m => m.ModifierGroups)
            .HasForeignKey(e => e.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.ModifierGroup)
            .WithMany()
            .HasForeignKey(e => e.ModifierGroupId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
