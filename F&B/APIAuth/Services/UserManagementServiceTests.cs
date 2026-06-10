using APIAuth.Services.Common;
using Application.DTOs.Auth;
using Application.Interfaces;
using Application.Services;
using Domain.Constants;
using Domain.Entities;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class UserManagementServiceTests : TestApplicationBase
{
    private readonly UserManagementService _service;
    private readonly IPhoneService _phoneService;

    public UserManagementServiceTests()
    {
        _phoneService = new PhoneService();
        _service = new UserManagementService(
            Context,
            _phoneService,
            ValidationFactory,
            NullLogger<UserManagementService>.Instance);
    }

    [Fact]
    public async Task CreateUser_ValidRequest_HashesPasswordWithBCrypt_AndNormalizesFields()
    {
        var created = await _service.CreateUserAsync(new CreateAdminUserRequestDto
        {
            FullName = "  Thu Ngân Mới  ",
            Email = "Cashier.New@JapanFood.VN",
            PhoneNumber = "0905111222",
            Password = "StaffPass@123",
            Role = "staff"
        });

        Assert.True(created.Id > 0);
        Assert.Equal("Thu Ngân Mới", created.FullName);
        Assert.Equal("cashier.new@japanfood.vn", created.Email);
        Assert.Equal("+84905111222", created.PhoneNumber);
        Assert.Equal(AppRoles.Staff, created.Role);
        Assert.Equal("ACTIVE", created.AccountStatus);

        var entity = await Context.Users.FirstAsync(u => u.UserId == created.Id);
        Assert.True(BCrypt.Net.BCrypt.Verify("StaffPass@123", entity.PasswordHash));
    }

    [Fact]
    public async Task CreateUser_DuplicateEmail_ThrowsConflictException()
    {
        await SeedUserAsync("Existing", "dup@japanfood.vn", "+84901111222");

        await Assert.ThrowsAsync<ConflictException>(() => _service.CreateUserAsync(new CreateAdminUserRequestDto
        {
            FullName = "Duplicate",
            Email = "DUP@japanfood.vn",
            PhoneNumber = "0902222333",
            Password = "Password123",
            Role = AppRoles.Staff
        }));
    }

    [Fact]
    public async Task GetUsers_FiltersBySearchRoleStatusAndPagesCorrectly()
    {
        var admin = new User { FullName = "Admin A", Email = "a@jf.vn", PhoneNumber = "+84900000001", PasswordHash = "h", Role = AppRoles.Admin, AccountStatus = "ACTIVE" };
        var staff1 = new User { FullName = "Staff Bảo", Email = "bao@jf.vn", PhoneNumber = "+84900000002", PasswordHash = "h", Role = AppRoles.Staff, AccountStatus = "ACTIVE" };
        var staff2 = new User { FullName = "Staff Cường", Email = "cuong@jf.vn", PhoneNumber = "+84900000003", PasswordHash = "h", Role = AppRoles.Staff, AccountStatus = "LOCKED" };
        Context.Users.AddRange(admin, staff1, staff2);
        await Context.SaveChangesAsync();

        var staffActive = await _service.GetUsersAsync(new AdminUserFilterDto { Role = "STAFF", Status = "ACTIVE", Page = 1, PageSize = 10 });
        Assert.Equal(1, staffActive.TotalCount);
        Assert.Equal("Staff Bảo", staffActive.Items[0].FullName);

        var searchResult = await _service.GetUsersAsync(new AdminUserFilterDto { Search = "cường", Page = 1, PageSize = 10 });
        Assert.Equal(1, searchResult.TotalCount);
        Assert.Equal("cuong@jf.vn", searchResult.Items[0].Email);
    }

    [Fact]
    public async Task UpdateUserRole_RejectsSelfDemotion_AllowsUpdatingOtherUser()
    {
        var admin = new User { FullName = "Admin", Email = "admin@jf.vn", PhoneNumber = "+84900000010", PasswordHash = "h", Role = AppRoles.Admin, AccountStatus = "ACTIVE" };
        var staff = new User { FullName = "Staff", Email = "staff@jf.vn", PhoneNumber = "+84900000011", PasswordHash = "h", Role = AppRoles.Staff, AccountStatus = "ACTIVE" };
        Context.Users.AddRange(admin, staff);
        await Context.SaveChangesAsync();

        var ex = await Assert.ThrowsAsync<BusinessException>(() =>
            _service.UpdateUserRoleAsync(admin.UserId, admin.UserId, new UpdateUserRoleRequestDto { Role = AppRoles.Staff }));
        Assert.Contains("tự hạ quyền", ex.Message);

        var updated = await _service.UpdateUserRoleAsync(staff.UserId, admin.UserId, new UpdateUserRoleRequestDto { Role = AppRoles.Manager });
        Assert.Equal(AppRoles.Manager, updated.Role);
    }

    [Fact]
    public async Task ResetPassword_HashesNewPasswordAndRevokesAllActiveRefreshTokens()
    {
        var user = await SeedUserAsync("Target User", "target@jf.vn", "+84900000020");
        Context.RefreshTokens.Add(new RefreshToken
        {
            AccountId = user.UserId.ToString(),
            TokenHash = "hash-1",
            ExpiresAt = DateTime.UtcNow.AddDays(5),
            IsRevoked = false
        });
        await Context.SaveChangesAsync();

        await _service.ResetPasswordAsync(user.UserId, new AdminResetPasswordRequestDto { NewPassword = "NewStrongPassword!99" });

        var refreshedUser = await Context.Users.FirstAsync(u => u.UserId == user.UserId);
        Assert.True(BCrypt.Net.BCrypt.Verify("NewStrongPassword!99", refreshedUser.PasswordHash));

        var tokens = await Context.RefreshTokens.Where(t => t.AccountId == user.UserId.ToString()).ToListAsync();
        Assert.All(tokens, t =>
        {
            Assert.True(t.IsRevoked);
            Assert.NotNull(t.RevokedAt);
        });
    }

    [Fact]
    public async Task LockAndUnlockUser_EnforcesSelfLockAndDeletedGuards_AndRevokesRefreshTokens()
    {
        var admin = new User { FullName = "Admin", Email = "admin2@jf.vn", PhoneNumber = "+84900000030", PasswordHash = "h", Role = AppRoles.Admin, AccountStatus = "ACTIVE" };
        var staff = new User { FullName = "Staff", Email = "staff2@jf.vn", PhoneNumber = "+84900000031", PasswordHash = "h", Role = AppRoles.Staff, AccountStatus = "ACTIVE" };
        var deleted = new User { FullName = "Deleted", Email = "del@jf.vn", PhoneNumber = "+84900000032", PasswordHash = "h", Role = AppRoles.Customer, AccountStatus = "DELETED" };
        Context.Users.AddRange(admin, staff, deleted);
        await Context.SaveChangesAsync();

        Context.RefreshTokens.Add(new RefreshToken
        {
            AccountId = staff.UserId.ToString(),
            TokenHash = "staff-token",
            ExpiresAt = DateTime.UtcNow.AddDays(3),
            IsRevoked = false
        });
        await Context.SaveChangesAsync();

        await Assert.ThrowsAsync<BusinessException>(() => _service.LockUserAsync(admin.UserId, admin.UserId));
        await Assert.ThrowsAsync<BusinessException>(() => _service.LockUserAsync(deleted.UserId, admin.UserId));
        await Assert.ThrowsAsync<BusinessException>(() => _service.UnlockUserAsync(deleted.UserId));

        var locked = await _service.LockUserAsync(staff.UserId, admin.UserId);
        Assert.Equal("LOCKED", locked.AccountStatus);

        var token = await Context.RefreshTokens.FirstAsync(t => t.AccountId == staff.UserId.ToString());
        Assert.True(token.IsRevoked);

        var unlocked = await _service.UnlockUserAsync(staff.UserId);
        Assert.Equal("ACTIVE", unlocked.AccountStatus);
    }

    [Fact]
    public async Task Login_SetsLastLoginAtTimestamp()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                { "Jwt:Key", "JapanFood_Super_Secret_Key_For_Jwt_Authentication_Must_Be_Long_Enough_2026!" },
                { "Jwt:Issuer", "JapanFoodAPI" },
                { "Jwt:Audience", "JapanFoodClient" },
                { "Jwt:ExpireMinutes", "120" },
                { "RefreshToken:Secret", "JapanFood_RefreshToken_Secret_Key_For_HmacSha256_Encryption_2026!" },
                { "RefreshToken:ExpireDays", "7" },
                { "Otp:Secret", "JapanFood_Otp_Secret_Key_Hmac_2026!" }
            })
            .Build();

        var hashService = new HashService();
        var tokenService = new TokenService(Context, hashService, config, ValidationFactory);
        var otpService = new OtpService(Context, hashService, _phoneService, new TestSmsService(), config, ValidationFactory);
        var authService = new AuthenticationService(
            Context, _phoneService, otpService, tokenService, hashService, config, ValidationFactory,
            NullLogger<AuthenticationService>.Instance);

        var user = new User
        {
            FullName = "Login Tester",
            Email = "login@jf.vn",
            PhoneNumber = "+84908887777",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Password@123", workFactor: 11),
            AccountStatus = "ACTIVE",
            Role = AppRoles.Staff
        };
        Context.Users.Add(user);
        await Context.SaveChangesAsync();

        Assert.Null(user.LastLoginAt);

        await authService.LoginAsync(new LoginRequest { Email = "login@jf.vn", Password = "Password@123" });

        var reloaded = await Context.Users.FirstAsync(u => u.UserId == user.UserId);
        Assert.NotNull(reloaded.LastLoginAt);
    }

    private sealed class TestSmsService : ISmsService
    {
        public Task SendOtpAsync(string phoneNumber, string otp) => Task.CompletedTask;
    }
}
