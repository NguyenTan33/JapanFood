using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Application.Services;

public class PasswordService : IPasswordService
{
    private readonly IJapanFoodDbContext _context;
    private readonly IPhoneService _phoneService;
    private readonly IOtpService _otpService;
    private readonly IHashService _hashService;
    private readonly IConfiguration _configuration;
    private readonly IValidationFactory _validationFactory;

    public PasswordService(
        IJapanFoodDbContext context,
        IPhoneService phoneService,
        IOtpService otpService,
        IHashService hashService,
        IConfiguration configuration,
        IValidationFactory validationFactory)
    {
        _context = context;
        _phoneService = phoneService;
        _otpService = otpService;
        _hashService = hashService;
        _configuration = configuration;
        _validationFactory = validationFactory;
    }

    private string GetOtpSecret() =>
        _configuration["Otp:Secret"] ?? "JapanFood_Otp_Secret_Key_Hmac_2026!";

    public async Task<ForgotPasswordResponse> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        await _validationFactory.ValidateAsync(request);

        Domain.Entities.User? user = null;
        if (!string.IsNullOrWhiteSpace(request.PhoneNumber) && !request.PhoneNumber.Contains('@'))
        {
            var phoneNumber = _phoneService.Normalize(request.PhoneNumber);
            user = await _context.Users.FirstOrDefaultAsync(x => x.PhoneNumber == phoneNumber);
        }
        else
        {
            var emailLower = (!string.IsNullOrWhiteSpace(request.Email) ? request.Email : request.PhoneNumber).Trim().ToLower();
            user = await _context.Users.FirstOrDefaultAsync(x => x.Email.ToLower() == emailLower);
        }

        // Chống User Enumeration: Luôn trả về thông báo chung
        if (user == null || user.AccountStatus == "LOCKED" || user.AccountStatus == "DELETED")
        {
            return new ForgotPasswordResponse
            {
                Message = "Nếu số điện thoại được đăng ký, mã xác thực sẽ được gửi."
            };
        }

        await _otpService.SendForgotPasswordOtpAsync(user.PhoneNumber);

        return new ForgotPasswordResponse
        {
            Message = "Nếu số điện thoại được đăng ký, mã xác thực sẽ được gửi."
        };
    }

    public async Task ResetPasswordAsync(ResetPasswordRequest request)
    {
        await _validationFactory.ValidateAsync(request);

        Domain.Entities.User? user = null;
        string phoneNumber;
        if (!string.IsNullOrWhiteSpace(request.PhoneNumber) && !request.PhoneNumber.Contains('@'))
        {
            phoneNumber = _phoneService.Normalize(request.PhoneNumber);
            user = await _context.Users.FirstOrDefaultAsync(x => x.PhoneNumber == phoneNumber);
        }
        else
        {
            var emailLower = (!string.IsNullOrWhiteSpace(request.Email) ? request.Email : request.PhoneNumber).Trim().ToLower();
            user = await _context.Users.FirstOrDefaultAsync(x => x.Email.ToLower() == emailLower);
            phoneNumber = user?.PhoneNumber ?? string.Empty;
        }

        if (user == null || user.AccountStatus == "LOCKED" || user.AccountStatus == "DELETED")
        {
            throw new BusinessException("Yêu cầu đặt lại mật khẩu không hợp lệ.");
        }

        // Băm ResetToken từ request để đối chiếu với TokenHash lưu trong CSDL
        var expectedHash = _hashService.Hash(request.ResetToken.Trim(), GetOtpSecret());

        var tokenRecord = await _context.OtpVerifications
            .Where(x => x.PhoneNumber == phoneNumber &&
                        x.Purpose == "PasswordResetToken" &&
                        !x.IsUsed &&
                        x.OtpHash == expectedHash)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (tokenRecord == null || DateTime.UtcNow > tokenRecord.ExpiresAt)
        {
            if (tokenRecord != null)
            {
                tokenRecord.IsUsed = true;
                await _context.SaveChangesAsync();
            }
            throw new BusinessException("Mã đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.");
        }

        tokenRecord.IsUsed = true;

        var newHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 11);
        user.PasswordHash = newHash;

        if (user.AccountStatus == "PENDING_VERIFY")
        {
            user.AccountStatus = "ACTIVE";
        }

        // BẢO MẬT: Thu hồi toàn bộ Refresh Tokens hiện tại để buộc đăng nhập lại trên mọi thiết bị
        var activeTokens = await _context.RefreshTokens
            .Where(x => x.AccountId == user.UserId.ToString() && !x.IsRevoked)
            .ToListAsync();

        foreach (var token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }

    public async Task ChangePasswordAsync(string userIdStr, ChangePasswordRequest request)
    {
        await _validationFactory.ValidateAsync(request);

        if (!int.TryParse(userIdStr, out var userId))
        {
            throw new BusinessException("Mã định danh người dùng không hợp lệ.");
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null)
        {
            throw new BusinessException("Tài khoản không tồn tại.");
        }

        if (user.AccountStatus == "LOCKED" || user.AccountStatus == "DELETED")
        {
            throw new ForbiddenException("Tài khoản của bạn đã bị khóa hoặc đã bị xóa.");
        }

        if (request.CurrentPassword == request.NewPassword)
        {
            throw new BusinessException("Mật khẩu mới không được trùng với mật khẩu hiện tại.");
        }

        // Kiểm tra mật khẩu hiện tại nghiêm ngặt bằng BCrypt
        bool isCurrentValid = false;
        try
        {
            if (!string.IsNullOrWhiteSpace(user.PasswordHash) &&
                (user.PasswordHash.StartsWith("$2a$") ||
                 user.PasswordHash.StartsWith("$2b$") ||
                 user.PasswordHash.StartsWith("$2y$")))
            {
                isCurrentValid = BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash);
            }
        }
        catch
        {
            isCurrentValid = false;
        }

        if (!isCurrentValid)
        {
            throw new BusinessException("Mật khẩu hiện tại không chính xác.");
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword, workFactor: 11);

        // BẢO MẬT: Thu hồi toàn bộ Refresh Tokens hiện tại khi đổi mật khẩu thành công
        var activeTokens = await _context.RefreshTokens
            .Where(x => x.AccountId == user.UserId.ToString() && !x.IsRevoked)
            .ToListAsync();

        foreach (var token in activeTokens)
        {
            token.IsRevoked = true;
            token.RevokedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
    }
}
