using Application.Common.Validation;
using Application.DTOs.Menu;
using Domain.Exceptions;

namespace Application.Validation.Menu;

public class DishFilterQueryValidationRule : IValidationRule<DishFilterQueryDto>
{
    private static readonly HashSet<string> AllowedSortFields = new(StringComparer.OrdinalIgnoreCase)
    {
        "price_asc", "price_desc", "name_asc", "name_desc", "featured", "rating_desc", "popular"
    };

    public Task ValidateAsync(DishFilterQueryDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Bộ lọc tìm kiếm món ăn không được để trống.");

        if (request.Page < 1)
            throw new BusinessException("Số trang phải lớn hơn hoặc bằng 1.");

        if (request.PageSize < 1 || request.PageSize > 100)
            throw new BusinessException("Kích thước trang phải từ 1 đến 100.");

        if (request.MinPrice.HasValue && request.MinPrice.Value < 0)
            throw new BusinessException("Mức giá tối thiểu không được âm.");

        if (request.MaxPrice.HasValue && request.MaxPrice.Value < 0)
            throw new BusinessException("Mức giá tối đa không được âm.");

        if (request.MinPrice.HasValue && request.MaxPrice.HasValue && request.MinPrice.Value > request.MaxPrice.Value)
            throw new BusinessException("Mức giá tối thiểu không được lớn hơn mức giá tối đa.");

        if (!string.IsNullOrWhiteSpace(request.SortBy) && !AllowedSortFields.Contains(request.SortBy.Trim()))
            throw new BusinessException($"Tiêu chí sắp xếp '{request.SortBy}' không hợp lệ. Cho phép: {string.Join(", ", AllowedSortFields)}.");

        return Task.CompletedTask;
    }
}

public class CreateCategoryValidationRule : IValidationRule<CreateCategoryRequestDto>
{
    public CreateCategoryValidationRule()
    {
    }

    public Task ValidateAsync(CreateCategoryRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin danh mục không được để trống.");

        if (string.IsNullOrWhiteSpace(request.CategoryCode))
            throw new BusinessException("Mã danh mục không được để trống.");

        if (request.CategoryCode.Trim().Length > 50)
            throw new BusinessException("Mã danh mục không được vượt quá 50 ký tự.");

        if (string.IsNullOrWhiteSpace(request.CategoryName))
            throw new BusinessException("Tên danh mục không được để trống.");

        if (request.CategoryName.Trim().Length > 255)
            throw new BusinessException("Tên danh mục không được vượt quá 255 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 1000)
            throw new BusinessException("Mô tả danh mục không được vượt quá 1000 ký tự.");

        if (request.DisplayOrder < 0)
            throw new BusinessException("Thứ tự hiển thị không được âm.");

        return Task.CompletedTask;
    }
}

public class UpdateCategoryValidationRule : IValidationRule<UpdateCategoryRequestDto>
{
    public UpdateCategoryValidationRule()
    {
    }

    public Task ValidateAsync(UpdateCategoryRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin cập nhật danh mục không được để trống.");

        if (string.IsNullOrWhiteSpace(request.CategoryName))
            throw new BusinessException("Tên danh mục không được để trống.");

        if (request.CategoryName.Trim().Length > 255)
            throw new BusinessException("Tên danh mục không được vượt quá 255 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 1000)
            throw new BusinessException("Mô tả danh mục không được vượt quá 1000 ký tự.");

        if (request.DisplayOrder < 0)
            throw new BusinessException("Thứ tự hiển thị không được âm.");

        return Task.CompletedTask;
    }
}

public class CreateMenuItemValidationRule : IValidationRule<CreateMenuItemRequestDto>
{
    public CreateMenuItemValidationRule()
    {
    }

    public Task ValidateAsync(CreateMenuItemRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin món ăn không được để trống.");

        if (request.CategoryId <= 0)
            throw new BusinessException("Mã danh mục không hợp lệ.");

        if (string.IsNullOrWhiteSpace(request.Code))
            throw new BusinessException("Mã món ăn không được để trống.");

        if (request.Code.Trim().Length > 50)
            throw new BusinessException("Mã món ăn không được vượt quá 50 ký tự.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new BusinessException("Tên món ăn không được để trống.");

        if (request.Name.Trim().Length > 255)
            throw new BusinessException("Tên món ăn không được vượt quá 255 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.JapaneseName) && request.JapaneseName.Trim().Length > 255)
            throw new BusinessException("Tên tiếng Nhật không được vượt quá 255 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 2000)
            throw new BusinessException("Mô tả món ăn không được vượt quá 2000 ký tự.");

        if (request.BasePrice < 0)
            throw new BusinessException("Giá món ăn không được âm.");

        if (request.EstimatedPrepMinutes < 0 || request.EstimatedPrepMinutes > 180)
            throw new BusinessException("Thời gian chế biến dự kiến không hợp lệ (từ 0 đến 180 phút).");

        return Task.CompletedTask;
    }
}

public class UpdateMenuItemValidationRule : IValidationRule<UpdateMenuItemRequestDto>
{
    public UpdateMenuItemValidationRule()
    {
    }

    public Task ValidateAsync(UpdateMenuItemRequestDto request, CancellationToken cancellationToken = default)
    {
        if (request == null)
            throw new BusinessException("Thông tin cập nhật món ăn không được để trống.");

        if (string.IsNullOrWhiteSpace(request.Name))
            throw new BusinessException("Tên món ăn không được để trống.");

        if (request.Name.Trim().Length > 255)
            throw new BusinessException("Tên món ăn không được vượt quá 255 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.JapaneseName) && request.JapaneseName.Trim().Length > 255)
            throw new BusinessException("Tên tiếng Nhật không được vượt quá 255 ký tự.");

        if (!string.IsNullOrWhiteSpace(request.Description) && request.Description.Trim().Length > 2000)
            throw new BusinessException("Mô tả món ăn không được vượt quá 2000 ký tự.");

        if (request.BasePrice < 0)
            throw new BusinessException("Giá món ăn không được âm.");

        if (request.EstimatedPrepMinutes < 0 || request.EstimatedPrepMinutes > 180)
            throw new BusinessException("Thời gian chế biến dự kiến không hợp lệ (từ 0 đến 180 phút).");

        return Task.CompletedTask;
    }
}
