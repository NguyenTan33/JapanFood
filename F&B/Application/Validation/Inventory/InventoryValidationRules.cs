using Application.Common.Validation;
using Application.DTOs.Inventory;
using Domain.Exceptions;

namespace Application.Validation.Inventory;

public class RestockItemValidationRule : IValidationRule<RestockItemRequestDto>
{
    public RestockItemValidationRule()
    {
    }

    public Task ValidateAsync(RestockItemRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin nhập kho không được để trống.");

        if (request.InventoryItemId <= 0)
            throw new BusinessException("Mã nguyên liệu không hợp lệ.");

        if (request.Quantity <= 0)
            throw new BusinessException("Số lượng nhập kho phải lớn hơn 0.");

        if (request.UnitCost < 0)
            throw new BusinessException("Đơn giá nhập không được âm.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new BusinessException("Lý do nhập kho không được để trống.");

        if (request.Reason.Trim().Length > 500)
            throw new BusinessException("Lý do nhập kho không được vượt quá 500 ký tự.");

        return Task.CompletedTask;
    }
}

public class DeductStockValidationRule : IValidationRule<DeductStockRequestDto>
{
    public DeductStockValidationRule()
    {
    }

    public Task ValidateAsync(DeductStockRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin xuất kho không được để trống.");

        if (request.InventoryItemId <= 0)
            throw new BusinessException("Mã nguyên liệu không hợp lệ.");

        if (request.Quantity <= 0)
            throw new BusinessException("Số lượng xuất kho phải lớn hơn 0.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new BusinessException("Lý do xuất kho không được để trống.");

        if (request.Reason.Trim().Length > 500)
            throw new BusinessException("Lý do xuất kho không được vượt quá 500 ký tự.");

        return Task.CompletedTask;
    }
}
