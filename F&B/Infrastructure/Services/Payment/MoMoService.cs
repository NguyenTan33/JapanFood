using System.Security.Cryptography;
using System.Text;
using Application.Interfaces.Payment;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Services.Payment;

public class MoMoService : IMoMoService
{
    private readonly IConfiguration _configuration;

    public MoMoService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string CreateSignature(string rawData)
    {
        var secretKey = _configuration["MoMo:SecretKey"] ?? "JAPANFOOD_MOMO_SECRET_KEY_2026";
        var keyBytes = Encoding.UTF8.GetBytes(secretKey);
        var messageBytes = Encoding.UTF8.GetBytes(rawData);

        using var hmac = new HMACSHA256(keyBytes);
        var hashBytes = hmac.ComputeHash(messageBytes);
        return Convert.ToHexStringLower(hashBytes);
    }

    public bool ValidateSignature(string rawData, string signature)
    {
        var expectedSignature = CreateSignature(rawData);
        return expectedSignature.Equals(signature, StringComparison.OrdinalIgnoreCase);
    }
}
