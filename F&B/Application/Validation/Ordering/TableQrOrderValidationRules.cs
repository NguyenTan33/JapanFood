using Application.Common.Validation;
using Application.DTOs.Ordering;
using Domain.Exceptions;

namespace Application.Validation.Ordering;

public class TableQrOrderValidationRule : IValidationRule<TableQrOrderRequestDto>
{
    public Task ValidateAsync(TableQrOrderRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu gọi món tại bàn không được để trống.");

        if (request.TableId <= 0)
            throw new BusinessException("Mã bàn không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.Token) && string.IsNullOrWhiteSpace(request.PinCode))
            throw new BusinessException("Vui lòng cung cấp mã Token phiên hoặc Mã PIN bàn.");

        if (request.Items == null || !request.Items.Any())
            throw new BusinessException("Vui lòng chọn ít nhất một món ăn để gọi món.");

        foreach (var item in request.Items)
        {
            if (item.MenuItemId <= 0)
                throw new BusinessException("Mã món ăn không hợp lệ.");

            if (item.Quantity < 1 || item.Quantity > 50)
                throw new BusinessException($"Số lượng món (ID: {item.MenuItemId}) phải từ 1 đến 50 phần.");

            if (!string.IsNullOrWhiteSpace(item.SpecialInstructions) && item.SpecialInstructions.Trim().Length > 200)
                throw new BusinessException("Ghi chú món ăn không được vượt quá 200 ký tự.");
        }

        return Task.CompletedTask;
    }
}
