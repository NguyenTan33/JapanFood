using System.Net.Mail;
using Application.Common.Validation;
using Application.DTOs.Auth;
using Application.Interfaces;
using Domain.Constants;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace Application.Validation.Auth;

public class CreateAdminUserValidationRule : IValidationRule<CreateAdminUserRequestDto>
{
    private readonly IJapanFoodDbContext _context;
    private readonly IPhoneService _phoneService;

    public CreateAdminUserValidationRule(IJapanFoodDbContext context, IPhoneService phoneService)
    {
        _context = context;
        _phoneService = phoneService;
    }

    public async Task ValidateAsync(CreateAdminUserRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu tạo người dùng không được để trống.");

        if (string.IsNullOrWhiteSpace(request.FullName))
            throw new BusinessException("Họ và tên không được để trống.");

        if (request.FullName.Trim().Length > 255)
            throw new BusinessException("Họ và tên không được vượt quá 255 ký tự.");

        if (string.IsNullOrWhiteSpace(request.Email))
            throw new BusinessException("Email không được để trống.");

        var emailLower = request.Email.Trim().ToLowerInvariant();
        if (emailLower.Length > 100 ||
            !MailAddress.TryCreate(emailLower, out var mailAddress) ||
            mailAddress.Address != emailLower)
        {
            throw new BusinessException("Địa chỉ Email không đúng định dạng hợp lệ.");
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 6)
            throw new BusinessException("Mật khẩu phải có độ dài tối thiểu 6 ký tự.");

        if (request.Password.Length > 128)
            throw new BusinessException("Mật khẩu không được vượt quá 128 ký tự.");

        if (!AppRoles.IsValidRole(request.Role))
            throw new BusinessException($"Vai trò '{request.Role}' không hợp lệ. Chỉ chấp nhận: {string.Join(", ", AppRoles.All)}.");

        var emailExists = await _context.Users
            .AsNoTracking()
            .AnyAsync(u => u.Email.ToLower() == emailLower, ct);
        if (emailExists)
            throw new ConflictException($"Email '{emailLower}' đã được sử dụng trong hệ thống.");

        if (!string.IsNullOrWhiteSpace(request.PhoneNumber))
        {
            var normalizedPhone = _phoneService.Normalize(request.PhoneNumber);
            if (!_phoneService.IsValid(normalizedPhone))
                throw new BusinessException("Số điện thoại không hợp lệ (Phải đúng định dạng chuẩn Việt Nam +84/0...).");

            var phoneExists = await _context.Users
                .AsNoTracking()
                .AnyAsync(u => u.PhoneNumber == normalizedPhone, ct);
            if (phoneExists)
                throw new ConflictException($"Số điện thoại '{normalizedPhone}' đã được sử dụng trong hệ thống.");
        }
    }
}

public class UpdateUserRoleValidationRule : IValidationRule<UpdateUserRoleRequestDto>
{
    public Task ValidateAsync(UpdateUserRoleRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu cập nhật vai trò không được để trống.");

        if (!AppRoles.IsValidRole(request.Role))
            throw new BusinessException($"Vai trò '{request.Role}' không hợp lệ. Chỉ chấp nhận: {string.Join(", ", AppRoles.All)}.");

        return Task.CompletedTask;
    }
}

public class AdminResetPasswordValidationRule : IValidationRule<AdminResetPasswordRequestDto>
{
    public Task ValidateAsync(AdminResetPasswordRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu cấp lại mật khẩu không được để trống.");

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            throw new BusinessException("Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.");

        if (request.NewPassword.Length > 128)
            throw new BusinessException("Mật khẩu mới không được vượt quá 128 ký tự.");

        return Task.CompletedTask;
    }
}
