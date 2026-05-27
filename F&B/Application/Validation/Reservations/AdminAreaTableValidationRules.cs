using Application.Common.Validation;
using Application.DTOs.Reservations;
using Domain.Exceptions;

namespace Application.Validation.Reservations;

public class CreateTableAreaValidationRule : IValidationRule<CreateTableAreaRequestDto>
{
    public Task ValidateAsync(CreateTableAreaRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu tạo khu vực bàn không được để trống.");

        if (string.IsNullOrWhiteSpace(request.AreaCode))
            throw new BusinessException("Mã khu vực không được để trống.");

        if (request.AreaCode.Trim().Length > 30)
            throw new BusinessException("Mã khu vực không được vượt quá 30 ký tự.");

        if (string.IsNullOrWhiteSpace(request.AreaName))
            throw new BusinessException("Tên khu vực không được để trống.");

        if (request.AreaName.Trim().Length > 100)
            throw new BusinessException("Tên khu vực không được vượt quá 100 ký tự.");

        if (request.MinGuests < 1)
            throw new BusinessException("Số khách tối thiểu phải lớn hơn hoặc bằng 1.");

        if (request.MaxGuests < request.MinGuests)
            throw new BusinessException("Số khách tối đa phải lớn hơn hoặc bằng số khách tối thiểu.");

        if (request.DepositPerGuest.HasValue && request.DepositPerGuest.Value < 0)
            throw new BusinessException("Tiền đặt cọc mỗi khách không được âm.");

        return Task.CompletedTask;
    }
}

public class UpdateTableAreaValidationRule : IValidationRule<UpdateTableAreaRequestDto>
{
    public Task ValidateAsync(UpdateTableAreaRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu cập nhật khu vực bàn không được để trống.");

        if (string.IsNullOrWhiteSpace(request.AreaName))
            throw new BusinessException("Tên khu vực không được để trống.");

        if (request.AreaName.Trim().Length > 100)
            throw new BusinessException("Tên khu vực không được vượt quá 100 ký tự.");

        if (request.MinGuests < 1)
            throw new BusinessException("Số khách tối thiểu phải lớn hơn hoặc bằng 1.");

        if (request.MaxGuests < request.MinGuests)
            throw new BusinessException("Số khách tối đa phải lớn hơn hoặc bằng số khách tối thiểu.");

        if (request.DepositPerGuest.HasValue && request.DepositPerGuest.Value < 0)
            throw new BusinessException("Tiền đặt cọc mỗi khách không được âm.");

        return Task.CompletedTask;
    }
}

public class CreateTableValidationRule : IValidationRule<CreateTableRequestDto>
{
    public Task ValidateAsync(CreateTableRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu tạo bàn không được để trống.");

        if (request.AreaId <= 0)
            throw new BusinessException("Mã khu vực không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.TableNumber))
            throw new BusinessException("Số bàn không được để trống.");

        if (request.TableNumber.Trim().Length > 30)
            throw new BusinessException("Số bàn không được vượt quá 30 ký tự.");

        if (request.Capacity <= 0)
            throw new BusinessException("Sức chứa của bàn phải lớn hơn 0.");

        if (request.MinCapacity <= 0 || request.MinCapacity > request.Capacity)
            throw new BusinessException("Sức chứa tối thiểu không hợp lệ.");

        return Task.CompletedTask;
    }
}

public class UpdateTableValidationRule : IValidationRule<UpdateTableRequestDto>
{
    public Task ValidateAsync(UpdateTableRequestDto request, CancellationToken ct = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu cập nhật bàn không được để trống.");

        if (request.AreaId <= 0)
            throw new BusinessException("Mã khu vực không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.TableNumber))
            throw new BusinessException("Số bàn không được để trống.");

        if (request.TableNumber.Trim().Length > 30)
            throw new BusinessException("Số bàn không được vượt quá 30 ký tự.");

        if (request.Capacity <= 0)
            throw new BusinessException("Sức chứa của bàn phải lớn hơn 0.");

        if (request.MinCapacity <= 0 || request.MinCapacity > request.Capacity)
            throw new BusinessException("Sức chứa tối thiểu không hợp lệ.");

        return Task.CompletedTask;
    }
}
