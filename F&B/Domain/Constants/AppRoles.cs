namespace Domain.Constants;

public static class AppRoles
{
    public const string Admin = "ADMIN";
    public const string Manager = "MANAGER";
    public const string Staff = "STAFF";
    public const string Kitchen = "KITCHEN";
    public const string Customer = "CUSTOMER";

    public static readonly string[] All = { Admin, Manager, Staff, Kitchen, Customer };

    public static bool IsValidRole(string role)
    {
        return !string.IsNullOrWhiteSpace(role) &&
               All.Any(r => r.Equals(role.Trim(), StringComparison.OrdinalIgnoreCase));
    }

    public static string Normalize(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
            return Customer;

        var upper = role.Trim().ToUpperInvariant();
        return All.Contains(upper) ? upper : Customer;
    }
}
