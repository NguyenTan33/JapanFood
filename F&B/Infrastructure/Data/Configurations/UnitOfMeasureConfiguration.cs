using Domain.Entities.Inventory;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class UnitOfMeasureConfiguration : IEntityTypeConfiguration<UnitOfMeasure>
{
    public void Configure(EntityTypeBuilder<UnitOfMeasure> builder)
    {
        builder.ToTable("UNITS_OF_MEASURE");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("UOM_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.Code)
            .HasColumnName("CODE")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.Name)
            .HasColumnName("NAME")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.BaseUomId)
            .HasColumnName("BASE_UOM_ID");

        builder.Property(e => e.ConversionFactor)
            .HasColumnName("CONVERSION_FACTOR")
            .HasPrecision(18, 4)
            .HasDefaultValue(1.0000m);

        builder.Property(e => e.IsActive)
            .HasColumnName("IS_ACTIVE")
            .HasDefaultValue(true);

        builder.HasIndex(e => e.Code)
            .IsUnique();

        builder.HasOne(e => e.BaseUom)
            .WithMany()
            .HasForeignKey(e => e.BaseUomId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
