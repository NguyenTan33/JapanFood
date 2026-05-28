using Application.Common.Validation;
using Application.DTOs.Ordering;
using Domain.Entities.Menu;
using Domain.Exceptions;

namespace Application.Validation.Ordering;

public class CreateOrderValidationRule : IValidationRule<CreateOrderRequestDto>
{
    public Task ValidateAsync(CreateOrderRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu tạo đơn hàng không được để trống.");

        if (request.Items == null || !request.Items.Any())
            throw new BusinessException("Đơn hàng phải có ít nhất một món ăn.");

        if (request.OrderType == OrderType.DineIn && (!request.TableId.HasValue || request.TableId.Value <= 0))
            throw new BusinessException("Đơn ăn tại bàn (Dine-In) bắt buộc phải chọn bàn hợp lệ.");

        if (request.GuestCount < 1 || request.GuestCount > 50)
            throw new BusinessException("Số lượng khách phải từ 1 đến 50 người.");

        if (!string.IsNullOrWhiteSpace(request.Notes) && request.Notes.Trim().Length > 500)
            throw new BusinessException("Ghi chú đơn hàng không được vượt quá 500 ký tự.");

        foreach (var item in request.Items)
        {
            if (item.MenuItemId <= 0)
                throw new BusinessException("Mã món ăn trong đơn hàng không hợp lệ.");

            if (item.Quantity < 1 || item.Quantity > 100)
                throw new BusinessException($"Số lượng món ăn (ID: {item.MenuItemId}) phải từ 1 đến 100 phần.");

            if (!string.IsNullOrWhiteSpace(item.SpecialInstructions) && item.SpecialInstructions.Trim().Length > 250)
                throw new BusinessException($"Ghi chú món ăn (ID: {item.MenuItemId}) không được vượt quá 250 ký tự.");
        }

        return Task.CompletedTask;
    }
}
