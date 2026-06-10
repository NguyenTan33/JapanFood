using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class ChangePasswordTests : AuthControllerTestBase
{
    [Fact]
    public async Task ChangePassword_WhenUserClaimIsMissing_ShouldReturnUnauthorized()
    {
        // Arrange - No authenticated user in HttpContext
        SetAuthenticatedUser(customerId: null);

        var request = new ChangePasswordRequest
        {
            CurrentPassword = "OldPassword@123",
            NewPassword = "NewPassword@123",
            ConfirmNewPassword = "NewPassword@123"
        };

        // Act
        var result = await Controller.ChangePassword(request);

        // Assert
        var unauthorizedResult = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorizedResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);

        var responseValue = unauthorizedResult.Value;
        responseValue.Should().NotBeNull();

        var messageProp = responseValue!.GetType().GetProperty("message")?.GetValue(responseValue);
        messageProp.Should().Be("Token không chứa thông tin tài khoản hợp lệ.");

        PasswordServiceMock.Verify(
            s => s.ChangePasswordAsync(It.IsAny<string>(), It.IsAny<ChangePasswordRequest>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangePassword_WhenUserClaimIsWhitespace_ShouldReturnUnauthorized()
    {
        // Arrange
        SetAuthenticatedUser(customerId: "   ");

        var request = new ChangePasswordRequest
        {
            CurrentPassword = "OldPassword@123",
            NewPassword = "NewPassword@123",
            ConfirmNewPassword = "NewPassword@123"
        };

        // Act
        var result = await Controller.ChangePassword(request);

        // Assert
        var unauthorizedResult = result.Should().BeOfType<UnauthorizedObjectResult>().Subject;
        unauthorizedResult.StatusCode.Should().Be(StatusCodes.Status401Unauthorized);

        PasswordServiceMock.Verify(
            s => s.ChangePasswordAsync(It.IsAny<string>(), It.IsAny<ChangePasswordRequest>()),
            Times.Never);
    }

    [Fact]
    public async Task ChangePassword_WhenUserIsValidAndRequestSucceeds_ShouldReturnOkWithSuccessMessage()
    {
        // Arrange
        const string customerId = "user-guid-123";
        SetAuthenticatedUser(customerId);

        var request = new ChangePasswordRequest
        {
            CurrentPassword = "OldPassword@123",
            NewPassword = "NewPassword@123",
            ConfirmNewPassword = "NewPassword@123"
        };

        PasswordServiceMock
            .Setup(s => s.ChangePasswordAsync(customerId, request))
            .Returns(Task.CompletedTask);

        // Act
        var result = await Controller.ChangePassword(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);

        var responseValue = okResult.Value;
        responseValue.Should().NotBeNull();

        var statusCodeProp = responseValue!.GetType().GetProperty("statusCode")?.GetValue(responseValue);
        var messageProp = responseValue.GetType().GetProperty("message")?.GetValue(responseValue);

        statusCodeProp.Should().Be(StatusCodes.Status200OK);
        messageProp.Should().Be("Đổi mật khẩu thành công.");

        PasswordServiceMock.Verify(s => s.ChangePasswordAsync(customerId, request), Times.Once);
    }

    [Fact]
    public async Task ChangePassword_WhenCurrentPasswordIsWrong_ShouldPropagateException()
    {
        // Arrange
        const string customerId = "user-guid-123";
        SetAuthenticatedUser(customerId);

        var request = new ChangePasswordRequest
        {
            CurrentPassword = "IncorrectPassword",
            NewPassword = "NewPassword@123",
            ConfirmNewPassword = "NewPassword@123"
        };

        var errorMessage = "Mật khẩu hiện tại không chính xác.";
        PasswordServiceMock
            .Setup(s => s.ChangePasswordAsync(customerId, request))
            .ThrowsAsync(new ArgumentException(errorMessage));

        // Act
        var act = async () => await Controller.ChangePassword(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage(errorMessage);

        PasswordServiceMock.Verify(s => s.ChangePasswordAsync(customerId, request), Times.Once);
    }
}
