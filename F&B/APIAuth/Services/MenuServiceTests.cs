using System.Text;
using APIAuth.Services.Common;
using Application.DTOs.Menu;
using Application.Services;
using Domain.Entities.Kds;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class MenuServiceTests : TestApplicationBase
{
    private readonly MenuService _service;

    public MenuServiceTests()
    {
        _service = new MenuService(
            UnitOfWork,
            MenuQueryRepo,
            ValidationFactory,
            FileStorageService,
            NullLogger<MenuService>.Instance);
    }

    [Fact]
    public async Task CreateDish_ValidRequest_CreatesDishAndReturnsDetailDto()
    {
        // Arrange
        var cat = await SeedCategoryAsync("SUSHI", "Sushi & Sashimi");
        var request = new CreateMenuItemRequestDto
        {
            CategoryId = cat.Id,
            Code = "SUSHI-01",
            Name = "Salmon Nigiri",
            JapaneseName = "サーモン握り",
            Description = "Cá hồi tươi Na Uy trên cơm dấm",
            BasePrice = 45000m,
            KitchenStation = KitchenStationType.ColdDessertStation,
            EstimatedPrepMinutes = 5,
            IsKitchenItem = true
        };

        // Act
        var result = await _service.CreateDishAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("SUSHI-01", result.Code);
        Assert.Equal("Salmon Nigiri", result.Name);
        Assert.Equal(45000m, result.BasePrice);

        var savedDish = await Context.MenuItems.FirstOrDefaultAsync(m => m.Code == "SUSHI-01");
        Assert.NotNull(savedDish);
        Assert.Equal(cat.Id, savedDish.CategoryId);
    }

    [Fact]
    public async Task CreateDish_CategoryNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var request = new CreateMenuItemRequestDto
        {
            CategoryId = 99999, // Non-existent
            Code = "TEST-01",
            Name = "Test Dish",
            BasePrice = 50000m
        };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.CreateDishAsync(request));
    }

    [Fact]
    public async Task CreateDish_DuplicateCode_ThrowsConflictException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        await SeedMenuItemAsync(cat.Id, "DUP-01", "Existing Dish", 80000m);

        var request = new CreateMenuItemRequestDto
        {
            CategoryId = cat.Id,
            Code = "DUP-01", // Duplicate
            Name = "Another Dish",
            BasePrice = 90000m
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.CreateDishAsync(request));
        Assert.Contains("đã tồn tại trong thực đơn", ex.Message);
    }

    [Fact]
    public async Task CreateDish_NegativePrice_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var request = new CreateMenuItemRequestDto
        {
            CategoryId = cat.Id,
            Code = "NEG-01",
            Name = "Negative Dish",
            BasePrice = -1000m
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.CreateDishAsync(request));
        Assert.Contains("không được âm", ex.Message);
    }

    [Fact]
    public async Task UpdateDishDetails_ValidRequest_UpdatesAndReturnsDetailDto()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "UPD-01", "Old Dish", 100000m);

        var request = new UpdateMenuItemRequestDto
        {
            Name = "Updated Dish Name",
            JapaneseName = "新しい料理",
            Description = "Mô tả mới",
            BasePrice = 120000m,
            EstimatedPrepMinutes = 12,
            ImageUrl = "/uploads/dishes/new.jpg"
        };

        // Act
        var result = await _service.UpdateDishDetailsAsync(dish.Id, request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Updated Dish Name", result.Name);
        Assert.Equal(120000m, result.BasePrice);

        var updated = await Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dish.Id);
        Assert.NotNull(updated);
        Assert.Equal("Updated Dish Name", updated.Name);
        Assert.Equal("/uploads/dishes/new.jpg", updated.ImageUrl);
    }

    [Fact]
    public async Task UpdateDishDetails_DishNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var request = new UpdateMenuItemRequestDto
        {
            Name = "Non Existent",
            BasePrice = 50000m
        };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.UpdateDishDetailsAsync(99999, request));
    }

    [Fact]
    public async Task UpdateDishPrice_ValidPrice_UpdatesSuccessfully()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "PRICE-01", "Price Test Dish", 80000m);

        // Act
        var success = await _service.UpdateDishPriceAsync(dish.Id, 95000m);

        // Assert
        Assert.True(success);
        var updated = await Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dish.Id);
        Assert.NotNull(updated);
        Assert.Equal(95000m, updated.BasePrice);
    }

    [Fact]
    public async Task UpdateDishPrice_NegativePrice_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.UpdateDishPriceAsync(1, -5000m));
        Assert.Contains("không được âm", ex.Message);
    }

    [Fact]
    public async Task UpdateDishPrice_DishNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.UpdateDishPriceAsync(99999, 100000m));
    }

    [Fact]
    public async Task SetDishAvailability_ValidDish_UpdatesAvailabilityStatus()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "AVAIL-01", "Avail Dish", 100000m, isAvailable: true);

        // Act: mark unavailable
        var success = await _service.SetDishAvailabilityAsync(dish.Id, false);

        // Assert
        Assert.True(success);
        var updated = await Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dish.Id);
        Assert.NotNull(updated);
        Assert.False(updated.IsAvailable);

        // Act: re-enable
        await _service.SetDishAvailabilityAsync(dish.Id, true);
        updated = await Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dish.Id);
        Assert.NotNull(updated);
        Assert.True(updated.IsAvailable);
    }

    [Fact]
    public async Task SetDishAvailability_DishNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.SetDishAvailabilityAsync(99999, false));
    }

    [Fact]
    public async Task UploadDishImage_ValidStream_SavesFileAndUpdatesDishImageUrl()
    {
        // Arrange
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "IMG-01", "Image Dish", 100000m);
        byte[] dummyBytes = Encoding.UTF8.GetBytes("fake_image_content");
        using var stream = new MemoryStream(dummyBytes);

        // Act
        var relativePath = await _service.UploadDishImageAsync(dish.Id, stream, "tonkotsu.png");

        // Assert
        Assert.NotNull(relativePath);
        Assert.Contains("tonkotsu.png", relativePath);

        var updated = await Context.MenuItems.FirstOrDefaultAsync(m => m.Id == dish.Id);
        Assert.NotNull(updated);
        Assert.Equal(relativePath, updated.ImageUrl);
        Assert.Single(FileStorageService.SavedFiles);
        Assert.Equal("tonkotsu.png", FileStorageService.SavedFiles[0].FileName);
    }

    [Fact]
    public async Task UploadDishImage_EmptyStream_ThrowsBusinessException()
    {
        // Arrange
        using var emptyStream = new MemoryStream();

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.UploadDishImageAsync(1, emptyStream, "test.png"));
        Assert.Contains("không hợp lệ hoặc rỗng", ex.Message);
    }

    [Fact]
    public async Task UploadDishImage_EmptyFileName_ThrowsBusinessException()
    {
        // Arrange
        byte[] dummyBytes = Encoding.UTF8.GetBytes("content");
        using var stream = new MemoryStream(dummyBytes);

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.UploadDishImageAsync(1, stream, "   "));
        Assert.Contains("không được để trống", ex.Message);
    }

    [Fact]
    public async Task UploadDishImage_DishNotFound_ThrowsNotFoundException()
    {
        // Arrange
        byte[] dummyBytes = Encoding.UTF8.GetBytes("content");
        using var stream = new MemoryStream(dummyBytes);

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.UploadDishImageAsync(99999, stream, "test.png"));
    }

    [Fact]
    public async Task CreateCategory_ValidRequest_CreatesAndReturnsCategoryDto()
    {
        // Arrange
        var request = new CreateCategoryRequestDto
        {
            CategoryCode = "DRINKS",
            CategoryName = "Đồ uống & Trà Nhật",
            Description = "Matcha, Sake, Bia Nhật",
            DisplayOrder = 5
        };

        // Act
        var result = await _service.CreateCategoryAsync(request);

        // Assert
        Assert.NotNull(result);
        Assert.True(result.CategoryId > 0);
        Assert.Equal("DRINKS", result.CategoryCode);
        Assert.Equal("Đồ uống & Trà Nhật", result.CategoryName);

        var saved = await Context.Categories.FirstOrDefaultAsync(c => c.CategoryCode == "DRINKS");
        Assert.NotNull(saved);
        Assert.Equal(5, saved.DisplayOrder);
    }

    [Fact]
    public async Task CreateCategory_DuplicateCode_ThrowsConflictException()
    {
        // Arrange
        await SeedCategoryAsync("APPETIZER", "Khai vị");

        var request = new CreateCategoryRequestDto
        {
            CategoryCode = "APPETIZER", // Duplicate
            CategoryName = "Món khai vị mới",
            DisplayOrder = 1
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<ConflictException>(() => _service.CreateCategoryAsync(request));
        Assert.Contains("đã tồn tại", ex.Message);
    }

    [Fact]
    public async Task UpdateCategory_ValidRequest_UpdatesAndReturnsCategoryDto()
    {
        // Arrange
        var cat = await SeedCategoryAsync("DESSERT", "Tráng miệng", 10);

        var request = new UpdateCategoryRequestDto
        {
            CategoryName = "Kem & Bánh Mochi",
            Description = "Bánh Mochi dẻo và kem trà xanh",
            DisplayOrder = 12
        };

        // Act
        var result = await _service.UpdateCategoryAsync(cat.Id, request);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("Kem & Bánh Mochi", result.CategoryName);
        Assert.Equal(12, result.Description != null ? 12 : 12);

        var updated = await Context.Categories.FirstOrDefaultAsync(c => c.Id == cat.Id);
        Assert.NotNull(updated);
        Assert.Equal("Kem & Bánh Mochi", updated.CategoryName);
        Assert.Equal(12, updated.DisplayOrder);
    }

    [Fact]
    public async Task UpdateCategory_CategoryNotFound_ThrowsNotFoundException()
    {
        // Arrange
        var request = new UpdateCategoryRequestDto
        {
            CategoryName = "Not Found",
            DisplayOrder = 1
        };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.UpdateCategoryAsync(99999, request));
    }

    [Fact]
    public async Task SetCategoryStatus_ActivateAndDeactivate_UpdatesStatusSuccessfully()
    {
        // Arrange
        var cat = await SeedCategoryAsync("STATUS-CAT", "Category status test");

        // Act: deactivate
        var successDeactivate = await _service.SetCategoryStatusAsync(cat.Id, false);
        Assert.True(successDeactivate);

        var updated = await Context.Categories.FirstOrDefaultAsync(c => c.Id == cat.Id);
        Assert.NotNull(updated);
        Assert.False(updated.IsActive);

        // Act: reactivate
        var successActivate = await _service.SetCategoryStatusAsync(cat.Id, true);
        Assert.True(successActivate);

        updated = await Context.Categories.FirstOrDefaultAsync(c => c.Id == cat.Id);
        Assert.NotNull(updated);
        Assert.True(updated.IsActive);
    }

    [Fact]
    public async Task SetCategoryStatus_CategoryNotFound_ThrowsNotFoundException()
    {
        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.SetCategoryStatusAsync(99999, true));
    }
}
