using Domain.Entities.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class BranchWifiConfigConfiguration : IEntityTypeConfiguration<BranchWifiConfig>
{
    public void Configure(EntityTypeBuilder<BranchWifiConfig> builder)
    {
        builder.ToTable("BRANCH_WIFI_CONFIGS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("ID").ValueGeneratedOnAdd();
        builder.Property(e => e.BranchId).HasColumnName("BRANCH_ID").IsRequired();
        builder.Property(e => e.Ssid).HasColumnName("SSID").HasMaxLength(100).IsRequired();
        builder.Property(e => e.Bssid).HasColumnName("BSSID").HasMaxLength(50);
        builder.Property(e => e.PublicIpSubnet).HasColumnName("PUBLIC_IP_SUBNET").HasMaxLength(100);
        builder.Property(e => e.Description).HasColumnName("DESCRIPTION").HasMaxLength(255);
        builder.Property(e => e.IsActive).HasColumnName("IS_ACTIVE").HasDefaultValue(true);

        builder.Property(e => e.CreatedAt).HasColumnName("CREATED_AT").HasDefaultValueSql("GETUTCDATE()");
        builder.Property(e => e.UpdatedAt).HasColumnName("UPDATED_AT");
        builder.Property(e => e.CreatedByUserId).HasColumnName("CREATED_BY_USER_ID");
        builder.Property(e => e.UpdatedByUserId).HasColumnName("UPDATED_BY_USER_ID");

        builder.HasOne(e => e.Branch)
            .WithMany()
            .HasForeignKey(e => e.BranchId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(e => new { e.BranchId, e.Ssid });
    }
}
