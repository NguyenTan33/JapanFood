using Domain.Entities.Kds;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class KitchenStationConfiguration : IEntityTypeConfiguration<KitchenStation>
{
    public void Configure(EntityTypeBuilder<KitchenStation> builder)
    {
        builder.ToTable("KITCHEN_STATIONS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("STATION_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.Name)
            .HasColumnName("NAME")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.StationType)
            .HasColumnName("STATION_TYPE")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasColumnName("DESCRIPTION")
            .HasMaxLength(255);

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

        builder.HasIndex(e => e.StationType);

        builder.HasMany(e => e.TicketItems)
            .WithOne(i => i.Station)
            .HasForeignKey(i => i.StationId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
