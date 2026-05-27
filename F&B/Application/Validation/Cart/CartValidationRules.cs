using Application.Common.Validation;
using Application.DTOs.Cart;
using Domain.Exceptions;

namespace Application.Validation.Cart;

public class AddToCartValidationRule : IValidationRule<AddToCartRequestDto>
{
    public Task ValidateAsync(AddToCartRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu thêm vào giỏ hàng không được để trống.");

        if (request.UserId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");

        if (request.MenuItemId <= 0)
            throw new BusinessException("Mã món ăn không hợp lệ.");

        if (request.Quantity < 1 || request.Quantity > 50)
            throw new BusinessException("Số lượng món ăn thêm vào giỏ phải từ 1 đến 50.");

        if (!string.IsNullOrWhiteSpace(request.SpecialInstructions) && request.SpecialInstructions.Trim().Length > 300)
            throw new BusinessException("Ghi chú món ăn không được vượt quá 300 ký tự.");

        return Task.CompletedTask;
    }
}
