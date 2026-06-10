using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class RefreshTokenTests : AuthControllerTestBase
{
    [Fact]
    public async Task RefreshToken_WhenTokenIsValid_ShouldReturnOkWithTokenResponse()
    {
        // Arrange
        var request = new RefreshTokenRequest
        {
            RefreshToken = "existing-valid-refresh-token"
        };

        var expectedResponse = new RefreshTokenResponse
        {
            AccessToken = "new-refreshed-access-token",
            RefreshToken = "new-refresh-token",
            ExpiresInMinutes = 60,
            ExpiresAt = DateTime.UtcNow.AddMinutes(60)
        };

        TokenServiceMock
            .Setup(s => s.RefreshTokenAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.RefreshToken(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        TokenServiceMock.Verify(s => s.RefreshTokenAsync(request), Times.Once);
    }

    [Fact]
    public async Task RefreshToken_WhenTokenIsExpiredOrRevoked_ShouldPropagateException()
    {
        // Arrange
        var request = new RefreshTokenRequest
        {
            RefreshToken = "expired-token"
        };

        var errorMessage = "Refresh token đã hết hạn hoặc không hợp lệ.";
        TokenServiceMock
            .Setup(s => s.RefreshTokenAsync(request))
            .ThrowsAsync(new UnauthorizedAccessException(errorMessage));

        // Act
        var act = async () => await Controller.RefreshToken(request);

        // Assert
        await act.Should().ThrowAsync<UnauthorizedAccessException>()
            .WithMessage(errorMessage);

        TokenServiceMock.Verify(s => s.RefreshTokenAsync(request), Times.Once);
    }
}
