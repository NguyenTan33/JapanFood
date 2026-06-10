using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class ResetPasswordTests : AuthControllerTestBase
{
    [Fact]
    public async Task ResetPassword_WhenValidRequest_ShouldReturnOkWithSuccessMessage()
    {
        // Arrange
        var request = new ResetPasswordRequest
        {
            PhoneNumber = "0987654321",
            ResetToken = "valid-reset-token-123",
            NewPassword = "NewSecurePassword@123",
            ConfirmNewPassword = "NewSecurePassword@123"
        };

        PasswordServiceMock
            .Setup(s => s.ResetPasswordAsync(request))
            .Returns(Task.CompletedTask);

        // Act
        var result = await Controller.ResetPassword(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(StatusCodes.Status200OK);

        var responseValue = okResult.Value;
        responseValue.Should().NotBeNull();

        var statusCodeProp = responseValue!.GetType().GetProperty("statusCode")?.GetValue(responseValue);
        var messageProp = responseValue.GetType().GetProperty("message")?.GetValue(responseValue);

        statusCodeProp.Should().Be(StatusCodes.Status200OK);
        messageProp.Should().Be("Đặt lại mật khẩu thành công.");

        PasswordServiceMock.Verify(s => s.ResetPasswordAsync(request), Times.Once);
    }

    [Fact]
    public async Task ResetPassword_WhenResetTokenIsInvalid_ShouldPropagateException()
    {
        // Arrange
        var request = new ResetPasswordRequest
        {
            PhoneNumber = "0987654321",
            ResetToken = "invalid-token",
            NewPassword = "NewPassword@123",
            ConfirmNewPassword = "NewPassword@123"
        };

        var errorMessage = "Mã token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.";
        PasswordServiceMock
            .Setup(s => s.ResetPasswordAsync(request))
            .ThrowsAsync(new ArgumentException(errorMessage));

        // Act
        var act = async () => await Controller.ResetPassword(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage(errorMessage);

        PasswordServiceMock.Verify(s => s.ResetPasswordAsync(request), Times.Once);
    }
}
