using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class VerifyRegisterOtpTests : AuthControllerTestBase
{
    [Fact]
    public async Task VerifyRegisterOtp_WhenValidRequest_ShouldReturnOkWithResponse()
    {
        // Arrange
        var request = new VerifyRegisterOtpRequest
        {
            PhoneNumber = "0987654321",
            Otp = "123456"
        };

        var expectedResponse = new VerifyRegisterOtpResponse
        {
            UserId = "user-guid-123",
            AccessToken = "valid-jwt-token",
            RefreshToken = "valid-refresh-token",
            Message = "Xác thực OTP thành công.",
            ExpiresInMinutes = 60
        };

        OtpServiceMock
            .Setup(s => s.VerifyRegisterOtpAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.VerifyRegisterOtp(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        OtpServiceMock.Verify(s => s.VerifyRegisterOtpAsync(request), Times.Once);
    }

    [Fact]
    public async Task VerifyRegisterOtp_WhenOtpIsInvalid_ShouldPropagateException()
    {
        // Arrange
        var request = new VerifyRegisterOtpRequest
        {
            PhoneNumber = "0987654321",
            Otp = "999999"
        };

        var exceptionMessage = "Mã OTP không chính xác hoặc đã hết hạn.";
        OtpServiceMock
            .Setup(s => s.VerifyRegisterOtpAsync(request))
            .ThrowsAsync(new ArgumentException(exceptionMessage));

        // Act
        var act = async () => await Controller.VerifyRegisterOtp(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage(exceptionMessage);

        OtpServiceMock.Verify(s => s.VerifyRegisterOtpAsync(request), Times.Once);
    }
}
