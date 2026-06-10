using APIAuth.Services.Common;
using Application.DTOs.Cart;
using Application.Services;
using Domain.Entities.Menu;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace APIAuth.Services;

public class CartServiceTests : TestApplicationBase
{
    private readonly CartService _service;

    public CartServiceTests()
    {
        _service = new CartService(
            UnitOfWork,
            CartQueryRepo,
            ValidationFactory,
            NullLogger<CartService>.Instance);
    }

    [Fact]
    public async Task AddToCart_NewItem_CreatesCartItem()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-01", "Tonkotsu Ramen", 120000m);

        var request = new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 2,
            SpecialInstructions = "Ít muối"
        };

        // Act
        var cart = await _service.AddToCartAsync(request);

        // Assert
        Assert.NotNull(cart);
        Assert.Single(cart.Items);
        Assert.Equal(2, cart.TotalItemCount);
        Assert.Equal(240000m, cart.SubTotal);
        Assert.Equal("Tonkotsu Ramen", cart.Items[0].ItemName);
        Assert.Equal("Ít muối", cart.Items[0].SpecialInstructions);
    }

    [Fact]
    public async Task AddToCart_ExistingItemWithSameModifiersAndInstructions_IncrementsQuantity()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-02", "Shoyu Ramen", 110000m);

        var request1 = new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 2,
            SpecialInstructions = "Thêm hành"
        };
        await _service.AddToCartAsync(request1);

        var request2 = new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 3,
            SpecialInstructions = "Thêm hành"
        };

        // Act
        var cart = await _service.AddToCartAsync(request2);

        // Assert
        Assert.Single(cart.Items);
        Assert.Equal(5, cart.TotalItemCount);
        Assert.Equal(5, cart.Items[0].Quantity);
        Assert.Equal(550000m, cart.SubTotal);
    }

    [Fact]
    public async Task AddToCart_WithModifiers_AttachesModifiersAndCalculatesPrice()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-03", "Miso Ramen", 130000m);

        var modGroup = new ModifierGroup("TOPPING", "Topping thêm", 0, 3);
        Context.ModifierGroups.Add(modGroup);
        await Context.SaveChangesAsync();

        var modOpt = new ModifierOption(modGroup.Id, "CHASHU", "Thịt Chashu thêm", 30000m);
        modGroup.AddOption(modOpt);
        dish.AddModifierGroup(modGroup);
        await Context.SaveChangesAsync();

        var request = new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 1,
            ModifierOptionIds = new List<int> { modOpt.Id }
        };

        // Act
        var cart = await _service.AddToCartAsync(request);

        // Assert
        Assert.Single(cart.Items);
        Assert.Equal(160000m, cart.SubTotal); // 130000 + 30000
        Assert.Single(cart.Items[0].Modifiers);
        Assert.Equal("Thịt Chashu thêm", cart.Items[0].Modifiers[0].OptionName);
    }

    [Fact]
    public async Task AddToCart_DifferentInstructions_CreatesSeparateCartItems()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-04", "Spicy Ramen", 125000m);

        await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 1,
            SpecialInstructions = "Cay cấp độ 1"
        });

        // Act
        var cart = await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 1,
            SpecialInstructions = "Cay cấp độ 3"
        });

        // Assert
        Assert.Equal(2, cart.Items.Count);
        Assert.Equal(2, cart.TotalItemCount);
        Assert.Equal(250000m, cart.SubTotal);
    }

    [Fact]
    public async Task AddToCart_NonExistentMenuItem_ThrowsNotFoundException()
    {
        // Arrange
        var user = await SeedUserAsync();

        var request = new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = 99999,
            Quantity = 1
        };

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.AddToCartAsync(request));
    }

    [Fact]
    public async Task AddToCart_UnavailableDish_ThrowsBusinessException()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, "RAMEN-05", "Truffle Ramen", 250000m, isAvailable: false);

        var request = new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 1
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.AddToCartAsync(request));
        Assert.Contains("ngừng phục vụ", ex.Message);
    }

    [Fact]
    public async Task AddToCart_InvalidQuantity_FailsValidation_ThrowsBusinessException()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);

        var request = new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 0 // Invalid quantity
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.AddToCartAsync(request));
        Assert.Contains("Số lượng", ex.Message);
    }

    [Fact]
    public async Task UpdateQuantity_ValidItem_UpdatesQuantityAndSubtotal()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id, price: 100000m);

        var cart = await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 1
        });
        var cartItemId = cart.Items[0].CartItemId;

        // Act
        var updatedCart = await _service.UpdateQuantityAsync(user.UserId, cartItemId, 4);

        // Assert
        Assert.Single(updatedCart.Items);
        Assert.Equal(4, updatedCart.Items[0].Quantity);
        Assert.Equal(400000m, updatedCart.SubTotal);
    }

    [Fact]
    public async Task UpdateQuantity_QuantityZeroOrNegative_ThrowsBusinessException()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);
        var cart = await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 2
        });
        var cartItemId = cart.Items[0].CartItemId;

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.UpdateQuantityAsync(user.UserId, cartItemId, 0));
        Assert.Contains("phải lớn hơn 0", ex.Message);
    }

    [Fact]
    public async Task UpdateQuantity_NonExistentCartItem_ThrowsNotFoundException()
    {
        // Arrange
        var user = await SeedUserAsync();

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.UpdateQuantityAsync(user.UserId, 99999, 2));
    }

    [Fact]
    public async Task UpdateQuantity_WrongUser_ThrowsForbiddenException()
    {
        // Arrange
        var user1 = await SeedUserAsync("User One", "user1@test.com", "0901111111");
        var user2 = await SeedUserAsync("User Two", "user2@test.com", "0902222222");
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);

        var cart = await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user1.UserId,
            MenuItemId = dish.Id,
            Quantity = 1
        });
        var cartItemId = cart.Items[0].CartItemId;

        // Act & Assert: user2 tries to modify user1's cart item
        await Assert.ThrowsAsync<ForbiddenException>(() => _service.UpdateQuantityAsync(user2.UserId, cartItemId, 3));
    }

    [Fact]
    public async Task RemoveItem_ValidItem_RemovesFromCart()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);

        var cart = await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 2
        });
        var cartItemId = cart.Items[0].CartItemId;

        // Act
        var updatedCart = await _service.RemoveItemAsync(user.UserId, cartItemId);

        // Assert
        Assert.Empty(updatedCart.Items);
        Assert.Equal(0, updatedCart.TotalItemCount);
        Assert.Equal(0m, updatedCart.SubTotal);
    }

    [Fact]
    public async Task RemoveItem_WrongUser_ThrowsForbiddenException()
    {
        // Arrange
        var user1 = await SeedUserAsync("User One", "user1@test.com", "0901111111");
        var user2 = await SeedUserAsync("User Two", "user2@test.com", "0902222222");
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);

        var cart = await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user1.UserId,
            MenuItemId = dish.Id,
            Quantity = 1
        });
        var cartItemId = cart.Items[0].CartItemId;

        // Act & Assert
        await Assert.ThrowsAsync<ForbiddenException>(() => _service.RemoveItemAsync(user2.UserId, cartItemId));
    }

    [Fact]
    public async Task RemoveItem_NonExistentCartItem_ThrowsNotFoundException()
    {
        // Arrange
        var user = await SeedUserAsync();

        // Act & Assert
        await Assert.ThrowsAsync<NotFoundException>(() => _service.RemoveItemAsync(user.UserId, 99999));
    }

    [Fact]
    public async Task ClearCart_ValidUser_ClearsAllItems()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish1 = await SeedMenuItemAsync(cat.Id, "DISH-01", "Dish 1", 100000m);
        var dish2 = await SeedMenuItemAsync(cat.Id, "DISH-02", "Dish 2", 150000m);

        await _service.AddToCartAsync(new AddToCartRequestDto { UserId = user.UserId, MenuItemId = dish1.Id, Quantity = 1 });
        await _service.AddToCartAsync(new AddToCartRequestDto { UserId = user.UserId, MenuItemId = dish2.Id, Quantity = 2 });

        // Act
        var success = await _service.ClearCartAsync(user.UserId);

        // Assert
        Assert.True(success);
        var cart = await CartQueryRepo.GetUserCartAsync(user.UserId);
        Assert.Empty(cart.Items);
        Assert.Equal(0m, cart.SubTotal);
    }

    [Fact]
    public async Task ClearCart_InvalidUserId_ThrowsBusinessException()
    {
        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.ClearCartAsync(0));
        Assert.Contains("Mã người dùng", ex.Message);
    }

    [Fact]
    public async Task UpdateQuantity_QuantityGreaterThan50_ThrowsBusinessException()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);
        var cart = await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 2
        });
        var cartItemId = cart.Items[0].CartItemId;

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.UpdateQuantityAsync(user.UserId, cartItemId, 51));
        Assert.Contains("không được vượt quá 50", ex.Message);
    }

    [Fact]
    public async Task AddToCart_AccumulatedQuantityExceeds50_ThrowsBusinessException()
    {
        // Arrange
        var user = await SeedUserAsync();
        var cat = await SeedCategoryAsync();
        var dish = await SeedMenuItemAsync(cat.Id);
        await _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 30
        });

        // Act & Assert
        var ex = await Assert.ThrowsAsync<BusinessException>(() => _service.AddToCartAsync(new AddToCartRequestDto
        {
            UserId = user.UserId,
            MenuItemId = dish.Id,
            Quantity = 25
        }));
        Assert.Contains("không được vượt quá 50", ex.Message);
    }
}
