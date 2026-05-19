using Domain.Entities.Reviews;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Data.Configurations;

public class MenuItemReviewConfiguration : IEntityTypeConfiguration<MenuItemReview>
{
    public void Configure(EntityTypeBuilder<MenuItemReview> builder)
    {
        builder.ToTable("MENU_ITEM_REVIEWS", t =>
        {
            t.HasCheckConstraint("CK_REVIEW_RATING", "[RATING] >= 1 AND [RATING] <= 5");
        });

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id)
            .HasColumnName("REVIEW_ID")
            .ValueGeneratedOnAdd();

        builder.Property(e => e.UserId)
            .HasColumnName("USER_ID");

        builder.Property(e => e.MenuItemId)
            .HasColumnName("MENU_ITEM_ID");

        builder.Property(e => e.OrderId)
            .HasColumnName("ORDER_ID");

        builder.Property(e => e.Rating)
            .HasColumnName("RATING")
            .IsRequired();

        builder.Property(e => e.Comment)
            .HasColumnName("COMMENT")
            .HasMaxLength(1000);

        builder.Property(e => e.IsApproved)
            .HasColumnName("IS_APPROVED")
            .HasDefaultValue(false);

        builder.Property(e => e.ApprovedAt)
            .HasColumnName("APPROVED_AT");

        builder.Property(e => e.ApprovedByUserId)
            .HasColumnName("APPROVED_BY_USER_ID");

        builder.Property(e => e.RejectionReason)
            .HasColumnName("REJECTION_REASON")
            .HasMaxLength(500);

        builder.Property(e => e.LikesCount)
            .HasColumnName("LIKES_COUNT")
            .HasDefaultValue(0);

        builder.Property(e => e.ManagerReply)
            .HasColumnName("MANAGER_REPLY")
            .HasMaxLength(1000);

        builder.Property(e => e.RepliedAt)
            .HasColumnName("REPLIED_AT");

        builder.Property(e => e.RepliedByUserId)
            .HasColumnName("REPLIED_BY_USER_ID");

        builder.Property(e => e.CreatedAt)
            .HasColumnName("CREATED_AT")
            .HasDefaultValueSql("GETUTCDATE()");

        builder.Property(e => e.CreatedByUserId)
            .HasColumnName("CREATED_BY_USER_ID");

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("UPDATED_AT");

        builder.Property(e => e.UpdatedByUserId)
            .HasColumnName("UPDATED_BY_USER_ID");

        // Unique constraint: 1 user chỉ đánh giá 1 lần cho 1 món trong 1 đơn hàng (chống spam)
        builder.HasIndex(e => new { e.UserId, e.MenuItemId, e.OrderId })
            .IsUnique();

        builder.HasOne(e => e.User)
            .WithMany()
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.MenuItem)
            .WithMany()
            .HasForeignKey(e => e.MenuItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.Order)
            .WithMany()
            .HasForeignKey(e => e.OrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(e => e.ApprovedByUser)
            .WithMany()
            .HasForeignKey(e => e.ApprovedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.RepliedByUser)
            .WithMany()
            .HasForeignKey(e => e.RepliedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
