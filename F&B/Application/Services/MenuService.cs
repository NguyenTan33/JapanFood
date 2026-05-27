using Application.Common.Validation;
using Application.DTOs.Menu;
using Application.Interfaces;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Interfaces.Storage;
using Domain.Entities.Menu;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class MenuService : IMenuService
{
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMenuQueryRepository _menuQueryRepo;
    private readonly IValidationFactory _validationFactory;
    private readonly IFileStorageService _fileStorageService;
    private readonly ILogger<MenuService> _logger;

    public MenuService(
        IUnitOfWork unitOfWork,
        IMenuQueryRepository menuQueryRepo,
        IValidationFactory validationFactory,
        IFileStorageService fileStorageService,
        ILogger<MenuService> logger)
    {
        _unitOfWork = unitOfWork;
        _menuQueryRepo = menuQueryRepo;
        _validationFactory = validationFactory;
        _fileStorageService = fileStorageService;
        _logger = logger;
    }

    public async Task<DishDetailDto> CreateDishAsync(CreateMenuItemRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 2. Verify Category exists
        var category = await _unitOfWork.Context.Categories.FirstOrDefaultAsync(c => c.Id == request.CategoryId, ct);
        if (category == null)
            throw new NotFoundException($"Không tìm thấy danh mục món ăn #{request.CategoryId}.");

        // 3. Verify uniqueness of dish code
        var codeUpper = request.Code.Trim().ToUpperInvariant();
        var codeExists = await _unitOfWork.Context.MenuItems.AnyAsync(m => m.Code == codeUpper, ct);
        if (codeExists)
            throw new ConflictException($"Món ăn với mã '{request.Code}' đã tồn tại trong thực đơn.");

        // 4. Instantiate and add Domain Entity
        var dish = new MenuItem(
            request.CategoryId,
            request.Code,
            request.Name,
            request.BasePrice,
            request.JapaneseName,
            request.Description,
            request.KitchenStation,
            request.EstimatedPrepMinutes,
            request.IsKitchenItem);

        if (!string.IsNullOrWhiteSpace(request.ImageUrl))
        {
            dish.UpdateDetails(
                dish.Name,
                dish.JapaneseName,
                dish.Description,
                dish.BasePrice,
                dish.EstimatedPrepMinutes,
                request.ImageUrl.Trim());
        }

        _unitOfWork.Context.MenuItems.Add(dish);
        await _unitOfWork.SaveChangesAsync(ct);

        var detail = await _menuQueryRepo.GetDishDetailByCodeAsync(dish.Code, ct);
        return detail ?? new DishDetailDto
        {
            DishId = dish.Id,
            Code = dish.Code,
            Name = dish.Name,
            JapaneseName = dish.JapaneseName,
            Description = dish.Description,
            BasePrice = dish.BasePrice,
            ImageUrl = dish.ImageUrl,
            EstimatedPrepMinutes = dish.EstimatedPrepMinutes,
            CategoryName = category.CategoryName,
            AverageRating = 0,
            TotalReviews = 0
        };
    }

    public async Task<DishDetailDto> UpdateDishDetailsAsync(int dishId, UpdateMenuItemRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        var dish = await _unitOfWork.Context.MenuItems
            .Include(m => m.Category)
            .FirstOrDefaultAsync(m => m.Id == dishId, ct);

        if (dish == null)
            throw new NotFoundException($"Không tìm thấy món ăn #{dishId}.");

        if (request.CategoryId.HasValue && request.CategoryId.Value > 0 && request.CategoryId.Value != dish.CategoryId)
        {
            var catExists = await _unitOfWork.Context.Categories.AnyAsync(c => c.Id == request.CategoryId.Value, ct);
            if (!catExists)
                throw new NotFoundException($"Không tìm thấy danh mục #{request.CategoryId.Value}.");
            dish.ChangeCategory(request.CategoryId.Value);
        }

        dish.UpdateDetails(
            request.Name,
            request.JapaneseName,
            request.Description,
            request.BasePrice,
            request.EstimatedPrepMinutes,
            request.ImageUrl);

        await _unitOfWork.SaveChangesAsync(ct);

        var detail = await _menuQueryRepo.GetDishDetailByCodeAsync(dish.Code, ct);
        return detail ?? new DishDetailDto
        {
            DishId = dish.Id,
            Code = dish.Code,
            Name = dish.Name,
            JapaneseName = dish.JapaneseName,
            Description = dish.Description,
            BasePrice = dish.BasePrice,
            ImageUrl = dish.ImageUrl,
            EstimatedPrepMinutes = dish.EstimatedPrepMinutes,
            CategoryName = dish.Category?.CategoryName ?? string.Empty
        };
    }

    public async Task<bool> UpdateDishPriceAsync(int dishId, decimal newPrice, CancellationToken ct = default)
    {
        if (newPrice < 0)
            throw new BusinessException("Giá món ăn không được âm.");

        var dish = await _unitOfWork.Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dishId, ct);
        if (dish == null)
            throw new NotFoundException($"Không tìm thấy món ăn #{dishId}.");

        dish.UpdatePrice(newPrice);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> SetDishAvailabilityAsync(int dishId, bool isAvailable, CancellationToken ct = default)
    {
        var dish = await _unitOfWork.Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dishId, ct);
        if (dish == null)
            throw new NotFoundException($"Không tìm thấy món ăn #{dishId}.");

        dish.SetAvailability(isAvailable);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<string> UploadDishImageAsync(int dishId, Stream fileStream, string fileName, CancellationToken ct = default)
    {
        if (fileStream == null || fileStream.Length == 0)
            throw new BusinessException("Tệp hình ảnh không hợp lệ hoặc rỗng.");

        if (string.IsNullOrWhiteSpace(fileName))
            throw new BusinessException("Tên tệp hình ảnh không được để trống.");

        var dish = await _unitOfWork.Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dishId, ct);
        if (dish == null)
            throw new NotFoundException($"Không tìm thấy món ăn #{dishId}.");

        var relativePath = await _fileStorageService.SaveFileAsync(fileStream, fileName, "dishes", ct);
        dish.UpdateDetails(dish.Name, dish.JapaneseName, dish.Description, dish.BasePrice, dish.EstimatedPrepMinutes, relativePath);
        await _unitOfWork.SaveChangesAsync(ct);

        return relativePath;
    }

    public async Task<CategoryMenuDto> CreateCategoryAsync(CreateCategoryRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        var codeUpper = request.CategoryCode.Trim().ToUpperInvariant();
        var codeExists = await _unitOfWork.Context.Categories.AnyAsync(c => c.CategoryCode == codeUpper, ct);
        if (codeExists)
            throw new ConflictException($"Danh mục với mã '{request.CategoryCode}' đã tồn tại.");

        var category = new Category(
            request.CategoryCode,
            request.CategoryName,
            request.Description,
            request.DisplayOrder,
            request.JapaneseName,
            request.IconName,
            request.ImageUrl);
        _unitOfWork.Context.Categories.Add(category);
        await _unitOfWork.SaveChangesAsync(ct);

        return new CategoryMenuDto
        {
            CategoryId = category.Id,
            CategoryCode = category.CategoryCode,
            CategoryName = category.CategoryName,
            JapaneseName = category.JapaneseName,
            Description = category.Description,
            IconName = category.IconName,
            ImageUrl = category.ImageUrl,
            DisplayOrder = category.DisplayOrder,
            IsActive = category.IsActive,
            Dishes = new List<DishSummaryDto>()
        };
    }

    public async Task<CategoryMenuDto> UpdateCategoryAsync(int categoryId, UpdateCategoryRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        var category = await _unitOfWork.Context.Categories
            .Include(c => c.MenuItems)
            .FirstOrDefaultAsync(c => c.Id == categoryId, ct);

        if (category == null)
            throw new NotFoundException($"Không tìm thấy danh mục #{categoryId}.");

        category.UpdateInfo(request.CategoryName, request.Description, request.DisplayOrder);
        if (request.JapaneseName != null || request.IconName != null || request.ImageUrl != null)
        {
            category.UpdateVisuals(
                request.JapaneseName ?? category.JapaneseName,
                request.IconName ?? category.IconName,
                request.ImageUrl ?? category.ImageUrl);
        }
        await _unitOfWork.SaveChangesAsync(ct);

        return new CategoryMenuDto
        {
            CategoryId = category.Id,
            CategoryCode = category.CategoryCode,
            CategoryName = category.CategoryName,
            JapaneseName = category.JapaneseName,
            Description = category.Description,
            IconName = category.IconName,
            ImageUrl = category.ImageUrl,
            DisplayOrder = category.DisplayOrder,
            IsActive = category.IsActive,
            Dishes = category.MenuItems.Select(m => new DishSummaryDto
            {
                DishId = m.Id,
                Code = m.Code,
                Name = m.Name,
                JapaneseName = m.JapaneseName,
                Slug = m.Slug,
                Description = m.Description,
                ShortDescription = m.Description,
                BasePrice = m.BasePrice,
                OriginalPrice = m.OriginalPrice,
                ImageUrl = m.ImageUrl,
                SpiceLevel = m.SpiceLevel,
                Calories = m.Calories,
                EstimatedPrepMinutes = m.EstimatedPrepMinutes,
                IsFeatured = m.IsFeatured,
                IsAvailable = m.IsAvailable
            }).ToList()
        };
    }

    public async Task<bool> SetCategoryStatusAsync(int categoryId, bool isActive, CancellationToken ct = default)
    {
        var category = await _unitOfWork.Context.Categories.FirstOrDefaultAsync(c => c.Id == categoryId, ct);
        if (category == null)
            throw new NotFoundException($"Không tìm thấy danh mục #{categoryId}.");

        if (isActive)
            category.Activate();
        else
            category.Deactivate();

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteDishAsync(int dishId, CancellationToken ct = default)
    {
        var dish = await _unitOfWork.Context.MenuItems
            .Include(m => m.ModifierGroups)
            .Include(m => m.Recipes)
            .FirstOrDefaultAsync(m => m.Id == dishId, ct);

        if (dish == null)
            throw new NotFoundException($"Không tìm thấy món ăn #{dishId}.");

        // Xóa giỏ hàng liên quan đến món ăn này
        var cartItems = await _unitOfWork.Context.CartItems.Where(c => c.MenuItemId == dishId).ToListAsync(ct);
        if (cartItems.Any())
        {
            _unitOfWork.Context.CartItems.RemoveRange(cartItems);
        }

        // Xóa đánh giá liên quan
        var reviews = await _unitOfWork.Context.MenuItemReviews.Where(r => r.MenuItemId == dishId).ToListAsync(ct);
        if (reviews.Any())
        {
            _unitOfWork.Context.MenuItemReviews.RemoveRange(reviews);
        }

        // Kiểm tra xem món ăn đã có trong đơn hàng chưa
        var hasOrderItems = await _unitOfWork.Context.OrderItems.AnyAsync(o => o.MenuItemId == dishId, ct);
        if (hasOrderItems)
        {
            dish.SetAvailability(false);
            _logger.LogInformation("Món ăn #{DishId} đã có đơn hàng lịch sử nên được chuyển sang trạng thái ngưng phục vụ.", dishId);
        }
        else
        {
            _unitOfWork.Context.MenuItems.Remove(dish);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteCategoryAsync(int categoryId, CancellationToken ct = default)
    {
        var category = await _unitOfWork.Context.Categories
            .Include(c => c.MenuItems)
            .FirstOrDefaultAsync(c => c.Id == categoryId, ct);

        if (category == null)
            throw new NotFoundException($"Không tìm thấy danh mục #{categoryId}.");

        if (category.MenuItems.Any())
        {
            foreach (var dish in category.MenuItems.ToList())
            {
                await DeleteDishAsync(dish.Id, ct);
            }
        }

        _unitOfWork.Context.Categories.Remove(category);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }
}
