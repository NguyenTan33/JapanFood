using Domain.Entities.Kds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class KitchenTicketConfiguration : IEntityTypeConfiguration<KitchenTicket>
{
    public void Configure(EntityTypeBuilder<KitchenTicket> builder)
    {
        builder.ToTable("KITCHEN_TICKETS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("TICKET_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.OrderId)
            .HasColumnName("ORDER_ID")
            .IsRequired();

        builder.Property(e => e.TicketNumber)
            .HasColumnName("TICKET_NUMBER")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.TableName)
            .HasColumnName("TABLE_NAME")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.IsRush)
            .HasColumnName("IS_RUSH")
            .HasDefaultValue(false);

        builder.Property(e => e.Notes)
            .HasColumnName("NOTES")
            .HasMaxLength(500);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.ReadyAt)
            .HasColumnName("READY_AT");

        builder.Property(e => e.ServedAt)
            .HasColumnName("SERVED_AT");

        builder.HasIndex(e => e.TicketNumber)
            .IsUnique();

        builder.HasIndex(e => e.OrderId);
        builder.HasIndex(e => e.Status);

        builder.HasMany(e => e.Items)
            .WithOne(i => i.Ticket)
            .HasForeignKey(i => i.TicketId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
