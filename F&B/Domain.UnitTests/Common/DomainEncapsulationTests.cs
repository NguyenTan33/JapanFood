using System.Collections;
using System.Reflection;
using Domain.Entities.Common;
using Domain.Exceptions;

namespace Domain.UnitTests.Common;

public class DomainEncapsulationTests
{
    private static IEnumerable<Type> GetDomainEntityTypes()
    {
        var domainAssembly = typeof(BaseEntity).Assembly;
        return domainAssembly.GetTypes()
            .Where(t => t.IsClass && !t.IsAbstract && typeof(BaseEntity).IsAssignableFrom(t))
            .OrderBy(t => t.FullName);
    }

    [Fact]
    public void AllDomainEntities_MustInheritFromBaseEntity()
    {
        var entityTypes = GetDomainEntityTypes().ToList();
        Assert.NotEmpty(entityTypes);
        // We have at least 20 F&B entities
        Assert.True(entityTypes.Count >= 20, $"Found {entityTypes.Count} entities, expected >= 20.");
    }

    [Fact]
    public void AllDomainEntities_MustHaveZeroPublicSettersOnProperties()
    {
        var entityTypes = GetDomainEntityTypes().ToList();
        var violations = new List<string>();

        foreach (var type in entityTypes)
        {
            var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
            foreach (var prop in properties)
            {
                if (prop.SetMethod != null && prop.SetMethod.IsPublic)
                {
                    violations.Add($"{type.Name}.{prop.Name} has a public setter");
                }
            }
        }

        Assert.True(
            violations.Count == 0,
            $"Found {violations.Count} properties with public setters violating domain encapsulation:\n" +
            string.Join("\n", violations));
    }

    [Fact]
    public void AllChildNavigationCollections_MustBeExposedAsIReadOnlyCollection()
    {
        var entityTypes = GetDomainEntityTypes().ToList();
        var violations = new List<string>();
        int totalCollectionPropertiesFound = 0;

        foreach (var type in entityTypes)
        {
            var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance);
            foreach (var prop in properties)
            {
                // Skip strings and byte arrays (concurrency tokens)
                if (prop.PropertyType == typeof(string) || prop.PropertyType == typeof(byte[]))
                    continue;

                // Check if property is a collection (implements IEnumerable)
                if (typeof(IEnumerable).IsAssignableFrom(prop.PropertyType))
                {
                    totalCollectionPropertiesFound++;
                    bool isIReadOnlyCollection = false;

                    if (prop.PropertyType.IsGenericType &&
                        prop.PropertyType.GetGenericTypeDefinition() == typeof(IReadOnlyCollection<>))
                    {
                        isIReadOnlyCollection = true;
                    }

                    if (!isIReadOnlyCollection)
                    {
                        violations.Add($"{type.Name}.{prop.Name} is of type {prop.PropertyType.Name}, expected IReadOnlyCollection<T>");
                    }
                }
            }
        }

        Assert.True(
            violations.Count == 0,
            $"Found {violations.Count} collection properties not exposed as IReadOnlyCollection<T>:\n" +
            string.Join("\n", violations));

        Assert.True(totalCollectionPropertiesFound > 0, "Expected to find child collection properties to verify.");
    }

    [Fact]
    public void BaseAuditableEntity_HelperMethods_ShouldSetAuditFieldsCorrectly()
    {
        var auditable = new ConcreteAuditableEntity();
        Assert.Null(auditable.CreatedByUserId);
        Assert.Null(auditable.UpdatedAt);
        Assert.Null(auditable.UpdatedByUserId);

        auditable.SetCreated(userId: 10);
        Assert.Equal(10, auditable.CreatedByUserId);

        auditable.SetUpdated(userId: 20);
        Assert.Equal(20, auditable.UpdatedByUserId);
        Assert.NotNull(auditable.UpdatedAt);

        var customTime = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        auditable.MarkCreated(userId: 30, timestamp: customTime);
        Assert.Equal(30, auditable.CreatedByUserId);
        Assert.Equal(customTime, auditable.CreatedAt);

        auditable.MarkUpdated(userId: 40, timestamp: customTime.AddHours(2));
        Assert.Equal(40, auditable.UpdatedByUserId);
        Assert.Equal(customTime.AddHours(2), auditable.UpdatedAt);
    }

    [Fact]
    public void DomainExceptions_ConstructorsAndMessages_ShouldRetainDetails()
    {
        var businessEx = new BusinessException("Business violation");
        Assert.Equal("Business violation", businessEx.Message);

        var inner = new InvalidOperationException("Inner error");
        var businessWithInner = new BusinessException("Wrap violation", inner);
        Assert.Equal("Wrap violation", businessWithInner.Message);
        Assert.Same(inner, businessWithInner.InnerException);

        var notFoundEx = new NotFoundException("Not found entity");
        Assert.Equal("Not found entity", notFoundEx.Message);

        var conflictEx = new ConflictException("Conflict detected");
        Assert.Equal("Conflict detected", conflictEx.Message);

        var forbiddenEx = new ForbiddenException("Access denied");
        Assert.Equal("Access denied", forbiddenEx.Message);
    }

    private class ConcreteAuditableEntity : BaseAuditableEntity
    {
    }
}
