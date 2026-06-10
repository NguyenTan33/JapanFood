using System.Security.Claims;
using API.Controllers;
using Application.Interfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace APIAuth.Controllers;

public abstract class AuthControllerTestBase
{
    protected readonly Mock<IAuthenticationService> AuthServiceMock;
    protected readonly Mock<IOtpService> OtpServiceMock;
    protected readonly Mock<IPasswordService> PasswordServiceMock;
    protected readonly Mock<ITokenService> TokenServiceMock;
    protected readonly Mock<IGoogleAuthService> GoogleAuthServiceMock;
    protected readonly AuthController Controller;

    protected AuthControllerTestBase()
    {
        AuthServiceMock = new Mock<IAuthenticationService>();
        OtpServiceMock = new Mock<IOtpService>();
        PasswordServiceMock = new Mock<IPasswordService>();
        TokenServiceMock = new Mock<ITokenService>();
        GoogleAuthServiceMock = new Mock<IGoogleAuthService>();

        Controller = new AuthController(
            AuthServiceMock.Object,
            OtpServiceMock.Object,
            PasswordServiceMock.Object,
            TokenServiceMock.Object,
            GoogleAuthServiceMock.Object);
    }

    protected void SetAuthenticatedUser(string? customerId)
    {
        var claims = new List<Claim>();
        if (!string.IsNullOrEmpty(customerId))
        {
            claims.Add(new Claim(ClaimTypes.NameIdentifier, customerId));
        }

        var identity = new ClaimsIdentity(claims, "TestAuthType");
        var claimsPrincipal = new ClaimsPrincipal(identity);

        Controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = claimsPrincipal
            }
        };
    }
}
