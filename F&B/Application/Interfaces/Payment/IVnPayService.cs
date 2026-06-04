namespace Application.Interfaces.Payment;

public interface IVnPayService
{
    string CreatePaymentUrl(string transactionNumber, decimal amount, string orderInfo, string returnUrl, string ipAddress);
    bool ValidateSignature(IDictionary<string, string> queryParameters, string secureHash);
}
