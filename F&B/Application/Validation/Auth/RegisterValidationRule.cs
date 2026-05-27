using System.Net.Mail;
using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace Application.Validation.Auth;

public class RegisterValidationRule : IValidationRule<RegisterRequest>
{
    private readonly IJapanFoodDbContext _context;
    private readonly IPhoneService _phoneService;

    public RegisterValidationRule(IJapanFoodDbContext context, IPhoneService phoneService)
    {
        _context = context;
        _phoneService = phoneService;
    }

    public async Task ValidateAsync(RegisterRequest request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đăng ký không được để trống.");

        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new BusinessException("Họ và tên không được để trống.");

        if (request.FullName.Trim().Length > 255)
            throw new BusinessException("Họ và tên không được vượt quá 255 ký tự.");

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new BusinessException("Mật khẩu phải có độ dài tối thiểu 6 ký tự.");

        if (request.Password.Length > 128)
            throw new BusinessException("Mật khẩu không được vượt quá 128 ký tự.");

        if (string.IsNullOrWhiteSpace(request.PhoneNumber))
            throw new BusinessException("Số điện thoại không được để trống.");

        var normalizedPhone = _phoneService.Normalize(request.PhoneNumber);
        if (!_phoneService.IsValid(normalizedPhone))
            throw new BusinessException("Số điện thoại không hợp lệ (Phải đúng định dạng chuẩn Việt Nam +84/0...).");

        // Kiểm tra số điện thoại đã được đăng ký và kích hoạt hay chưa
        var existingPhoneUser = await _context.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PhoneNumber == normalizedPhone, ct);

        if (existingPhoneUser != null && existingPhoneUser.AccountStatus == "ACTIVE")
            throw new BusinessException("Số điện thoại đã được đăng ký trong hệ thống.");

        // Kiểm tra định dạng và tính duy nhất của Email
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var emailLower = request.Email.Trim().ToLower();

            if (emailLower.Length > 100 ||
                !MailAddress.TryCreate(emailLower, out var mailAddress) ||
                mailAddress.Address != emailLower)
            {
                throw new BusinessException("Địa chỉ Email không đúng định dạng hợp lệ.");
            }

            var existingEmailUser = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Email.ToLower() == emailLower, ct);

            if (existingEmailUser != null &&
                (existingEmailUser.PhoneNumber != normalizedPhone || existingEmailUser.AccountStatus == "ACTIVE"))
            {
                throw new BusinessException("Địa chỉ Email đã được đăng ký trong hệ thống.");
            }
        }
    }
}
