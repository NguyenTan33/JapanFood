namespace Domain.Entities;

public class UserAddress
{
    public int AddressId { get; set; }
    public int UserId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string StreetAddress { get; set; } = string.Empty;
    public string Ward { get; set; } = string.Empty;
    public string District { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string IsDefault { get; set; } = "N";

    public virtual User? User { get; set; }
}
