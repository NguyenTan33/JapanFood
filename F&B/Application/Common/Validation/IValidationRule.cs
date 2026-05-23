namespace Application.Common.Validation;

public interface IValidationRule<in TRequest>
{
    Task ValidateAsync(TRequest request, CancellationToken cancellationToken = default);
}
