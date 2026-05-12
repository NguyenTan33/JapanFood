namespace Domain.Entities;

public class User
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public int LoyaltyPoints { get; set; } = 0;
    public string MembershipTier { get; set; } = "BRONZE";
    public string AccountStatus { get; set; } = "ACTIVE";
    public string Role { get; set; } = "CUSTOMER";
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }

    public virtual ICollection<UserAddress> Addresses { get; set; } = new List<UserAddress>();
    public virtual ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
}
