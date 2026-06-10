using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class LogoutTests : AuthControllerTestBase
{
    [Fact]
    public async Task Logout_WhenValidRequest_ShouldReturnOkWithSuccessMessage()
    {
        // Arrange
        var request = new LogoutRequest
        {
            RefreshToken = "valid-refresh-token-to-revoke"
        };

        AuthServiceMock
            .Setup(s => s.LogoutAsync(request))
            .Returns(Task.CompletedTask);

        // Act
        var result = await Controller.Logout(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);

        // Inspect anonymous object value
        var responseValue = okResult.Value;
        responseValue.Should().NotBeNull();

        var statusCodeProp = responseValue!.GetType().GetProperty("statusCode")?.GetValue(responseValue);
        var messageProp = responseValue.GetType().GetProperty("message")?.GetValue(responseValue);

        statusCodeProp.Should().Be(StatusCodes.Status200OK);
        messageProp.Should().Be("Đăng xuất thành công.");

        AuthServiceMock.Verify(s => s.LogoutAsync(request), Times.Once);
    }

    [Fact]
    public async Task Logout_WhenServiceThrowsException_ShouldPropagateException()
    {
        // Arrange
        var request = new LogoutRequest
        {
            RefreshToken = "invalid-token"
        };

        var errorMessage = "Lỗi khi thu hồi refresh token.";
        AuthServiceMock
            .Setup(s => s.LogoutAsync(request))
            .ThrowsAsync(new InvalidOperationException(errorMessage));

        // Act
        var act = async () => await Controller.Logout(request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage(errorMessage);

        AuthServiceMock.Verify(s => s.LogoutAsync(request), Times.Once);
    }
}
