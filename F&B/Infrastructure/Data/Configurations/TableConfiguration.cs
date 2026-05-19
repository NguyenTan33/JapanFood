using Domain.Entities.Menu;
using Domain.Entities.TableManagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class TableConfiguration : IEntityTypeConfiguration<Table>
{
    public void Configure(EntityTypeBuilder<Table> builder)
    {
        builder.ToTable("TABLES", t =>
        {
            t.HasCheckConstraint("CK_TABLES_CAPACITY", "[CAPACITY] > 0");
            t.HasCheckConstraint("CK_TABLES_MIN_CAPACITY", "[MIN_CAPACITY] > 0");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("TABLE_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.AreaId)
            .HasColumnName("AREA_ID")
            .IsRequired();

        builder.Property(e => e.TableNumber)
            .HasColumnName("TABLE_NUMBER")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Capacity)
            .HasColumnName("CAPACITY")
            .IsRequired();

        builder.Property(e => e.MinCapacity)
            .HasColumnName("MIN_CAPACITY")
            .HasDefaultValue(1);

        builder.Property(e => e.Status)
            .HasColumnName("STATUS")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(e => e.CurrentOrderId)
            .HasColumnName("CURRENT_ORDER_ID");

        builder.Property(e => e.MergedIntoTableId)
            .HasColumnName("MERGED_INTO_TABLE_ID");

        builder.Property(e => e.IsActive)
            .HasColumnName("IS_ACTIVE")
            .HasDefaultValue(true);

        builder.Property(e => e.SessionToken)
            .HasColumnName("SESSION_TOKEN")
            .HasMaxLength(64);

        builder.Property(e => e.PinCode)
            .HasColumnName("PIN_CODE")
            .HasMaxLength(10);

        builder.Property(e => e.PinCreatedAt)
            .HasColumnName("PIN_CREATED_AT");

        builder.Property(e => e.LastOrderAt)
            .HasColumnName("LAST_ORDER_AT");

        builder.Property(e => e.LastBellAt)
            .HasColumnName("LAST_BELL_AT");

        builder.Property(e => e.RowVersion)
            .HasColumnName("ROW_VERSION")
            .IsRowVersion();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => new { e.AreaId, e.TableNumber })
            .IsUnique();

        builder.HasIndex(e => e.Status);

        builder.HasOne(e => e.Area)
            .WithMany(a => a.Tables)
            .HasForeignKey(e => e.AreaId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany<Order>()
            .WithOne(o => o.Table)
            .HasForeignKey(o => o.TableId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.CurrentOrder)
            .WithMany()
            .HasForeignKey(e => e.CurrentOrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.MergedIntoTable)
            .WithMany(t => t.MergedChildren)
            .HasForeignKey(e => e.MergedIntoTableId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
