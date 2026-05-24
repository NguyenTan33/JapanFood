namespace Application.DTOs.Auth;

public class AdminUserDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string AccountStatus { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int LoyaltyPoints { get; set; } = 0;
    public string MembershipTier { get; set; } = "BRONZE";
    public decimal TotalSpent { get; set; } = 0;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class AdminUserListResponseDto
{
    public List<AdminUserDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
    public int TotalPages { get; set; }
}

public class AdminUserFilterDto
{
    public string? Search { get; set; }
    public string? Role { get; set; }
    public string? Status { get; set; }
    public bool? IsActive { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class CreateAdminUserRequestDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string Password { get; set; } = string.Empty;
    public string Role { get; set; } = "STAFF";
}

public class UpdateUserRoleRequestDto
{
    public string Role { get; set; } = string.Empty;
}

public class AdminResetPasswordRequestDto
{
    public string NewPassword { get; set; } = string.Empty;
}

public class UpdateCustomerRequestDto
{
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? MembershipTier { get; set; }
    public int? LoyaltyPoints { get; set; }
}

public class UpdateStaffUserRequestDto
{
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; }
    public string? AccountStatus { get; set; }
}
