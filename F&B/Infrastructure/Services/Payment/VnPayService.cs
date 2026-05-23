using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Application.Interfaces.Payment;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.Services.Payment;

public class VnPayService : IVnPayService
{
    private readonly IConfiguration _configuration;

    public VnPayService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string CreatePaymentUrl(string transactionNumber, decimal amount, string orderInfo, string returnUrl, string ipAddress)
    {
        var vnpUrl = _configuration["VnPay:BaseUrl"] ?? "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
        var tmnCode = _configuration["VnPay:TmnCode"] ?? "JAPANFOOD01";
        var hashSecret = _configuration["VnPay:HashSecret"] ?? "JAPANFOOD_VNPAY_HASH_SECRET_KEY_2026";

        var vnpParams = new SortedList<string, string>(new VnPayCompare())
        {
            { "vnp_Version", "2.1.0" },
            { "vnp_Command", "pay" },
            { "vnp_TmnCode", tmnCode },
            { "vnp_Amount", ((long)(amount * 100)).ToString(CultureInfo.InvariantCulture) }, // In cents
            { "vnp_CreateDate", DateTime.UtcNow.AddHours(7).ToString("yyyyMMddHHmmss") }, // GMT+7
            { "vnp_CurrCode", "VND" },
            { "vnp_IpAddr", string.IsNullOrWhiteSpace(ipAddress) ? "127.0.0.1" : ipAddress },
            { "vnp_Locale", "vn" },
            { "vnp_OrderInfo", string.IsNullOrWhiteSpace(orderInfo) ? $"Thanh toan don hang {transactionNumber}" : orderInfo },
            { "vnp_OrderType", "other" },
            { "vnp_ReturnUrl", returnUrl },
            { "vnp_TxnRef", transactionNumber },
            { "vnp_ExpireDate", DateTime.UtcNow.AddHours(7).AddMinutes(15).ToString("yyyyMMddHHmmss") }
        };

        var data = new StringBuilder();
        foreach (var (key, value) in vnpParams)
        {
            if (!string.IsNullOrEmpty(value))
            {
                data.Append(WebUtility.UrlEncode(key) + "=" + WebUtility.UrlEncode(value) + "&");
            }
        }

        var queryString = data.ToString().TrimEnd('&');
        var signData = queryString;
        var vnpSecureHash = HmacSha512(hashSecret, signData);

        return $"{vnpUrl}?{queryString}&vnp_SecureHash={vnpSecureHash}";
    }

    public bool ValidateSignature(IDictionary<string, string> queryParameters, string secureHash)
    {
        var hashSecret = _configuration["VnPay:HashSecret"] ?? "JAPANFOOD_VNPAY_HASH_SECRET_KEY_2026";
        var sortedParams = new SortedList<string, string>(new VnPayCompare());

        foreach (var (key, value) in queryParameters)
        {
            if (!string.IsNullOrEmpty(key) && key.StartsWith("vnp_", StringComparison.OrdinalIgnoreCase))
            {
                if (!key.Equals("vnp_SecureHash", StringComparison.OrdinalIgnoreCase) &&
                    !key.Equals("vnp_SecureHashType", StringComparison.OrdinalIgnoreCase))
                {
                    sortedParams.Add(key, value);
                }
            }
        }

        var data = new StringBuilder();
        foreach (var (key, value) in sortedParams)
        {
            if (!string.IsNullOrEmpty(value))
            {
                data.Append(WebUtility.UrlEncode(key) + "=" + WebUtility.UrlEncode(value) + "&");
            }
        }

        var signData = data.ToString().TrimEnd('&');
        var checkHash = HmacSha512(hashSecret, signData);

        return checkHash.Equals(secureHash, StringComparison.OrdinalIgnoreCase);
    }

    private static string HmacSha512(string key, string inputData)
    {
        var keyBytes = Encoding.UTF8.GetBytes(key);
        var inputBytes = Encoding.UTF8.GetBytes(inputData);
        using var hmac = new HMACSHA512(keyBytes);
        var hashValue = hmac.ComputeHash(inputBytes);
        return Convert.ToHexStringLower(hashValue);
    }

    private class VnPayCompare : IComparer<string>
    {
        public int Compare(string? x, string? y)
        {
            if (x == y) return 0;
            if (x == null) return -1;
            if (y == null) return 1;
            return string.CompareOrdinal(x, y);
        }
    }
}
