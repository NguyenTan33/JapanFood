using Domain.Entities.Kds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class KitchenTicketItemConfiguration : IEntityTypeConfiguration<KitchenTicketItem>
{
    public void Configure(EntityTypeBuilder<KitchenTicketItem> builder)
    {
        builder.ToTable("KITCHEN_TICKET_ITEMS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("TICKET_ITEM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.TicketId)
            .HasColumnName("TICKET_ID")
            .IsRequired();

        builder.Property(e => e.OrderItemId)
            .HasColumnName("ORDER_ITEM_ID")
            .IsRequired();

        builder.Property(e => e.StationId)
            .HasColumnName("STATION_ID")
            .IsRequired();

        builder.Property(e => e.MenuItemName)
            .HasColumnName("MENU_ITEM_NAME")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Quantity)
            .HasColumnName("QUANTITY")
            .IsRequired();

        builder.Property(e => e.ModifiersSummary)
            .HasColumnName("MODIFIERS_SUMMARY")
            .HasMaxLength(500);

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.CookingStartTime)
            .HasColumnName("COOKING_START_TIME");

        builder.Property(e => e.ReadyTime)
            .HasColumnName("READY_TIME");

        builder.Property(e => e.ServedTime)
            .HasColumnName("SERVED_TIME");

        builder.Property(e => e.CookUserId)
            .HasColumnName("COOK_USER_ID");

        builder.Property(e => e.CancellationReason)
            .HasColumnName("CANCELLATION_REASON")
            .HasMaxLength(500);

        builder.HasIndex(e => e.TicketId);
        builder.HasIndex(e => e.StationId);
        builder.HasIndex(e => e.Status);

        builder.HasOne(e => e.Ticket)
            .WithMany(t => t.Items)
            .HasForeignKey(e => e.TicketId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Station)
            .WithMany(s => s.TicketItems)
            .HasForeignKey(e => e.StationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.CookUser)
            .WithMany()
            .HasForeignKey(e => e.CookUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
