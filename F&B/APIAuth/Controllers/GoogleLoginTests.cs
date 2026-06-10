using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class GoogleLoginTests : AuthControllerTestBase
{
    [Fact]
    public async Task GoogleLogin_WhenValidIdToken_ShouldReturnOkWithLoginResponse()
    {
        // Arrange
        var request = new GoogleLoginRequest
        {
            IdToken = "valid-google-id-token"
        };

        var expectedResponse = new LoginResponse
        {
            AccessToken = "google-access-token",
            RefreshToken = "google-refresh-token",
            ExpiresInMinutes = 60,
            User = new UserProfileDto
            {
                Id = 2,
                FullName = "Google User",
                Email = "googleuser@gmail.com",
                Role = "Customer"
            }
        };

        GoogleAuthServiceMock
            .Setup(s => s.GoogleLoginAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.GoogleLogin(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        GoogleAuthServiceMock.Verify(s => s.GoogleLoginAsync(request), Times.Once);
    }

    [Fact]
    public async Task GoogleLogin_WhenTokenInvalid_ShouldPropagateException()
    {
        // Arrange
        var request = new GoogleLoginRequest
        {
            IdToken = "invalid-token"
        };

        var errorMessage = "Google ID Token không hợp lệ.";
        GoogleAuthServiceMock
            .Setup(s => s.GoogleLoginAsync(request))
            .ThrowsAsync(new ArgumentException(errorMessage));

        // Act
        var act = async () => await Controller.GoogleLogin(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage(errorMessage);

        GoogleAuthServiceMock.Verify(s => s.GoogleLoginAsync(request), Times.Once);
    }
}
