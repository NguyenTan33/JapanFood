namespace Application.Interfaces.Repositories;

public interface IInventoryQueryRepository
{
    Task DeductInventoryForCompletedOrderAsync(
        int orderId,
        int staffUserId,
        CancellationToken ct = default);
}
