using Domain.Entities.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class BranchConfiguration : IEntityTypeConfiguration<Branch>
{
    public void Configure(EntityTypeBuilder<Branch> builder)
    {
        builder.ToTable("BRANCHES");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("BRANCH_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.Code)
            .HasColumnName("CODE")
            .HasMaxLength(60)
            .IsRequired();

        builder.Property(e => e.Name)
            .HasColumnName("NAME")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.JapaneseName)
            .HasColumnName("JAPANESE_NAME")
            .HasMaxLength(200);

        builder.Property(e => e.Address)
            .HasColumnName("ADDRESS")
            .HasMaxLength(400)
            .IsRequired();

        builder.Property(e => e.District)
            .HasColumnName("DISTRICT")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.City)
            .HasColumnName("CITY")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.Phone)
            .HasColumnName("PHONE")
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.Hotline)
            .HasColumnName("HOTLINE")
            .HasMaxLength(30);

        builder.Property(e => e.Email)
            .HasColumnName("EMAIL")
            .HasMaxLength(150);

        builder.Property(e => e.OpeningHoursLunch)
            .HasColumnName("OPENING_HOURS_LUNCH")
            .HasMaxLength(100);

        builder.Property(e => e.OpeningHoursDinner)
            .HasColumnName("OPENING_HOURS_DINNER")
            .HasMaxLength(100);

        builder.Property(e => e.OpeningHoursNote)
            .HasColumnName("OPENING_HOURS_NOTE")
            .HasMaxLength(500);

        builder.Property(e => e.ParkingMotorbike)
            .HasColumnName("PARKING_MOTORBIKE")
            .HasMaxLength(500);

        builder.Property(e => e.ParkingCar)
            .HasColumnName("PARKING_CAR")
            .HasMaxLength(500);

        builder.Property(e => e.MapEmbedUrl)
            .HasColumnName("MAP_EMBED_URL")
            .HasMaxLength(1000);

        builder.Property(e => e.MapDirectionsUrl)
            .HasColumnName("MAP_DIRECTIONS_URL")
            .HasMaxLength(500);

        builder.Property(e => e.ImageUrl)
            .HasColumnName("IMAGE_URL")
            .HasMaxLength(500);

        builder.Property(e => e.IsMainBranch)
            .HasColumnName("IS_MAIN_BRANCH")
            .HasDefaultValue(false);

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

        builder.HasIndex(e => e.Code)
            .IsUnique();
    }
}
