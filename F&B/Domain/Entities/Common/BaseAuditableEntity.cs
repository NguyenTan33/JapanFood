namespace Domain.Entities.Common;

public abstract class BaseAuditableEntity : BaseEntity
{
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;
    public int? CreatedByUserId { get; protected set; }
    public DateTime? UpdatedAt { get; protected set; }
    public int? UpdatedByUserId { get; protected set; }

    public void SetCreated(int userId)
    {
        CreatedAt = DateTime.UtcNow;
        CreatedByUserId = userId;
    }

    public void SetUpdated(int userId)
    {
        UpdatedAt = DateTime.UtcNow;
        UpdatedByUserId = userId;
    }

    public void MarkCreated(int? userId, DateTime? timestamp = null)
    {
        CreatedByUserId = userId;
        CreatedAt = timestamp ?? DateTime.UtcNow;
    }

    public void MarkUpdated(int? userId, DateTime? timestamp = null)
    {
        UpdatedByUserId = userId;
        UpdatedAt = timestamp ?? DateTime.UtcNow;
    }
}
