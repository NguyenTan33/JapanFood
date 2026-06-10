using Application.DTOs.Auth;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace APIAuth.Controllers;

public class GoogleRegisterTests : AuthControllerTestBase
{
    [Fact]
    public async Task GoogleRegister_WhenValidRequest_ShouldReturnOkWithLoginResponse()
    {
        // Arrange
        var request = new GoogleRegisterRequest
        {
            IdToken = "valid-google-id-token",
            PhoneNumber = "0912345678",
            FullName = "New Google Customer",
            City = "TP Hồ Chí Minh"
        };

        var expectedResponse = new LoginResponse
        {
            AccessToken = "new-user-access-token",
            RefreshToken = "new-user-refresh-token",
            ExpiresInMinutes = 60,
            User = new UserProfileDto
            {
                Id = 3,
                FullName = request.FullName,
                PhoneNumber = request.PhoneNumber,
                Role = "Customer"
            }
        };

        GoogleAuthServiceMock
            .Setup(s => s.GoogleRegisterAsync(request))
            .ReturnsAsync(expectedResponse);

        // Act
        var result = await Controller.GoogleRegister(request);

        // Assert
        var okResult = result.Should().BeOfType<OkObjectResult>().Subject;
        okResult.StatusCode.Should().Be(200);
        okResult.Value.Should().BeEquivalentTo(expectedResponse);

        GoogleAuthServiceMock.Verify(s => s.GoogleRegisterAsync(request), Times.Once);
    }

    [Fact]
    public async Task GoogleRegister_WhenUserAlreadyExists_ShouldPropagateException()
    {
        // Arrange
        var request = new GoogleRegisterRequest
        {
            IdToken = "valid-google-id-token",
            PhoneNumber = "0912345678"
        };

        var conflictMessage = "Tài khoản Google hoặc số điện thoại này đã được đăng ký trước đó.";
        GoogleAuthServiceMock
            .Setup(s => s.GoogleRegisterAsync(request))
            .ThrowsAsync(new InvalidOperationException(conflictMessage));

        // Act
        var act = async () => await Controller.GoogleRegister(request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage(conflictMessage);

        GoogleAuthServiceMock.Verify(s => s.GoogleRegisterAsync(request), Times.Once);
    }
}
