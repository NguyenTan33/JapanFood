using System.Reflection;
using Microsoft.Extensions.DependencyInjection;

namespace Application.Common.Validation;

public static class ValidationExtensions
{
    public static IServiceCollection AddAppValidation(this IServiceCollection services, params Assembly[] additionalAssemblies)
    {
        services.AddScoped<IValidationFactory, ValidationFactory>();

        var assemblies = new List<Assembly>
        {
            Assembly.GetExecutingAssembly(),
            typeof(IValidationFactory).Assembly
        };

        if (additionalAssemblies != null && additionalAssemblies.Length > 0)
        {
            assemblies.AddRange(additionalAssemblies);
        }

        foreach (var assembly in assemblies.Distinct())
        {
            var ruleTypes = assembly.GetTypes()
                .Where(t => !t.IsAbstract && !t.IsInterface)
                .SelectMany(
                    t => t.GetInterfaces(),
                    (implementationType, interfaceType) => new { implementationType, interfaceType }
                )
                .Where(x => x.interfaceType.IsGenericType &&
                            x.interfaceType.GetGenericTypeDefinition() == typeof(IValidationRule<>));

            foreach (var rule in ruleTypes)
            {
                services.AddScoped(rule.interfaceType, rule.implementationType);
            }
        }

        return services;
    }
}
