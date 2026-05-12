namespace Domain.Entities.Common;

public interface ISoftDelete
{
    bool IsDeleted { get; }
    DateTime? DeletedAt { get; }
    int? DeletedByUserId { get; }

    void MarkDeleted(int? userId = null);
    void UndoDeleted();
}
