using Google.Apis.Auth;

namespace Application.Interfaces;

public interface IGoogleTokenValidator
{
    Task<GoogleJsonWebSignature.Payload> ValidateAsync(string idToken);
}
