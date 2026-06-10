using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class ForgotPasswordTests : AuthControllerTestBase
{
    [Fact]
    public async Task ForgotPassword_WhenValidRequest_ShouldReturnOkWithResponse()
    {
        // Arrange
        var request = new ForgotPasswordRequest
        {
            PhoneNumber = "0987654321",
            Email = "vana@example.com"
        };

        var expectedResponse = new ForgotPasswordResponse
        {
            Message = "Mã OTP đặt lại mật khẩu đã được gửi đến số điện thoại."
        };

        PasswordServiceMock
            .Setup(s => s.ForgotPasswordAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.ForgotPassword(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        PasswordServiceMock.Verify(s => s.ForgotPasswordAsync(request), Times.Once);
    }

    [Fact]
    public async Task ForgotPassword_WhenAccountNotFound_ShouldPropagateException()
    {
        // Arrange
        var request = new ForgotPasswordRequest
        {
            PhoneNumber = "0999999999"
        };

        var errorMessage = "Không tìm thấy tài khoản với số điện thoại này.";
        PasswordServiceMock
            .Setup(s => s.ForgotPasswordAsync(request))
            .ThrowsAsync(new KeyNotFoundException(errorMessage));

        // Act
        var act = async () => await Controller.ForgotPassword(request);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage(errorMessage);

        PasswordServiceMock.Verify(s => s.ForgotPasswordAsync(request), Times.Once);
    }
}
