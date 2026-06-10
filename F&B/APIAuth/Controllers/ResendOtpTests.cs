using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class ResendOtpTests : AuthControllerTestBase
{
    [Fact]
    public async Task ResendOtp_WhenValidRequest_ShouldReturnOkWithResponse()
    {
        // Arrange
        var request = new ResendOtpRequest
        {
            PhoneNumber = "0987654321",
            Purpose = "Register"
        };

        var expectedResponse = new ResendOtpResponse
        {
            Message = "Mã OTP mới đã được gửi thành công."
        };

        OtpServiceMock
            .Setup(s => s.ResendOtpAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.ResendOtp(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        OtpServiceMock.Verify(s => s.ResendOtpAsync(request), Times.Once);
    }

    [Fact]
    public async Task ResendOtp_WhenExceedRateLimit_ShouldPropagateException()
    {
        // Arrange
        var request = new ResendOtpRequest
        {
            PhoneNumber = "0987654321",
            Purpose = "Register"
        };

        var errorMessage = "Bạn đã yêu cầu gửi lại OTP quá số lần cho phép. Vui lòng thử lại sau.";
        OtpServiceMock
            .Setup(s => s.ResendOtpAsync(request))
            .ThrowsAsync(new InvalidOperationException(errorMessage));

        // Act
        var act = async () => await Controller.ResendOtp(request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage(errorMessage);

        OtpServiceMock.Verify(s => s.ResendOtpAsync(request), Times.Once);
    }
}
