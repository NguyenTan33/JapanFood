namespace Application.Interfaces;

public interface IPhoneService
{
    bool IsValid(string phoneNumber);
    string Normalize(string phoneNumber);
}
