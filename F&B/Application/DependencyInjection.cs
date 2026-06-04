using Application.Interfaces.Services;
using Application.Services;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // Register all 8 core Application Services as Scoped
        services.AddScoped<ITableReservationService, TableReservationService>();
        services.AddScoped<ICartService, CartService>();
        services.AddScoped<IOrderService, OrderService>();
        services.AddScoped<IKitchenService, KitchenService>();
        services.AddScoped<IMenuService, MenuService>();
        services.AddScoped<IInventoryService, InventoryService>();
        services.AddScoped<IVoucherService, VoucherService>();
        services.AddScoped<IDishReviewService, DishReviewService>();
        services.AddScoped<IUserAddressService, UserAddressService>();
        services.AddScoped<IWifiConfigService, WifiConfigService>();
        services.AddScoped<IUserManagementService, UserManagementService>();
        services.AddScoped<IShiftService, ShiftService>();

        return services;
    }
}
