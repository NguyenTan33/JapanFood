using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class LoginTests : AuthControllerTestBase
{
    [Fact]
    public async Task Login_WhenCredentialsAreValid_ShouldReturnOkWithLoginResponse()
    {
        // Arrange
        var request = new LoginRequest
        {
            PhoneNumber = "0987654321",
            Password = "SecurePassword@123"
        };

        var expectedResponse = new LoginResponse
        {
            AccessToken = "mocked-access-token",
            RefreshToken = "mocked-refresh-token",
            ExpiresInMinutes = 60,
            ExpiresAt = DateTime.UtcNow.AddMinutes(60),
            User = new UserProfileDto
            {
                Id = 1,
                FullName = "Nguyen Van A",
                PhoneNumber = "0987654321",
                Role = "Customer"
            }
        };

        AuthServiceMock
            .Setup(s => s.LoginAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.Login(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        AuthServiceMock.Verify(s => s.LoginAsync(request), Times.Once);
    }

    [Fact]
    public async Task Login_WhenInvalidCredentials_ShouldPropagateException()
    {
        // Arrange
        var request = new LoginRequest
        {
            PhoneNumber = "0987654321",
            Password = "WrongPassword"
        };

        var exceptionMessage = "Số điện thoại hoặc mật khẩu không chính xác.";
        AuthServiceMock
            .Setup(s => s.LoginAsync(request))
            .ThrowsAsync(new UnauthorizedAccessException(exceptionMessage));

        // Act
        var act = async () => await Controller.Login(request);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage(exceptionMessage);

        AuthServiceMock.Verify(s => s.LoginAsync(request), Times.Once);
    }
}
