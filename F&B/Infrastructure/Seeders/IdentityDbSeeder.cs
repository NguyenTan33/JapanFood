using System.Text.Json;
using Domain.Constants;
using Domain.Entities;
using Domain.Entities.Content;
using Domain.Entities.Inventory;
using Domain.Entities.Kds;
using Domain.Entities.Menu;
using Domain.Entities.Reviews;
using Domain.Entities.TableManagement;
using Domain.Entities.Vouchers;
using Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Seeders;

public static class IdentityDbSeeder
{
    public static async Task SeedRolesAndAdminAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<JapanFoodDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<JapanFoodDbContext>>();

        try
        {
            var canConnect = await context.Database.CanConnectAsync();
            if (!canConnect)
            {
                logger.LogWarning("Không thể kết nối tới SQL Server Database trong bước Seed Data.");
                return;
            }

            // 1. Seed Auth Users (Admin, Manager, Staff, Customer + 8 deterministic Reviewer accounts)
            var adminUser = await SeedUsersAsync(context, logger);

            // 2. Seed Kitchen Stations (idempotent by StationType)
            await SeedKitchenStationsAsync(context, logger);

            // 3. Seed Table Areas & Tables (idempotent upsert by AreaCode / TableNumber)
            await SeedTablesAndAreasAsync(context, logger);

            // 4. Seed Categories, Menu Items, Modifier Groups & Options (idempotent upsert by Code)
            await SeedMenuCatalogAsync(context, logger);

            // 5. Seed Vouchers (idempotent upsert by VoucherCode)
            await SeedVouchersAsync(context, logger);

            // 6. Seed Branches, BlogPosts & RestaurantSetting (idempotent upsert)
            await SeedContentAsync(context, logger);

            // 7. Seed Inventory & Recipe BOM (idempotent by Code)
            await SeedInventoryAndBOMAsync(context, logger);

            // 8. Clean Production Mode: Không tạo đơn hàng hoặc đánh giá giả lập
            logger.LogInformation("Hoàn tất quy trình Seed Data hệ thống JapanFood (Users, Menu, Tables, Vouchers, Content, Inventory).");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lỗi xảy ra trong quá trình Seed Data hệ thống.");
            throw;
        }
    }

    private static async Task<User> SeedUsersAsync(JapanFoodDbContext context, ILogger logger)
    {
        var adminPass = Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD") ?? "Admin@123456";
        var managerPass = Environment.GetEnvironmentVariable("SEED_MANAGER_PASSWORD") ?? "Manager@123456";
        var staffPass = Environment.GetEnvironmentVariable("SEED_STAFF_PASSWORD") ?? "Staff@123456";
        var customerPass = Environment.GetEnvironmentVariable("SEED_CUSTOMER_PASSWORD") ?? "Customer@123456";

        var admin = await EnsureUserAsync(context, logger, "admin@japanfood.vn", "+84999999999", adminPass, "Nguyễn Quản Trị (Admin)", AppRoles.Admin, "PLATINUM", 9999);
        await EnsureUserAsync(context, logger, "manager@japanfood.vn", "+84988888888", managerPass, "Trần Quản Lý (Manager)", AppRoles.Manager, "GOLD", 5000);
        await EnsureUserAsync(context, logger, "thungan@japanfood.vn", "+84977777777", staffPass, "Lê Thu Ngân (Thu Ngân)", AppRoles.Staff, "SILVER", 1000);
        await EnsureUserAsync(context, logger, "bep@japanfood.vn", "+84977888999", staffPass, "Bếp Trưởng KDS (Bếp)", AppRoles.Staff, "SILVER", 1000);
        await EnsureUserAsync(context, logger, "customer@japanfood.vn", "+84966666666", customerPass, "Phạm Khách Hàng (Customer)", AppRoles.Customer, "BRONZE", 100);

        return admin;
    }

    private static async Task<User> EnsureUserAsync(
        JapanFoodDbContext context,
        ILogger logger,
        string email,
        string phone,
        string password,
        string fullName,
        string role,
        string tier,
        int points,
        string? avatarUrl = null)
    {
        var existingUser = await context.Users
            .FirstOrDefaultAsync(x => x.Email == email || x.PhoneNumber == phone);

        if (existingUser == null)
        {
            var user = new User
            {
                FullName = fullName,
                Email = email,
                PhoneNumber = phone,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(password, workFactor: 11),
                LoyaltyPoints = points,
                MembershipTier = tier,
                AccountStatus = "ACTIVE",
                Role = role,
                AvatarUrl = avatarUrl,
                CreatedAt = DateTime.UtcNow
            };

            context.Users.Add(user);
            await context.SaveChangesAsync();
            logger.LogInformation("Đã khởi tạo tài khoản {Role}: {Email} / {Phone}", role, email, phone);
            return user;
        }

        bool dirty = false;
        if (existingUser.FullName != fullName && (existingUser.FullName.Contains('?') || existingUser.FullName.Contains('\uFFFD') || string.IsNullOrWhiteSpace(existingUser.FullName)))
        {
            existingUser.FullName = fullName;
            dirty = true;
        }

        if (existingUser.Role != role)
        {
            existingUser.Role = role;
            dirty = true;
        }

        if (!string.IsNullOrWhiteSpace(avatarUrl) && existingUser.AvatarUrl != avatarUrl)
        {
            existingUser.AvatarUrl = avatarUrl;
            dirty = true;
        }

        if (dirty)
        {
            await context.SaveChangesAsync();
        }

        return existingUser;
    }

    private static async Task SeedKitchenStationsAsync(JapanFoodDbContext context, ILogger logger)
    {
        var desired = new (string Name, KitchenStationType Type, string Desc, int Order)[]
        {
            ("Trạm Mì Ramen & Udon", KitchenStationType.NoodleStation, "Chế biến mì nước, mì xào Nhật Bản", 1),
            ("Trạm Nướng & Chiên Tempura", KitchenStationType.FryGrillStation, "Chế biến Gyoza, Tempura, Teppanyaki", 2),
            ("Trạm Pha Chế & Đồ Uống", KitchenStationType.BeverageStation, "Pha chế trà Matcha, Mocktail, Sake", 3),
            ("Trạm Món Lạnh & Sashimi/Dessert", KitchenStationType.ColdDessertStation, "Cắt thái Sashimi tươi sống và tráng miệng", 4),
            ("Trạm Ra Món Tổng Expo", KitchenStationType.Expo, "Kiểm tra chất lượng và điều phối bồi bàn", 5),
        };

        var existingTypes = await context.KitchenStations.Select(s => s.StationType).ToListAsync();
        var added = 0;
        foreach (var st in desired)
        {
            if (!existingTypes.Contains(st.Type))
            {
                context.KitchenStations.Add(new KitchenStation(st.Name, st.Type, st.Desc, st.Order));
                added++;
            }
        }

        if (added > 0)
        {
            await context.SaveChangesAsync();
            logger.LogInformation("Đã đồng bộ thêm {Count} trạm bếp KDS.", added);
        }
    }

    private static async Task SeedTablesAndAreasAsync(JapanFoodDbContext context, ILogger logger)
    {
        var areasByCode = await context.TableAreas
            .ToDictionaryAsync(a => a.AreaCode.ToUpperInvariant(), a => a);

        foreach (var areaSeed in SeedDataCatalog.TableAreas)
        {
            var codeUpper = areaSeed.Code.ToUpperInvariant();
            var featuresJson = JsonSerializer.Serialize(areaSeed.Features);

            if (!areasByCode.TryGetValue(codeUpper, out var area))
            {
                area = new TableArea(codeUpper, areaSeed.Name, areaSeed.Description, areaSeed.DisplayOrder);
                area.UpdateRichDetails(
                    areaSeed.Name,
                    areaSeed.JapaneseName,
                    areaSeed.Description,
                    areaSeed.ImageUrl,
                    featuresJson,
                    areaSeed.CapacityPerTable,
                    areaSeed.MinGuests,
                    areaSeed.MaxGuests,
                    areaSeed.RequiresDeposit,
                    areaSeed.DepositPerGuest,
                    areaSeed.DisplayOrder);
                context.TableAreas.Add(area);
                await context.SaveChangesAsync();
                areasByCode[codeUpper] = area;
            }
            // Existing canonical TableAreas are preserved so Admin edits / status toggles persist across restarts.
        }

        await context.SaveChangesAsync();

        var existingTables = await context.Tables
            .Select(t => new { t.AreaId, TableNumber = t.TableNumber.ToUpper() })
            .ToListAsync();
        var tableKeys = existingTables
            .Select(t => $"{t.AreaId}:{t.TableNumber}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var tableSeed in SeedDataCatalog.Tables)
        {
            var area = areasByCode[tableSeed.AreaCode.ToUpperInvariant()];
            var key = $"{area.Id}:{tableSeed.TableNumber.ToUpperInvariant()}";
            if (!tableKeys.Contains(key))
            {
                context.Tables.Add(new Table(area.Id, tableSeed.TableNumber, tableSeed.Capacity, tableSeed.MinCapacity));
                tableKeys.Add(key);
            }
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Đã upsert 4 khu vực bàn ăn và đồng bộ danh sách bàn thành công.");
    }

    private static async Task SeedMenuCatalogAsync(JapanFoodDbContext context, ILogger logger)
    {
        // 1. Upsert 7 canonical categories
        var categoriesByCode = await context.Categories
            .ToDictionaryAsync(c => c.CategoryCode.ToUpperInvariant(), c => c);

        foreach (var catSeed in SeedDataCatalog.Categories)
        {
            var codeUpper = catSeed.Code.ToUpperInvariant();
            if (!categoriesByCode.TryGetValue(codeUpper, out var cat))
            {
                cat = new Category(
                    codeUpper,
                    catSeed.Name,
                    catSeed.Description,
                    catSeed.DisplayOrder,
                    catSeed.JapaneseName,
                    catSeed.IconName,
                    catSeed.ImageUrl);
                context.Categories.Add(cat);
                await context.SaveChangesAsync();
                categoriesByCode[codeUpper] = cat;
            }
            else
            {
                cat.Activate();
                cat.UpdateInfo(catSeed.Name, catSeed.Description, catSeed.DisplayOrder);
                cat.UpdateVisuals(catSeed.JapaneseName, catSeed.IconName, catSeed.ImageUrl);
            }
        }

        await context.SaveChangesAsync();

        // 2. Upsert 29 canonical dishes
        var dishesByCode = await context.MenuItems
            .Include(m => m.ModifierGroups)
            .ToDictionaryAsync(m => m.Code.ToUpperInvariant(), m => m);

        foreach (var dishSeed in SeedDataCatalog.Dishes)
        {
            var codeUpper = dishSeed.Code.ToUpperInvariant();
            var category = categoriesByCode[dishSeed.CategoryCode.ToUpperInvariant()];
            var tagsJson = JsonSerializer.Serialize(dishSeed.Tags);
            var ingredientsJson = JsonSerializer.Serialize(dishSeed.Ingredients);

            if (!dishesByCode.TryGetValue(codeUpper, out var dish))
            {
                dish = new MenuItem(
                    category.Id,
                    codeUpper,
                    dishSeed.Name,
                    dishSeed.BasePrice,
                    dishSeed.JapaneseName,
                    dishSeed.Description,
                    dishSeed.KitchenStation,
                    dishSeed.PrepMinutes,
                    isKitchenItem: true);
                dish.UpdateCatalogDetails(
                    category.Id,
                    dishSeed.Name,
                    dishSeed.JapaneseName,
                    dishSeed.Slug,
                    dishSeed.Description,
                    dishSeed.BasePrice,
                    dishSeed.OriginalPrice,
                    dishSeed.ImageUrl,
                    dishSeed.KitchenStation,
                    dishSeed.PrepMinutes,
                    isKitchenItem: true,
                    dishSeed.IsFeatured,
                    isAvailable: true,
                    tagsJson,
                    ingredientsJson,
                    dishSeed.SpiceLevel,
                    dishSeed.Calories);
                context.MenuItems.Add(dish);
                await context.SaveChangesAsync();
                dishesByCode[codeUpper] = dish;
            }
            else
            {
                dish.UpdateCatalogDetails(
                    category.Id,
                    dishSeed.Name,
                    dishSeed.JapaneseName,
                    dishSeed.Slug,
                    dishSeed.Description,
                    dishSeed.BasePrice,
                    dishSeed.OriginalPrice,
                    dishSeed.ImageUrl,
                    dishSeed.KitchenStation,
                    dishSeed.PrepMinutes,
                    isKitchenItem: true,
                    dishSeed.IsFeatured,
                    isAvailable: true,
                    tagsJson,
                    ingredientsJson,
                    dishSeed.SpiceLevel,
                    dishSeed.Calories);
            }
        }

        // Deactivate legacy placeholder category GRILL and legacy placeholder dishes
        if (categoriesByCode.TryGetValue("GRILL", out var legacyGrill))
        {
            legacyGrill.Deactivate();
        }

        foreach (var legacyCode in SeedDataCatalog.LegacyUnavailableDishCodes)
        {
            if (dishesByCode.TryGetValue(legacyCode, out var legacyDish))
            {
                legacyDish.SetAvailability(false);
                legacyDish.SetFeatured(false);
            }
        }

        await context.SaveChangesAsync();

        // 3. Upsert 10 canonical ModifierGroups & 28 ModifierOptions
        var groupsByCode = await context.ModifierGroups
            .Include(g => g.Options)
            .ToDictionaryAsync(g => g.GroupCode.ToUpperInvariant(), g => g);

        foreach (var grpSeed in SeedDataCatalog.ModifierGroups)
        {
            var grpCodeUpper = grpSeed.GroupCode.ToUpperInvariant();
            if (!groupsByCode.TryGetValue(grpCodeUpper, out var group))
            {
                group = new ModifierGroup(
                    grpCodeUpper,
                    grpSeed.GroupName,
                    grpSeed.MinSelection,
                    grpSeed.MaxSelection,
                    null,
                    grpSeed.DisplayOrder);
                context.ModifierGroups.Add(group);
                await context.SaveChangesAsync();
                groupsByCode[grpCodeUpper] = group;
            }
            else
            {
                group.Activate();
                group.UpdateDetails(
                    grpSeed.GroupName,
                    grpSeed.MinSelection,
                    grpSeed.MaxSelection,
                    group.Description,
                    grpSeed.DisplayOrder);
            }

            var existingOptionsByCode = group.Options
                .ToDictionary(o => o.OptionCode.ToUpperInvariant(), o => o);

            foreach (var optSeed in grpSeed.Options)
            {
                var optCodeUpper = optSeed.OptionCode.ToUpperInvariant();
                if (!existingOptionsByCode.TryGetValue(optCodeUpper, out var option))
                {
                    option = new ModifierOption(
                        group.Id,
                        optCodeUpper,
                        optSeed.OptionName,
                        optSeed.PriceAdjustment,
                        optSeed.IsDefault,
                        optSeed.DisplayOrder);
                    option.SetAvailability(optSeed.IsAvailable);
                    group.AddOption(option);
                    context.ModifierOptions.Add(option);
                }
                else
                {
                    option.UpdateDetails(
                        optSeed.OptionName,
                        optSeed.PriceAdjustment,
                        optSeed.IsDefault,
                        optSeed.IsAvailable,
                        optSeed.DisplayOrder);
                }
            }
        }

        // Deactivate legacy placeholder modifier groups (never delete because ORDER_ITEM_MODIFIERS references old options)
        foreach (var legacyGroupCode in new[] { "BROTH-LEVEL", "RAMEN-TOPPING" })
        {
            if (groupsByCode.TryGetValue(legacyGroupCode, out var legacyGroup))
            {
                legacyGroup.Deactivate();
            }
        }

        await context.SaveChangesAsync();

        // 4. Reconcile MENU_ITEM_MODIFIER_GROUPS for every canonical dish
        var allLinks = await context.MenuItemModifierGroups.ToListAsync();
        foreach (var dishSeed in SeedDataCatalog.Dishes)
        {
            var dish = dishesByCode[dishSeed.Code.ToUpperInvariant()];
            var desiredGroupIds = dishSeed.ModifierGroupCodes
                .Select(c => groupsByCode[c.ToUpperInvariant()].Id)
                .ToList();

            var currentDishLinks = allLinks.Where(l => l.MenuItemId == dish.Id).ToList();

            // Remove stale/legacy links not in desiredGroupIds
            foreach (var link in currentDishLinks.Where(l => !desiredGroupIds.Contains(l.ModifierGroupId)))
            {
                context.MenuItemModifierGroups.Remove(link);
            }

            // Add missing desired links
            for (int i = 0; i < desiredGroupIds.Count; i++)
            {
                int groupId = desiredGroupIds[i];
                if (!currentDishLinks.Any(l => l.ModifierGroupId == groupId))
                {
                    context.MenuItemModifierGroups.Add(new MenuItemModifierGroup(dish.Id, groupId, i + 1));
                }
            }
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Đã upsert 7 danh mục, 29 món ăn, 10 nhóm tùy chọn và 28 lựa chọn thành công.");
    }

    private static async Task SeedVouchersAsync(JapanFoodDbContext context, ILogger logger)
    {
        var vouchersByCode = await context.Vouchers
            .ToDictionaryAsync(v => v.VoucherCode.ToUpperInvariant(), v => v);

        foreach (var vSeed in SeedDataCatalog.Vouchers)
        {
            var codeUpper = vSeed.Code.ToUpperInvariant();
            if (!vouchersByCode.TryGetValue(codeUpper, out var voucher))
            {
                voucher = new Voucher(
                    codeUpper,
                    vSeed.DiscountType,
                    vSeed.DiscountValue,
                    vSeed.StartDate,
                    vSeed.EndDate,
                    vSeed.MinOrderAmount,
                    vSeed.MaxDiscountAmount,
                    vSeed.UsageLimit,
                    vSeed.UsagePerUserLimit,
                    vSeed.Title,
                    vSeed.Description);
                context.Vouchers.Add(voucher);
            }
            else
            {
                voucher.UpdateDetails(
                    vSeed.Title,
                    vSeed.Description,
                    vSeed.DiscountType,
                    vSeed.DiscountValue,
                    vSeed.StartDate,
                    vSeed.EndDate,
                    vSeed.MinOrderAmount,
                    vSeed.MaxDiscountAmount,
                    vSeed.UsageLimit,
                    vSeed.UsagePerUserLimit,
                    isActive: true);
            }
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Đã upsert {Count} mã khuyến mại Voucher thành công.", SeedDataCatalog.Vouchers.Length);
    }

    private static async Task SeedContentAsync(JapanFoodDbContext context, ILogger logger)
    {
        // 1. Branches (3)
        var branchesByCode = await context.Branches
            .ToDictionaryAsync(b => b.Code.ToLowerInvariant(), b => b);

        foreach (var bSeed in SeedDataCatalog.Branches)
        {
            var codeLower = bSeed.Code.ToLowerInvariant();
            if (!branchesByCode.TryGetValue(codeLower, out var branch))
            {
                branch = new Branch(
                    codeLower,
                    bSeed.Name,
                    bSeed.Address,
                    bSeed.District,
                    bSeed.City,
                    bSeed.Phone,
                    bSeed.JapaneseName,
                    bSeed.Hotline,
                    bSeed.Email,
                    bSeed.LunchHours,
                    bSeed.DinnerHours,
                    bSeed.HoursNote,
                    bSeed.ParkingMotorbike,
                    bSeed.ParkingCar,
                    bSeed.MapEmbedUrl,
                    bSeed.MapDirectionsUrl,
                    bSeed.ImageUrl,
                    bSeed.IsMainBranch,
                    bSeed.DisplayOrder);
                context.Branches.Add(branch);
            }
            else
            {
                branch.UpdateDetails(
                    bSeed.Name,
                    bSeed.Address,
                    bSeed.District,
                    bSeed.City,
                    bSeed.Phone,
                    bSeed.JapaneseName,
                    bSeed.Hotline,
                    bSeed.Email,
                    bSeed.LunchHours,
                    bSeed.DinnerHours,
                    bSeed.HoursNote,
                    bSeed.ParkingMotorbike,
                    bSeed.ParkingCar,
                    bSeed.MapEmbedUrl,
                    bSeed.MapDirectionsUrl,
                    bSeed.ImageUrl,
                    bSeed.IsMainBranch,
                    bSeed.DisplayOrder,
                    isActive: true);
            }
        }

        // 2. BlogPosts (4) — resolve real SQL MENU_ITEM_IDs for RelatedDishIds
        var dishIdByCode = await context.MenuItems
            .AsNoTracking()
            .ToDictionaryAsync(m => m.Code.ToUpperInvariant(), m => m.Id);

        var blogsBySlug = await context.BlogPosts
            .ToDictionaryAsync(p => p.Slug.ToLowerInvariant(), p => p);

        foreach (var pSeed in SeedDataCatalog.BlogPosts)
        {
            var slugLower = pSeed.Slug.ToLowerInvariant();
            var tagsJson = JsonSerializer.Serialize(pSeed.Tags);
            var relatedIds = pSeed.RelatedDishCodes
                .Where(c => dishIdByCode.ContainsKey(c.ToUpperInvariant()))
                .Select(c => dishIdByCode[c.ToUpperInvariant()])
                .ToList();
            var relatedJson = JsonSerializer.Serialize(relatedIds);

            if (!blogsBySlug.TryGetValue(slugLower, out var post))
            {
                post = new BlogPost(
                    slugLower,
                    pSeed.Title,
                    pSeed.Category,
                    pSeed.Excerpt,
                    pSeed.Content.Trim(),
                    pSeed.AuthorName,
                    pSeed.PublishedAt,
                    pSeed.ReadTimeMinutes,
                    pSeed.Subtitle,
                    pSeed.JapaneseTitle,
                    pSeed.CoverImageUrl,
                    pSeed.AuthorRole,
                    pSeed.AuthorAvatarUrl,
                    tagsJson,
                    relatedJson,
                    isPublished: true);
                context.BlogPosts.Add(post);
            }
            else
            {
                post.UpdateDetails(
                    pSeed.Title,
                    pSeed.Category,
                    pSeed.Excerpt,
                    pSeed.Content.Trim(),
                    pSeed.AuthorName,
                    pSeed.PublishedAt,
                    pSeed.ReadTimeMinutes,
                    pSeed.Subtitle,
                    pSeed.JapaneseTitle,
                    pSeed.CoverImageUrl,
                    pSeed.AuthorRole,
                    pSeed.AuthorAvatarUrl,
                    tagsJson,
                    relatedJson,
                    isPublished: true);
            }
        }

        // 3. RestaurantSetting ("DEFAULT")
        var setting = await context.RestaurantSettings
            .FirstOrDefaultAsync(s => s.SettingKey == "DEFAULT");

        if (setting == null)
        {
            setting = new RestaurantSetting(
                "DEFAULT",
                "TORI SAKURA JAPANESE DINING",
                "1900 8899",
                "contact@torisakura.vn",
                "Ngân hàng Quân Đội (MB Bank)",
                "MB",
                "0903123456888",
                "TORI SAKURA RESTAURANT CO LTD",
                "桜鳥 日本料理",
                "Tinh hoa ẩm thực Nhật Bản giữa lòng Việt Nam",
                "https://facebook.com/torisakurajapan",
                "https://instagram.com/torisakura_dining",
                "Chi nhánh Nam Sài Gòn",
                "compact2");
            context.RestaurantSettings.Add(setting);
        }
        else
        {
            setting.UpdateDetails(
                "TORI SAKURA JAPANESE DINING",
                "1900 8899",
                "contact@torisakura.vn",
                "Ngân hàng Quân Đội (MB Bank)",
                "MB",
                "0903123456888",
                "TORI SAKURA RESTAURANT CO LTD",
                "桜鳥 日本料理",
                "Tinh hoa ẩm thực Nhật Bản giữa lòng Việt Nam",
                "https://facebook.com/torisakurajapan",
                "https://instagram.com/torisakura_dining",
                "Chi nhánh Nam Sài Gòn",
                "compact2");
        }

        await context.SaveChangesAsync();

        // 4. Seed Branch WiFi Configs
        var mainBranch = await context.Branches.FirstOrDefaultAsync(b => b.IsMainBranch);
        if (mainBranch != null && !await context.BranchWifiConfigs.AnyAsync())
        {
            var wifi1 = new BranchWifiConfig(mainBranch.Id, "ToriSakura_Guest_5G", null, "192.168.1.", "Mạng WiFi khách tầng trệt", true);
            var wifi2 = new BranchWifiConfig(mainBranch.Id, "ToriSakura_VIP_Dining", null, "192.168.2.", "Mạng WiFi phòng VIP tầng 1", true);
            context.BranchWifiConfigs.AddRange(wifi1, wifi2);
            await context.SaveChangesAsync();
            logger.LogInformation("Đã seed 2 cấu hình WiFi mẫu cho chi nhánh chính.");
        }

        logger.LogInformation("Đã upsert 3 chi nhánh, 4 bài viết Blog và cấu hình nhà hàng RestaurantSetting.");
    }

    private static async Task SeedInventoryAndBOMAsync(JapanFoodDbContext context, ILogger logger)
    {
        if (await context.UnitsOfMeasure.AnyAsync()) return;

        var uomGram = new UnitOfMeasure("GRAM", "Gram (g)");
        var uomKg = new UnitOfMeasure("KG", "Kilogram (kg)", null, 1000m);
        var uomMl = new UnitOfMeasure("ML", "Milliliter (ml)");
        var uomPiece = new UnitOfMeasure("PIECE", "Miếng / Quả / Cái");

        context.UnitsOfMeasure.AddRange(uomGram, uomKg, uomMl, uomPiece);
        await context.SaveChangesAsync();

        var invSalmon = new InventoryItem("SALMON-RAW", "Cá hồi Na Uy phi lê tươi", "Hải sản", uomGram.Id, minimumStock: 2000m, unitCost: 450m, "Tủ đông bảo quản -18 độ");
        invSalmon.AddStock(20000m, 450m, "Nhập kho ban đầu");

        var invWagyu = new InventoryItem("WAGYU-RAW", "Thịt bò Wagyu A5 Nhật", "Thịt bò", uomGram.Id, minimumStock: 1000m, unitCost: 1200m, "Tủ đông bảo quản -18 độ");
        invWagyu.AddStock(10000m, 1200m, "Nhập kho ban đầu");

        var invNoodle = new InventoryItem("RAMEN-NOODLE", "Sợi mì Ramen tươi", "Mì khô/tươi", uomGram.Id, minimumStock: 5000m, unitCost: 50m, "Tủ mát 2-4 độ");
        invNoodle.AddStock(50000m, 50m, "Nhập kho ban đầu");

        var invBroth = new InventoryItem("TONKOTSU-BROTH", "Nước cốt xương heo Tonkotsu", "Nước dùng", uomMl.Id, minimumStock: 10000m, unitCost: 40m, "Nồi hầm giữ nhiệt");
        invBroth.AddStock(60000m, 40m, "Nhập kho ban đầu");

        context.InventoryItems.AddRange(invSalmon, invWagyu, invNoodle, invBroth);
        await context.SaveChangesAsync();

        var ramenItem = await context.MenuItems.FirstOrDefaultAsync(m => m.Code == "RAMEN-01");
        if (ramenItem != null)
        {
            var bom1 = new RecipeBOM(ramenItem.Id, invNoodle.Id, quantityRequired: 150m, uomGram.Id, wastagePercentage: 2m, "Trần mì qua nước sôi 90s");
            var bom2 = new RecipeBOM(ramenItem.Id, invBroth.Id, quantityRequired: 350m, uomMl.Id, wastagePercentage: 5m, "Chan nước dùng sôi 95 độ");
            ramenItem.AddRecipe(bom1);
            ramenItem.AddRecipe(bom2);
            context.RecipeBOMs.AddRange(bom1, bom2);
        }

        var salmonItem = await context.MenuItems.FirstOrDefaultAsync(m => m.Code == "SASHIMI-01");
        if (salmonItem != null)
        {
            var bomSalmon = new RecipeBOM(salmonItem.Id, invSalmon.Id, quantityRequired: 120m, uomGram.Id, wastagePercentage: 8m, "Lọc da và cắt lát 5 miếng đều nhau");
            salmonItem.AddRecipe(bomSalmon);
            context.RecipeBOMs.Add(bomSalmon);
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Đã khởi tạo Nguyên vật liệu kho và Định lượng công thức BOM thành công.");
    }

    private static async Task SeedReviewsAsync(JapanFoodDbContext context, int adminUserId, ILogger logger)
    {
        // Normalize legacy OrderType='0' on existing SQL row if present
        if (context.Database.IsSqlServer())
        {
            await context.Database.ExecuteSqlRawAsync("UPDATE ORDERS SET ORDER_TYPE = 'DineIn' WHERE ORDER_TYPE = '0'");
        }

        var usersByEmail = await context.Users
            .AsNoTracking()
            .ToDictionaryAsync(u => u.Email.ToLowerInvariant(), u => u);

        var dishesByCode = await context.MenuItems
            .Include(m => m.ModifierGroups)
                .ThenInclude(mg => mg.ModifierGroup)
                    .ThenInclude(g => g.Options)
            .ToDictionaryAsync(m => m.Code.ToUpperInvariant(), m => m);

        var existingOrdersByNumber = await context.Orders
            .ToDictionaryAsync(o => o.OrderNumber, o => o);

        foreach (var revSeed in SeedDataCatalog.Reviews)
        {
            if (!usersByEmail.TryGetValue(revSeed.ReviewerEmail.ToLowerInvariant(), out var reviewer))
                continue;
            if (!dishesByCode.TryGetValue(revSeed.DishCode.ToUpperInvariant(), out var dish))
                continue;

            if (!existingOrdersByNumber.TryGetValue(revSeed.OrderNumber, out var order))
            {
                order = new Order(OrderType.Takeaway, tableId: null, userId: reviewer.UserId, reservationId: null, guestCount: 1, notes: "Đơn hàng mẫu cho đánh giá thực khách");

                var defaultModifiers = new List<(ModifierOption option, int quantity)>();
                foreach (var mg in dish.ModifierGroups.Where(x => x.ModifierGroup != null && x.ModifierGroup.IsActive && x.ModifierGroup.MinSelection > 0))
                {
                    var group = mg.ModifierGroup!;
                    var defaultOpt = group.Options.FirstOrDefault(o => o.IsAvailable && o.IsDefault)
                        ?? group.Options.FirstOrDefault(o => o.IsAvailable);
                    if (defaultOpt != null)
                    {
                        for (int k = 0; k < group.MinSelection; k++)
                        {
                            defaultModifiers.Add((defaultOpt, 1));
                        }
                    }
                }

                var orderItem = order.AddItem(dish, 1, defaultModifiers);
                orderItem.MarkSentToKitchen();
                orderItem.MarkCooking();
                orderItem.MarkReady();
                orderItem.MarkServed();
                order.CompleteOrder();

                // Set deterministic OrderNumber after construction via EF Entry property
                context.Orders.Add(order);
                context.Entry(order).Property(o => o.OrderNumber).CurrentValue = revSeed.OrderNumber;
                await context.SaveChangesAsync();
                existingOrdersByNumber[revSeed.OrderNumber] = order;
            }

            var existingReview = await context.MenuItemReviews
                .FirstOrDefaultAsync(r => r.UserId == reviewer.UserId && r.MenuItemId == dish.Id && r.OrderId == order.Id);

            if (existingReview == null)
            {
                var review = new MenuItemReview(reviewer.UserId, dish.Id, order.Id, revSeed.Rating, revSeed.Comment);
                review.Approve(adminUserId);
                review.SetLikesCount(revSeed.LikesCount);
                review.MarkCreated(reviewer.UserId, revSeed.CreatedAt);
                context.MenuItemReviews.Add(review);
            }
            else
            {
                if (!existingReview.IsApproved)
                {
                    existingReview.Approve(adminUserId);
                }
                existingReview.SetLikesCount(revSeed.LikesCount);
            }
        }

        await context.SaveChangesAsync();
        logger.LogInformation("Đã upsert 8 đánh giá đã kiểm duyệt (MenuItemReviews) thành công.");
    }
}
