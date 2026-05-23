using Microsoft.Extensions.DependencyInjection;

namespace Application.Common.Validation;

public class ValidationFactory : IValidationFactory
{
    private readonly IServiceProvider _serviceProvider;

    public ValidationFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task ValidateAsync<TRequest>(TRequest request, CancellationToken cancellationToken = default)
    {
        var rules = _serviceProvider.GetServices<IValidationRule<TRequest>>();

        foreach (var rule in rules)
        {
            await rule.ValidateAsync(request, cancellationToken);
        }
    }
}
