using Application.Common.Validation;
using Application.DTOs.Reservations;
using Application.Interfaces;
using Domain.Exceptions;

namespace Application.Validation.Reservations;

public class CreateReservationValidationRule : IValidationRule<CreateReservationRequestDto>
{
    private readonly IPhoneService _phoneService;

    public CreateReservationValidationRule(IPhoneService phoneService)
    {
        _phoneService = phoneService;
    }

    public Task ValidateAsync(CreateReservationRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin đặt bàn không được để trống.");

        if (string.IsNullOrWhiteSpace(request.CustomerName))
            throw new BusinessException("Họ và tên khách hàng không được để trống.");

        if (request.CustomerName.Trim().Length > 255)
            throw new BusinessException("Họ và tên khách hàng không được vượt quá 255 ký tự.");

        if (string.IsNullOrWhiteSpace(request.CustomerPhone))
            throw new BusinessException("Số điện thoại liên hệ không được để trống.");

        var normalizedPhone = _phoneService.Normalize(request.CustomerPhone.Trim());
        if (!_phoneService.IsValid(normalizedPhone))
            throw new BusinessException("Số điện thoại liên hệ không hợp lệ (chuẩn số Việt Nam 10 chữ số).");

        if (!string.IsNullOrWhiteSpace(request.CustomerEmail))
        {
            var email = request.CustomerEmail.Trim();
            if (email.Length > 100 || !email.Contains('@') || !email.Contains('.'))
                throw new BusinessException("Địa chỉ Email liên hệ không hợp lệ.");
        }

        if (request.GuestCount < 1 || request.GuestCount > 50)
            throw new BusinessException("Số lượng khách phải từ 1 đến 50 người. Với đoàn khách lớn hơn 50 người vui lòng liên hệ trực tiếp hotline nhà hàng.");

        // Chặn tuyệt đối đặt bàn trong quá khứ hoặc trước giờ đến dưới 30 phút
        DateTime nowVn;
        try
        {
            var vnTimeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
            nowVn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTimeZone);
        }
        catch
        {
            nowVn = DateTime.UtcNow.AddHours(7);
        }

        var reservationTimeVn = request.ReservationTime.Kind == DateTimeKind.Utc
            ? request.ReservationTime.AddHours(7)
            : request.ReservationTime;

        if (reservationTimeVn < nowVn.AddMinutes(30))
        {
            throw new BusinessException("Thời gian đặt bàn không được ở quá khứ. Quý khách vui lòng chọn thời điểm trong tương lai (tối thiểu trước 30 phút).");
        }

        if (reservationTimeVn > nowVn.AddDays(90))
        {
            throw new BusinessException("Hệ thống chỉ nhận đặt bàn trước tối đa 90 ngày.");
        }

        return Task.CompletedTask;
    }
}

public class FindTableQueryValidationRule : IValidationRule<FindTableQueryDto>
{
    public Task ValidateAsync(FindTableQueryDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Yêu cầu tìm bàn không được để trống.");

        if (request.GuestCount < 1 || request.GuestCount > 50)
            throw new BusinessException("Số lượng khách phải từ 1 đến 50 người.");

        if (request.DurationMinutes < 30 || request.DurationMinutes > 360)
            throw new BusinessException("Thời gian sử dụng bàn phải từ 30 đến 360 phút.");

        DateTime nowVn;
        try
        {
            var vnTimeZone = TimeZoneInfo.FindSystemTimeZoneById("SE Asia Standard Time");
            nowVn = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, vnTimeZone);
        }
        catch
        {
            nowVn = DateTime.UtcNow.AddHours(7);
        }

        var searchTimeVn = request.ReservationTime.Kind == DateTimeKind.Utc
            ? request.ReservationTime.AddHours(7)
            : request.ReservationTime;

        if (searchTimeVn < nowVn.AddMinutes(-5))
            throw new BusinessException("Thời gian tìm bàn không được ở quá khứ.");

        return Task.CompletedTask;
    }
}
