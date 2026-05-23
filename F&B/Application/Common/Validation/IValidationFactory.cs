namespace Application.Common.Validation;

public interface IValidationFactory
{
    Task ValidateAsync<TRequest>(TRequest request, CancellationToken cancellationToken = default);
}
