using Domain.Entities.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class RestaurantSettingConfiguration : IEntityTypeConfiguration<RestaurantSetting>
{
    public void Configure(EntityTypeBuilder<RestaurantSetting> builder)
    {
        builder.ToTable("RESTAURANT_SETTINGS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("RESTAURANT_SETTING_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.SettingKey)
            .HasColumnName("SETTING_KEY")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.BrandName)
            .HasColumnName("BRAND_NAME")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.JapaneseName)
            .HasColumnName("JAPANESE_NAME")
            .HasMaxLength(200);

        builder.Property(e => e.Slogan)
            .HasColumnName("SLOGAN")
            .HasMaxLength(500);

        builder.Property(e => e.Hotline)
            .HasColumnName("HOTLINE")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Email)
            .HasColumnName("EMAIL")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(e => e.FacebookUrl)
            .HasColumnName("FACEBOOK_URL")
            .HasMaxLength(300);

        builder.Property(e => e.InstagramUrl)
            .HasColumnName("INSTAGRAM_URL")
            .HasMaxLength(300);

        builder.Property(e => e.BankName)
            .HasColumnName("BANK_NAME")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.BankId)
            .HasColumnName("BANK_ID")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.AccountNumber)
            .HasColumnName("ACCOUNT_NUMBER")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.AccountName)
            .HasColumnName("ACCOUNT_NAME")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.BankBranch)
            .HasColumnName("BANK_BRANCH")
            .HasMaxLength(200);

        builder.Property(e => e.DefaultQrTemplate)
            .HasColumnName("DEFAULT_QR_TEMPLATE")
            .HasMaxLength(50)
            .HasDefaultValue("compact2");

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        builder.HasIndex(e => e.SettingKey)
            .IsUnique();
    }
}
