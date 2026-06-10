using System.Security.Claims;
using System.Text;
using API.Controllers;
using API.Middlewares;
using APIAuth.Services.Common;
using Application.DTOs.Auth;
using Application.DTOs.Operations;
using Application.Services;
using Domain.Constants;
using Domain.Entities;
using Infrastructure.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class M1ControllersAndMiddlewareTests : TestApplicationBase
{
    [Fact]
    public async Task ExceptionHandlingMiddleware_DbUpdateConcurrencyException_Returns409Conflict()
    {
        var middleware = new ExceptionHandlingMiddleware(
            next: _ => throw new DbUpdateConcurrencyException("Concurrency conflict"),
            logger: NullLogger<ExceptionHandlingMiddleware>.Instance,
            env: new FakeWebHostEnvironment());

        var httpContext = new DefaultHttpContext();
        httpContext.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(httpContext);

        Assert.Equal(StatusCodes.Status409Conflict, httpContext.Response.StatusCode);
        httpContext.Response.Body.Position = 0;
        var body = await new StreamReader(httpContext.Response.Body, Encoding.UTF8).ReadToEndAsync();
        Assert.Contains("\"code\": \"CONFLICT\"", body);
    }

    [Fact]
    public async Task AdminUsersController_CreateAndLock_ReturnsExpectedStatusCodes()
    {
        var admin = new User
        {
            FullName = "Admin",
            Email = "admin-ctrl@jf.vn",
            PhoneNumber = "+84901119999",
            PasswordHash = "h",
            Role = AppRoles.Admin,
            AccountStatus = "ACTIVE"
        };
        Context.Users.Add(admin);
        await Context.SaveChangesAsync();

        var service = new UserManagementService(Context, new PhoneService(), ValidationFactory, NullLogger<UserManagementService>.Instance);
        var controller = new AdminUsersController(service)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, admin.UserId.ToString()),
                        new Claim(ClaimTypes.Role, AppRoles.Admin)
                    }, "TestAuth"))
                }
            }
        };

        var createResult = await controller.CreateUser(new CreateAdminUserRequestDto
        {
            FullName = "New Staff",
            Email = "newstaff@jf.vn",
            PhoneNumber = "0903338888",
            Password = "Password123!",
            Role = AppRoles.Staff
        }, CancellationToken.None);

        var createdObj = Assert.IsType<ObjectResult>(createResult);
        Assert.Equal(StatusCodes.Status201Created, createdObj.StatusCode);
        var createdDto = Assert.IsType<AdminUserDto>(createdObj.Value);

        var lockResult = await controller.LockUser(createdDto.Id, CancellationToken.None);
        var lockOk = Assert.IsType<OkObjectResult>(lockResult);
        var lockedDto = Assert.IsType<AdminUserDto>(lockOk.Value);
        Assert.Equal("LOCKED", lockedDto.AccountStatus);
    }

    [Fact]
    public async Task ShiftsController_WithdrawWithPhoto_Returns201_AndMissingPhotoReturns400()
    {
        var admin = new User
        {
            FullName = "Owner",
            Email = "owner-ctrl@jf.vn",
            PhoneNumber = "+84902229999",
            PasswordHash = "h",
            Role = AppRoles.Admin,
            AccountStatus = "ACTIVE"
        };
        Context.Users.Add(admin);
        await Context.SaveChangesAsync();
        await SeedOpenShiftAsync(admin.UserId, 1000000m);

        var queryRepo = new ShiftQueryRepository(Context);
        var service = new ShiftService(UnitOfWork, queryRepo, FileStorageService, ValidationFactory, NullLogger<ShiftService>.Instance);
        var controller = new ShiftsController(service, queryRepo)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(new[]
                    {
                        new Claim(ClaimTypes.NameIdentifier, admin.UserId.ToString()),
                        new Claim(ClaimTypes.Role, AppRoles.Admin)
                    }, "TestAuth"))
                }
            }
        };

        var missingPhotoResult = await controller.WithdrawFromCurrentShift(
            new WithdrawCashDrawerFormRequest { Amount = 100000m, Note = "No photo", Photo = null },
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(missingPhotoResult);

        await using var imgStream = new MemoryStream(new byte[] { 0xFF, 0xD8, 0xFF, 0xE0 });
        var formFile = new FormFile(imgStream, 0, imgStream.Length, "photo", "proof.jpg");
        var withdrawResult = await controller.WithdrawFromCurrentShift(
            new WithdrawCashDrawerFormRequest { Amount = 250000m, Note = "Thu két tối", Photo = formFile },
            CancellationToken.None);

        var created = Assert.IsType<ObjectResult>(withdrawResult);
        Assert.Equal(StatusCodes.Status201Created, created.StatusCode);
        var shiftDto = Assert.IsType<ShiftDto>(created.Value);
        Assert.Equal(750000m, shiftDto.CurrentRemainingCash);
        Assert.Single(shiftDto.Withdrawals);
    }

    private sealed class FakeWebHostEnvironment : IWebHostEnvironment
    {
        public string ApplicationName { get; set; } = "API";
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string WebRootPath { get; set; } = string.Empty;
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
