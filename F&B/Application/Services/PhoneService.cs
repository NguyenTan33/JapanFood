using System.Text.RegularExpressions;
using Application.Interfaces;

namespace Application.Services;

public class PhoneService : IPhoneService
{
    public bool IsValid(string phoneNumber)
    {
        if (string.IsNullOrWhiteSpace(phoneNumber))
        {
            return false;
        }

        return Regex.IsMatch(phoneNumber, @"^\+84(3|5|7|8|9)\d{8}$");
    }

    public string Normalize(string phoneNumber)
    {
        var phone = phoneNumber.Trim().Replace(" ", "").Replace("-", "").Replace(".", "");

        if (phone.StartsWith("+84"))
        {
            return phone;
        }

        if (phone.StartsWith("84") && phone.Length == 11)
        {
            return "+" + phone;
        }

        if (phone.StartsWith("0"))
        {
            return "+84" + phone.Substring(1);
        }

        return phone;
    }
}
