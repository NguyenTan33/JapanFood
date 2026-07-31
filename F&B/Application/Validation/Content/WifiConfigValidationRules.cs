using Application.Common.Validation;
using Application.DTOs.Content;
using Domain.Exceptions;

namespace Application.Validation.Content;

public class CreateBranchWifiConfigValidationRule : IValidationRule<CreateBranchWifiConfigRequestDto>
{
    public Task ValidateAsync(CreateBranchWifiConfigRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu cấu hình WiFi không được để trống.");

        if (request.BranchId <= 0)
            throw new BusinessException("Mã chi nhánh không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.Ssid))
            throw new BusinessException("Tên sóng WiFi (SSID) không được để trống.");

        if (request.Ssid.Trim().Length > 100)
            throw new BusinessException("Tên sóng WiFi (SSID) không được vượt quá 100 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Bssid) && request.Bssid.Trim().Length > 50)
            throw new BusinessException("Địa chỉ BSSID / MAC không được vượt quá 50 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.PublicIpSubnet) && request.PublicIpSubnet.Trim().Length > 100)
            throw new BusinessException("Dải mạng IP không được vượt quá 100 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 255)
            throw new BusinessException("Mô tả vị trí WiFi không được vượt quá 255 ký tự.");

        return Task.CompletedTask;
    }
}

public class UpdateBranchWifiConfigValidationRule : IValidationRule<UpdateBranchWifiConfigRequestDto>
{
    public Task ValidateAsync(UpdateBranchWifiConfigRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu cập nhật WiFi không được để trống.");

        if (string.IsNullOrWhiteSpace(request.Ssid))
            throw new BusinessException("Tên sóng WiFi (SSID) không được để trống.");

        if (request.Ssid.Trim().Length > 100)
            throw new BusinessException("Tên sóng WiFi (SSID) không được vượt quá 100 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Bssid) && request.Bssid.Trim().Length > 50)
            throw new BusinessException("Địa chỉ BSSID / MAC không được vượt quá 50 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.PublicIpSubnet) && request.PublicIpSubnet.Trim().Length > 100)
            throw new BusinessException("Dải mạng IP không được vượt quá 100 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 255)
            throw new BusinessException("Mô tả vị trí WiFi không được vượt quá 255 ký tự.");

        return Task.CompletedTask;
    }
}
