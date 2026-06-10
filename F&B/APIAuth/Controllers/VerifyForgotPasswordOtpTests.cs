using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class VerifyForgotPasswordOtpTests : AuthControllerTestBase
{
    [Fact]
    public async Task VerifyForgotPasswordOtp_WhenValidOtp_ShouldReturnOkWithResetToken()
    {
        // Arrange
        var request = new VerifyForgotPasswordOtpRequest
        {
            PhoneNumber = "0987654321",
            Otp = "654321"
        };

        var expectedResponse = new VerifyForgotPasswordOtpResponse
        {
            UserId = "user-guid-123",
            ResetToken = "secure-password-reset-token-abc"
        };

        OtpServiceMock
            .Setup(s => s.VerifyForgotPasswordOtpAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.VerifyForgotPasswordOtp(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        OtpServiceMock.Verify(s => s.VerifyForgotPasswordOtpAsync(request), Times.Once);
    }

    [Fact]
    public async Task VerifyForgotPasswordOtp_WhenOtpIsInvalid_ShouldPropagateException()
    {
        // Arrange
        var request = new VerifyForgotPasswordOtpRequest
        {
            PhoneNumber = "0987654321",
            Otp = "000000"
        };

        var errorMessage = "Mã OTP không hợp lệ hoặc đã quá số lần thử.";
        OtpServiceMock
            .Setup(s => s.VerifyForgotPasswordOtpAsync(request))
            .ThrowsAsync(new ArgumentException(errorMessage));

        // Act
        var act = async () => await Controller.VerifyForgotPasswordOtp(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage(errorMessage);

        OtpServiceMock.Verify(s => s.VerifyForgotPasswordOtpAsync(request), Times.Once);
    }
}
