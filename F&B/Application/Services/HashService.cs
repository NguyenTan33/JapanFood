using System.Security.Cryptography;
using System.Text;
using Application.Interfaces;

namespace Application.Services;

public class HashService : IHashService
{
    public string Hash(string value, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var valueBytes = Encoding.UTF8.GetBytes(value);
        var hash = hmac.ComputeHash(valueBytes);
        return Convert.ToHexString(hash);
    }

    public bool Verify(string value, string hash, string secret)
    {
        var expectedHash = Hash(value, secret);
        var expectedBytes = Convert.FromHexString(expectedHash);
        var actualBytes = Convert.FromHexString(hash);

        return CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
    }
}
