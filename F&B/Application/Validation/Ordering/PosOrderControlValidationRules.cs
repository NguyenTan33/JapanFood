using Application.Common.Validation;
using Application.DTOs.Ordering;
using Domain.Exceptions;

namespace Application.Validation.Ordering;

public class AddOrderItemsValidationRule : IValidationRule<AddOrderItemsRequestDto>
{
    public Task ValidateAsync(AddOrderItemsRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu thêm món không được để trống.");

        if (request.OrderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");

        if (request.Items == null || !request.Items.Any())
            throw new BusinessException("Phải chọn ít nhất một món để thêm vào đơn.");

        foreach (var item in request.Items)
        {
            if (item.MenuItemId <= 0)
                throw new BusinessException("Mã món ăn không hợp lệ.");
            if (item.Quantity < 1 || item.Quantity > 50)
                throw new BusinessException($"Số lượng món (ID: {item.MenuItemId}) phải từ 1 đến 50 phần.");
        }

        return Task.CompletedTask;
    }
}

public class CancelOrderItemValidationRule : IValidationRule<CancelOrderItemRequestDto>
{
    public Task ValidateAsync(CancelOrderItemRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu hủy món không được để trống.");

        if (request.OrderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");

        if (request.OrderItemId <= 0)
            throw new BusinessException("Mã món cần hủy không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw new BusinessException("Lý do hủy món không được để trống.");

        if (request.Reason.Trim().Length > 255)
            throw new BusinessException("Lý do hủy món không được vượt quá 255 ký tự.");

        return Task.CompletedTask;
    }
}

public class SplitOrderValidationRule : IValidationRule<SplitOrderRequestDto>
{
    public Task ValidateAsync(SplitOrderRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu tách bàn không được để trống.");

        if (request.SourceOrderId <= 0)
            throw new BusinessException("Mã đơn hàng nguồn không hợp lệ.");

        if (request.TargetTableId <= 0)
            throw new BusinessException("Mã bàn đích chuyển món đến không hợp lệ.");

        if (request.OrderItemIds == null || !request.OrderItemIds.Any())
            throw new BusinessException("Phải chọn ít nhất một món ăn để tách sang bàn mới.");

        return Task.CompletedTask;
    }
}

public class ApproveOnlineOrderValidationRule : IValidationRule<ApproveOnlineOrderRequestDto>
{
    public Task ValidateAsync(ApproveOnlineOrderRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Yêu cầu duyệt đơn online không được để trống.");

        if (request.OrderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");

        if (request.EstimatedPrepMinutes <= 0 || request.EstimatedPrepMinutes > 180)
            throw new BusinessException("Thời gian ước tính chế biến phải từ 1 đến 180 phút.");

        return Task.CompletedTask;
    }
}
