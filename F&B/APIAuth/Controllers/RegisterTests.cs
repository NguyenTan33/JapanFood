using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class RegisterTests : AuthControllerTestBase
{
    [Fact]
    public async Task Register_WhenValidRequest_ShouldReturnCreatedAtActionWithResponse()
    {
        // Arrange
        var request = new RegisterRequest
        {
            FullName = "Nguyen Van A",
            PhoneNumber = "0987654321",
            Password = "SecurePassword@123",
            Email = "vana@example.com"
        };

        var expectedResponse = new RegisterResponse
        {
            UserId = "user-guid-123",
            Message = "Đăng ký thành công. Vui lòng kiểm tra mã OTP để xác thực."
        };

        AuthServiceMock
            .Setup(s => s.RegisterAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.Register(request);

        // Assert
        var objResult = result as ObjectResult;
        objResult.Should().NotBeNull();
        objResult!.StatusCode.Should().Be(201);
        objResult.Value.Should().BeEquivalentTo(expectedResponse);

        AuthServiceMock.Verify(s => s.RegisterAsync(request), Times.Once);
    }

    [Fact]
    public async Task Register_WhenServiceThrowsException_ShouldPropagateException()
    {
        // Arrange
        var request = new RegisterRequest
        {
            FullName = "Nguyen Van A",
            PhoneNumber = "0987654321",
            Password = "SecurePassword@123"
        };

        var exceptionMessage = "Số điện thoại này đã được sử dụng.";
        AuthServiceMock
            .Setup(s => s.RegisterAsync(request))
            .ThrowsAsync(new InvalidOperationException(exceptionMessage));

        // Act
        var act = async () => await Controller.Register(request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage(exceptionMessage);

        AuthServiceMock.Verify(s => s.RegisterAsync(request), Times.Once);
    }
}
