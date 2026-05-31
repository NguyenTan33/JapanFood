using Application.Common.Validation;
using Application.DTOs.Reviews;
using Domain.Exceptions;

namespace Application.Validation.Reviews;

public class CreateReviewValidationRule : IValidationRule<CreateReviewRequestDto>
{
    public Task ValidateAsync(CreateReviewRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu đánh giá món ăn không được để trống.");

        if (request.UserId <= 0)
            throw new BusinessException("Mã người dùng không hợp lệ.");

        if (request.MenuItemId <= 0)
            throw new BusinessException("Mã món ăn không hợp lệ.");

        if (request.OrderId <= 0)
            throw new BusinessException("Mã đơn hàng không hợp lệ.");

        if (request.Rating < 1 || request.Rating > 5)
            throw new BusinessException("Số sao đánh giá phải từ 1 đến 5 sao.");

        if (!string.IsNullOrWhiteSpace(request.Comment) && request.Comment.Trim().Length > 1000)
            throw new BusinessException("Nội dung đánh giá không được vượt quá 1000 ký tự.");

        return Task.CompletedTask;
    }
}

public class ReplyReviewValidationRule : IValidationRule<ReplyReviewRequestDto>
{
    public Task ValidateAsync(ReplyReviewRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Dữ liệu phản hồi đánh giá không được để trống.");

        if (string.IsNullOrWhiteSpace(request.Reply))
            throw new BusinessException("Nội dung phản hồi không được để trống.");

        if (request.Reply.Trim().Length > 1000)
            throw new BusinessException("Nội dung phản hồi không được vượt quá 1000 ký tự.");

        return Task.CompletedTask;
    }
}
