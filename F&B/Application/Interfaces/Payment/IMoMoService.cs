namespace Application.Interfaces.Payment;

public interface IMoMoService
{
    string CreateSignature(string rawData);
    bool ValidateSignature(string rawData, string signature);
}
