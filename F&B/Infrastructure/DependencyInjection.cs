using Application;
using Application.Common.Validation;
using Application.Interfaces;
using Application.Interfaces.Communication;
using Application.Interfaces.Payment;
using Application.Interfaces.Repositories;
using Application.Interfaces.Storage;
using Application.Services;
using Infrastructure.Data;
using Infrastructure.Repositories;
using Infrastructure.Services.Communication;
using Infrastructure.Services.Payment;
using Infrastructure.Services.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        // 1. Database Connection (SQL Server localhost: JapanFood)
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=localhost;Database=JapanFood;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=true;";

        services.AddDbContext<JapanFoodDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddScoped<IJapanFoodDbContext>(provider =>
            provider.GetRequiredService<JapanFoodDbContext>());

        // 2. Unit of Work & Transaction Management
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // 3. HTTP Client & Memory Cache
        services.AddHttpClient();
        services.AddMemoryCache();

        // 4. Query & Repository Layer (LINQ CQRS Read Layer)
        services.AddScoped<IMenuQueryRepository, MenuQueryRepository>();
        services.AddScoped<ITableReservationQueryRepository, TableReservationQueryRepository>();
        services.AddScoped<IOrderQueryRepository, OrderQueryRepository>();
        services.AddScoped<IVoucherQueryRepository, VoucherQueryRepository>();
        services.AddScoped<IDishReviewQueryRepository, DishReviewQueryRepository>();
        services.AddScoped<ICartQueryRepository, CartQueryRepository>();
        services.AddScoped<IKitchenQueryRepository, KitchenQueryRepository>();
        services.AddScoped<IInventoryQueryRepository, InventoryQueryRepository>();
        services.AddScoped<IContentQueryRepository, ContentQueryRepository>();
        services.AddScoped<IShiftQueryRepository, ShiftQueryRepository>();

        // 5. External Gateways (Payment, File Storage, Notifications)
        services.AddScoped<IVnPayService, VnPayService>();
        services.AddScoped<IMoMoService, MoMoService>();
        services.AddScoped<IFileStorageService, LocalFileStorageService>();
        services.AddScoped<IEmailService, EmailService>();

        // 6. Application Auth Services
        services.AddScoped<IHashService, HashService>();
        services.AddScoped<IPhoneService, PhoneService>();
        services.AddScoped<ISmsService, SmsService>();
        services.AddScoped<ITokenService, TokenService>();
        services.AddScoped<IOtpService, OtpService>();
        services.AddScoped<IPasswordService, PasswordService>();
        services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
        services.AddScoped<IGoogleAuthService, GoogleAuthService>();
        services.AddScoped<IAuthenticationService, AuthenticationService>();

        // 7. Auto-register Validation Factory & all IValidationRule<T> in Application assembly
        services.AddAppValidation(typeof(IValidationFactory).Assembly);

        // 8. Register Core Business Application Services
        services.AddApplicationServices();

        return services;
    }
}
