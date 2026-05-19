using Domain.Entities.Content;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class BlogPostConfiguration : IEntityTypeConfiguration<BlogPost>
{
    public void Configure(EntityTypeBuilder<BlogPost> builder)
    {
        builder.ToTable("BLOG_POSTS");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("BLOG_POST_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.Slug)
            .HasColumnName("SLUG")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Title)
            .HasColumnName("TITLE")
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(e => e.Subtitle)
            .HasColumnName("SUBTITLE")
            .HasMaxLength(500);

        builder.Property(e => e.JapaneseTitle)
            .HasColumnName("JAPANESE_TITLE")
            .HasMaxLength(200);

        builder.Property(e => e.Category)
            .HasColumnName("CATEGORY")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.Excerpt)
            .HasColumnName("EXCERPT")
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(e => e.Content)
            .HasColumnName("CONTENT")
            .IsRequired();

        builder.Property(e => e.CoverImageUrl)
            .HasColumnName("COVER_IMAGE_URL")
            .HasMaxLength(500);

        builder.Property(e => e.AuthorName)
            .HasColumnName("AUTHOR_NAME")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(e => e.AuthorRole)
            .HasColumnName("AUTHOR_ROLE")
            .HasMaxLength(150);

        builder.Property(e => e.AuthorAvatarUrl)
            .HasColumnName("AUTHOR_AVATAR_URL")
            .HasMaxLength(500);

        builder.Property(e => e.PublishedAt)
            .HasColumnName("PUBLISHED_AT")
            .IsRequired();

        builder.Property(e => e.ReadTimeMinutes)
            .HasColumnName("READ_TIME_MINUTES")
            .HasDefaultValue(5);

        builder.Property(e => e.Tags)
            .HasColumnName("TAGS")
            .HasMaxLength(1000);

        builder.Property(e => e.RelatedDishIds)
            .HasColumnName("RELATED_DISH_IDS")
            .HasMaxLength(500);

        builder.Property(e => e.IsPublished)
            .HasColumnName("IS_PUBLISHED")
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

        builder.HasIndex(e => e.Slug)
            .IsUnique();

        builder.HasIndex(e => e.IsPublished);
    }
}
