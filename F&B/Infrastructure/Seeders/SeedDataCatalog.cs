using Domain.Entities.Kds;
using Domain.Entities.Vouchers;

namespace Infrastructure.Seeders;

internal static class SeedDataCatalog
{
    public sealed record CategorySeed(
        string Code,
        string Name,
        string JapaneseName,
        string Description,
        string IconName,
        string ImageUrl,
        int DisplayOrder);

    public sealed record ModifierOptionSeed(
        string OptionCode,
        string OptionName,
        decimal PriceAdjustment,
        bool IsDefault,
        bool IsAvailable,
        int DisplayOrder);

    public sealed record ModifierGroupSeed(
        string GroupCode,
        string GroupName,
        int MinSelection,
        int MaxSelection,
        int DisplayOrder,
        ModifierOptionSeed[] Options);

    public sealed record DishSeed(
        string CategoryCode,
        string Code,
        string Name,
        string JapaneseName,
        string Slug,
        decimal BasePrice,
        decimal? OriginalPrice,
        string ImageUrl,
        string Description,
        string[] Ingredients,
        string[] Tags,
        int Calories,
        int SpiceLevel,
        int PrepMinutes,
        bool IsFeatured,
        KitchenStationType KitchenStation,
        string[] ModifierGroupCodes);

    public sealed record TableAreaSeed(
        string Code,
        string Name,
        string JapaneseName,
        string Description,
        string ImageUrl,
        string[] Features,
        string CapacityPerTable,
        int MinGuests,
        int MaxGuests,
        bool RequiresDeposit,
        decimal? DepositPerGuest,
        int DisplayOrder);

    public sealed record TableSeed(string AreaCode, string TableNumber, int Capacity, int MinCapacity);

    public sealed record VoucherSeed(
        string Code,
        string Title,
        string Description,
        DiscountType DiscountType,
        decimal DiscountValue,
        decimal MinOrderAmount,
        decimal? MaxDiscountAmount,
        DateTime StartDate,
        DateTime EndDate,
        int UsageLimit,
        int UsagePerUserLimit);

    public sealed record BranchSeed(
        string Code,
        string Name,
        string JapaneseName,
        string Address,
        string District,
        string City,
        string Phone,
        string Hotline,
        string Email,
        string LunchHours,
        string DinnerHours,
        string HoursNote,
        string ParkingMotorbike,
        string ParkingCar,
        string MapDirectionsUrl,
        string MapEmbedUrl,
        string ImageUrl,
        bool IsMainBranch,
        int DisplayOrder);

    public sealed record BlogSeed(
        string Slug,
        string Title,
        string Subtitle,
        string JapaneseTitle,
        string Category,
        string AuthorName,
        string AuthorRole,
        string AuthorAvatarUrl,
        string CoverImageUrl,
        DateTime PublishedAt,
        int ReadTimeMinutes,
        string Excerpt,
        string Content,
        string[] Tags,
        string[] RelatedDishCodes);

    public sealed record ReviewSeed(
        string OrderNumber,
        string ReviewerEmail,
        string ReviewerPhone,
        string ReviewerName,
        string ReviewerAvatar,
        string DishCode,
        int Rating,
        string Comment,
        DateTime CreatedAt,
        int LikesCount);

    public static readonly CategorySeed[] Categories =
    {
        new("RAMEN", "Mì Ramen & Mì Nhật", "ラーメン・うどん",
            "Nước dùng ninh xương heo Tonkotsu hầm 18 giờ cùng sợi mì tươi Hakata truyền thống",
            "Soup", "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80", 1),
        new("SUSHI", "Sushi & Sashimi", "寿司・刺身",
            "Hải sản nhập khẩu trực tiếp đường hàng không trong ngày từ chợ đầu mối Toyosu Tokyo",
            "Fish", "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&q=80", 2),
        new("APPETIZER", "Khai Vị & Salad Nhật Bản", "前菜・サラダ",
            "Đậu nành lông Edamame, salad rong biển tươi mè rang và bánh xếp Gyoza giòn rụm",
            "Sparkles", "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80", 3),
        new("TEMPURA", "Tempura & Món Chiên", "天ぷら・揚げ物",
            "Bột tempura giòn tan theo bí quyết Edo, vàng ươm và giữ trọn độ mọng nước tự nhiên",
            "Sparkles", "https://images.unsplash.com/photo-1615361200141-f45040f367be?auto=format&fit=crop&w=600&q=80", 4),
        new("WAGYU", "Bò Wagyu & Món Nướng", "和牛・焼き物",
            "Thịt bò Wagyu Miyazaki A5 vân mỡ cẩm thạch BMS 9+ nướng trên phiến đá muối Himalaya",
            "Flame", "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80", 5),
        new("DONBURI", "Cơm Thố Donburi", "丼物・ご飯",
            "Gạo Koshihikari Niigata dẻo thơm kết hợp cùng hải sản và trứng onsen béo ngậy",
            "UtensilsCrossed", "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=600&q=80", 6),
        new("DRINKS", "Rượu Sake & Đồ Uống", "酒・ドリンク",
            "Tuyển tập rượu Sake Junmai Daiginjo trứ danh, rượu mơ Choya và trà xanh Genmaicha",
            "Wine", "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=600&q=80", 7),
        new("DESSERT", "Tráng Miệng Wagashi", "デザート・和菓子",
            "Nghệ thuật bánh tráng miệng thanh tao, kem Matcha Uji Kyoto và bánh dẻo Mochi truyền thống",
            "IceCream", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80", 8),
    };

    public static readonly ModifierGroupSeed[] ModifierGroups =
    {
        new("RAMEN_SIZE", "Kích cỡ tô (Size)", 1, 1, 1, new[]
        {
            new ModifierOptionSeed("SIZE_STD", "Tiêu chuẩn (Regular)", 0m, true, true, 1),
            new ModifierOptionSeed("SIZE_LRG", "Tô lớn + Mì Kaedama (+50% mì)", 35000m, false, true, 2),
        }),
        new("NOODLE_FIRMNESS", "Độ chín sợi mì", 1, 1, 2, new[]
        {
            new ModifierOptionSeed("FIRM_SOFT", "Sợi mềm vừa (Yawa)", 0m, false, true, 1),
            new ModifierOptionSeed("FIRM_NORM", "Sợi vừa chuẩn vị (Futsuu)", 0m, true, true, 2),
            new ModifierOptionSeed("FIRM_HARD", "Sợi cứng giòn kiểu Hakata (Kata)", 0m, false, true, 3),
        }),
        new("BROTH_RICHNESS", "Độ béo đậm đà của nước súp", 1, 1, 3, new[]
        {
            new ModifierOptionSeed("BROTH_LIGHT", "Thanh đạm ít dầu (Usui)", 0m, false, true, 1),
            new ModifierOptionSeed("BROTH_NORM", "Vừa vặn truyền thống (Futsuu)", 0m, true, true, 2),
            new ModifierOptionSeed("BROTH_RICH", "Đậm đà béo ngậy Tokyo (Kotteri)", 10000m, false, true, 3),
        }),
        new("RAMEN_TOPPINGS", "Topping thêm tự chọn", 0, 4, 4, new[]
        {
            new ModifierOptionSeed("TOP_EGG", "Trứng ngâm tương lòng đào Ajitsuke", 15000m, false, true, 1),
            new ModifierOptionSeed("TOP_CHASHU", "2 lát thịt xá xíu Chashu hầm", 35000m, false, true, 2),
            new ModifierOptionSeed("TOP_NORI", "3 lá rong biển nướng Nori giòn", 10000m, false, true, 3),
            new ModifierOptionSeed("TOP_MENMA", "Măng muối lên men Menma", 15000m, false, true, 4),
        }),
        new("WASABI_CHOICE", "Tùy chọn Wasabi", 1, 1, 5, new[]
        {
            new ModifierOptionSeed("WASABI_YES", "Kèm Wasabi tươi Shizuoka mài tay", 0m, true, true, 1),
            new ModifierOptionSeed("WASABI_NO", "Không dùng Wasabi (Sabi-nuki)", 0m, false, true, 2),
        }),
        new("WAGYU_DONENESS", "Độ chín thịt bò", 1, 1, 6, new[]
        {
            new ModifierOptionSeed("DONE_RARE", "Tái (Rare)", 0m, false, true, 1),
            new ModifierOptionSeed("DONE_MED_RARE", "Tái vừa hoàn hảo (Medium Rare - Khuyên dùng)", 0m, true, true, 2),
            new ModifierOptionSeed("DONE_MED", "Chín vừa (Medium)", 0m, false, true, 3),
        }),
        new("WAGYU_SAUCE", "Xốt ăn kèm bò nướng", 1, 1, 7, new[]
        {
            new ModifierOptionSeed("SAUCE_SALT", "Đá muối hồng Himalaya & Wasabi tươi", 0m, true, true, 1),
            new ModifierOptionSeed("SAUCE_PONZU", "Xốt Yuzu Ponzu thanh mát", 0m, false, true, 2),
            new ModifierOptionSeed("SAUCE_TARE", "Xốt Tare mật ong đậu nành đậm đà", 0m, false, true, 3),
        }),
        new("RICE_AMOUNT", "Khẩu phần cơm", 1, 1, 8, new[]
        {
            new ModifierOptionSeed("RICE_NORM", "Cơm vừa vặn tiêu chuẩn", 0m, true, true, 1),
            new ModifierOptionSeed("RICE_EXTRA", "Thêm 30% cơm Koshihikari", 10000m, false, true, 2),
            new ModifierOptionSeed("RICE_LESS", "Ít cơm (Ăn kiêng)", 0m, false, true, 3),
        }),
        new("DONBURI_SIDE", "Món phụ dùng kèm", 0, 2, 9, new[]
        {
            new ModifierOptionSeed("SIDE_MISO", "Súp Miso rong biển đậu hũ", 20000m, false, true, 1),
            new ModifierOptionSeed("SIDE_ONSEN", "Trứng suối nước nóng Onsen Tamago", 15000m, false, true, 2),
        }),
        new("SAKE_TEMP", "Nhiệt độ thưởng thức", 1, 1, 10, new[]
        {
            new ModifierOptionSeed("TEMP_CHILLED", "Uống lạnh tinh khiết (Hiya ~10°C - Khuyên dùng)", 0m, true, true, 1),
            new ModifierOptionSeed("TEMP_ROOM", "Nhiệt độ phòng (Jouon ~20°C)", 0m, false, true, 2),
            new ModifierOptionSeed("TEMP_WARM", "Hâm ấm thơm nồng (Atsukan ~50°C)", 0m, false, true, 3),
        }),
    };

    private static readonly string[] RamenMods = { "RAMEN_SIZE", "NOODLE_FIRMNESS", "BROTH_RICHNESS", "RAMEN_TOPPINGS" };
    private static readonly string[] SushiMods = { "WASABI_CHOICE" };
    private static readonly string[] WagyuMods = { "WAGYU_DONENESS", "WAGYU_SAUCE" };
    private static readonly string[] DonburiMods = { "RICE_AMOUNT", "DONBURI_SIDE" };
    private static readonly string[] SakeMods = { "SAKE_TEMP" };
    private static readonly string[] NoMods = Array.Empty<string>();

    public static readonly DishSeed[] Dishes =
    {
        // RAMEN (4)
        new("RAMEN", "RAMEN-01", "Tonkotsu Chashu Ramen", "博多豚骨チャーシュー麺", "tonkotsu-chashu-ramen",
            165000m, 185000m, "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80",
            "Nước dùng Tonkotsu trứ danh vùng Hakata ninh từ tủy xương heo thượng hạng trong 18 giờ, sợi mì tươi giòn sần sật, ăn kèm 3 lát thịt xá xíu Chashu mọng nước, trứng lòng đào Ajitsuke Tamago và măng muối Menma.",
            new[] { "Nước hầm xương heo 18h", "Sợi mì Hakata", "Thịt xá xíu Chashu", "Trứng ngâm tương", "Măng Menma", "Hành baro", "Rong biển Nori" },
            new[] { "Best Seller", "Signature", "Chef Choice" }, 680, 0, 12, true, KitchenStationType.NoodleStation, RamenMods),
        new("RAMEN", "RAMEN-02", "Spicy Miso Jigoku Ramen", "辛味噌地獄ラーメン", "spicy-miso-jigoku-ramen",
            175000m, null, "https://images.unsplash.com/photo-1552611052-33e04de081de?auto=format&fit=crop&w=800&q=80",
            "Phiên bản ramen cay nồng độc đáo từ tương miso đỏ Hokkaido ủ lên men tự nhiên, hòa quyện dầu ớt cay Togarashi cay xé lưỡi, thịt băm xào cay tỏi ớt cay thơm và ngô ngọt tươi Hokkaido.",
            new[] { "Miso đỏ Hokkaido", "Dầu ớt cay Togarashi", "Thịt băm xào sốt cay", "Trứng lòng đào", "Bắp ngọt", "Hành paro" },
            new[] { "Spicy", "Popular" }, 720, 2, 12, true, KitchenStationType.NoodleStation, RamenMods),
        new("RAMEN", "RAMEN-03", "Shoyu Truffle Ramen", "醤油トリュフラーメン", "shoyu-truffle-ramen",
            185000m, null, "https://images.unsplash.com/photo-1591814468924-caf88d1232e1?auto=format&fit=crop&w=800&q=80",
            "Nước dùng Shoyu thanh tao từ cá bào khô Katsuobushi và nấm đông cô Nhật Bản, điểm xuyết tinh dầu nấm Truffle đen quý phái tạo nên hương thơm lan tỏa đầy tinh tế.",
            new[] { "Nước dùng cá bào Katsuobushi", "Nước tương Shoyu ủ gỗ sồi", "Tinh dầu Truffle đen", "Ức gà phi lê chậm Sous-vide", "Nấm linh chi nâu" },
            new[] { "Chef Choice", "Premium" }, 540, 0, 10, false, KitchenStationType.NoodleStation, RamenMods),
        new("RAMEN", "RAMEN-04", "Black Garlic Tonkotsu Ramen", "黒蒜豚骨ラーメン", "black-garlic-tonkotsu-ramen",
            170000m, null, "https://images.unsplash.com/photo-1623341214825-9f4f963727da?auto=format&fit=crop&w=800&q=80",
            "Dầu tỏi đen Mayu kỳ công chiên qua 7 mức nhiệt độ tạo màu đen tuyền và hương thơm khói sâu lắng trên nền súp xương Tonkotsu béo ngậy.",
            new[] { "Nước dùng Tonkotsu", "Dầu tỏi đen Mayu", "Chashu khò lửa", "Giá đỗ giòn", "Trứng lòng đào" },
            new[] { "Signature" }, 710, 0, 12, false, KitchenStationType.NoodleStation, RamenMods),

        // SUSHI & SASHIMI (6)
        new("SUSHI", "SASHIMI-01", "Sashimi Moriawase Tokusen (Thuyền 7 Loại)", "特選刺身盛り合わせ", "sashimi-moriawase-tokusen",
            580000m, 650000m, "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=800&q=80",
            "Thuyền sashimi hoàng gia phục vụ trên đá tuyết gồm 7 loại hải sản tinh túy: Bụng cá ngừ béo O-Toro, cá hồi Na Uy phi lê, cá cam Hamachi, sò đỏ Hokkigai, mực ống Aori Ika, nhím biển Uni và tôm ngọt Botan Ebi.",
            new[] { "Cá ngừ O-Toro", "Cá hồi tươi Na Uy", "Cá cam Hamachi", "Sò đỏ Hokkigai", "Nhím biển Uni", "Tôm ngọt Botan Ebi", "Mù tạt tươi Shizuoka" },
            new[] { "Best Seller", "Signature", "Premium" }, 420, 0, 15, true, KitchenStationType.ColdDessertStation, SushiMods),
        new("SUSHI", "SUSHI-01", "Salmon Nigiri Aburi Combo (8 Viên)", "炙りサーモン握り寿司", "salmon-nigiri-aburi-combo",
            195000m, null, "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=800&q=80",
            "Set 8 viên sushi cá hồi khò lửa tái vừa thơm lừng hương khói, kết hợp 4 loại sốt độc quyền: sốt Mentaiko trứng cá tuyết, sốt phô mai béo ngậy, sốt Teriyaki ngọt dịu và sốt tiêu đen.",
            new[] { "Cá hồi Na Uy khò lửa", "Cơm giấm sushi Koshihikari", "Sốt Mentaiko", "Sốt Teriyaki", "Trứng cá hồi Ikura" },
            new[] { "Popular", "Chef Choice" }, 460, 0, 10, true, KitchenStationType.ColdDessertStation, SushiMods),
        new("SUSHI", "SASHIMI-02", "Hon Maguro O-Toro Sashimi (5 Lát)", "本マグロ大トロ刺身", "hon-maguro-o-toro-sashimi",
            450000m, null, "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80",
            "Phần thịt bụng béo nhất của cá ngừ vây xanh đại dương với mạng lưới vân mỡ cẩm thạch hoàn hảo, tan chảy ngay khi chạm đầu lưỡi mang lại vị béo ngậy thanh khiết.",
            new[] { "Cá ngừ vây xanh O-Toro", "Wasabi tươi Shizuoka", "Gừng hồng Gari", "Lá tía tô Shiso" },
            new[] { "Premium", "Chef Choice" }, 310, 0, 8, false, KitchenStationType.ColdDessertStation, SushiMods),
        new("SUSHI", "SUSHI-02", "Hotate & Uni Nigiri Set (4 Viên)", "ホタテとウニ握り", "hotate-uni-nigiri-set",
            380000m, null, "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=800&q=80",
            "Sò điệp Hokkaido khổng lồ ngọt mọng nước kết hợp cùng nhím biển Uni vùng biển Okhotsk vàng óng béo ngậy và chút muối biển than tre đen.",
            new[] { "Sò điệp Hokkaido", "Nhím biển Uni", "Cơm giấm Koshihikari", "Muối than tre" },
            new[] { "Premium" }, 280, 0, 10, false, KitchenStationType.ColdDessertStation, SushiMods),
        new("SUSHI", "SUSHI-03", "Dragon Roll Unagi Special (8 Cuộn)", "ドラゴンロール うなぎ", "dragon-roll-unagi-special",
            245000m, null, "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=800&q=80",
            "Cuộn sushi hình rồng uốn lượn phủ lươn nướng Nhật Bản Kabayaki bóng bẩy sốt tare, nhân tôm tempura giòn tan và quả bơ béo bùi.",
            new[] { "Lươn nướng Kabayaki", "Tôm tempura", "Bơ sáp", "Sốt unagi ngọt", "Hạt mè rang" },
            new[] { "Popular" }, 520, 0, 12, false, KitchenStationType.ColdDessertStation, SushiMods),
        new("SUSHI", "SASHIMI-03", "Hamachi Yellowtail Sashimi (6 Lát)", "ハマチ刺身", "hamachi-yellowtail-sashimi",
            280000m, null, "https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=800&q=80",
            "Cá cam Hamachi Nhật Bản với từng lát cá giòn ngọt tự nhiên, vân mỡ trắng bạc đan xen lớp thịt hồng ngọc, chấm kèm xốt tương Ponzu gừng tỏi.",
            new[] { "Cá cam Hamachi", "Xốt Ponzu gừng tỏi", "Củ cải trắng bào Tsuma" },
            new[] { "Signature" }, 260, 0, 8, false, KitchenStationType.ColdDessertStation, SushiMods),

        // APPETIZER & SALAD (5)
        new("APPETIZER", "APP-01", "Đậu Nành Lông Nhật Bản (Edamame)", "枝豆", "dau-nanh-long-edamame",
            45000m, null, "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80",
            "Đậu nành lông non luộc muối biển Oshima giòn ngọt thanh mát, giàu dinh dưỡng tự nhiên.",
            new[] { "Đậu nành lông non", "Muối biển Oshima Nhật" },
            new[] { "Món Khai Vị", "Healthy", "Vegetarian" }, 140, 0, 5, false, KitchenStationType.ColdDessertStation, NoMods),
        new("APPETIZER", "APP-02", "Salad Rong Biển Tươi Mè Rang (Chuka Wakame)", "中華わかめ", "salad-rong-bien-chuka-wakame",
            65000m, null, "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
            "Rong biển tươi giòn sần sật trộn xốt mè rang béo bùi, dầu mè thơm lừng và mè trắng rang vàng.",
            new[] { "Rong biển Wakame tươi", "Xốt mè rang Goma", "Mè trắng rang", "Dầu mè tinh khiết" },
            new[] { "Best Seller", "Signature", "Healthy" }, 160, 0, 5, true, KitchenStationType.ColdDessertStation, NoMods),
        new("APPETIZER", "APP-03", "Há Cảo Nhật Gyoza Áp Chảo (5 chiếc)", "焼き餃子", "ha-cao-gyoza-ap-chao",
            75000m, null, "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=800&q=80",
            "Há cảo vỏ mỏng nhân thịt heo Kurobuta và bắp cải áp chảo giòn tan phần đáy, chấm nước tương giấm gừng.",
            new[] { "Thịt heo Kurobuta xay", "Bắp cải thảo", "Vỏ há cảo Nhật", "Hành lá", "Xốt tương giấm gừng" },
            new[] { "Popular", "Traditional" }, 280, 0, 8, true, KitchenStationType.FryGrillStation, NoMods),
        new("APPETIZER", "APP-04", "Bánh Bạch Tuộc Takoyaki Osaka (6 viên)", "たこ焼き", "banh-bach-tuoc-takoyaki",
            70000m, null, "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80",
            "Bánh nướng nhân bạch tuộc tươi giòn sần sật, rưới xốt tương ngọt Okonomi, sốt mayonnaise Nhật và cá bào Katsuobushi nhảy múa.",
            new[] { "Bạch tuộc tươi Osaka", "Bột bánh Takoyaki", "Cá bào Katsuobushi", "Sốt Okonomi", "Mayonnaise Kewpie" },
            new[] { "Street Food", "Popular" }, 320, 0, 8, true, KitchenStationType.FryGrillStation, NoMods),
        new("APPETIZER", "APP-05", "Salad Cá Hồi Sốt Chanh Dây & Bơ Sáp", "サーモンアボカドサラダ", "salad-ca-hoi-bo-sap",
            125000m, null, "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80",
            "Cá hồi Na Uy tươi thái hạt lựu kết hợp bơ sáp Đắk Lắk béo ngậy, rau mầm tươi xanh và xốt chanh dây thanh mát.",
            new[] { "Cá hồi Na Uy tươi phi lê", "Bơ sáp", "Rau xà lách Romaine", "Cà chua bi", "Xốt chanh dây mật ong" },
            new[] { "Chef Choice", "Premium", "Healthy" }, 240, 0, 8, false, KitchenStationType.ColdDessertStation, NoMods),

        // TEMPURA & FRIED (4)
        new("TEMPURA", "TEMP-01", "Ebi Tempura Moriawase", "海老天ぷら盛り合わせ", "ebi-tempura-moriawase",
            185000m, null, "https://images.unsplash.com/photo-1615361200141-f45040f367be?auto=format&fit=crop&w=800&q=80",
            "Phần tempura tổng hợp gồm 4 con tôm sú biển lớn và các loại rau củ Nhật Bản (bí đỏ Kabocha, cà tím, nấm hương, đậu bắp), chiên trong dầu mè tinh khiết giòn rụm.",
            new[] { "Tôm sú biển", "Bí đỏ Kabocha", "Nấm hương tươi", "Cà tím", "Nước chấm Tentsuyu củ cải mài" },
            new[] { "Best Seller" }, 490, 0, 10, true, KitchenStationType.FryGrillStation, NoMods),
        new("TEMPURA", "TEMP-02", "Soft Shell Crab Tempura", "ソフトシェルクラブ天ぷら", "soft-shell-crab-tempura",
            210000m, null, "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=800&q=80",
            "Cua lột nguyên con chiên giòn ăn được cả vỏ, thịt cua ngọt đậm béo ngậy chấm cùng muối tiêu Matcha Shio đặc sắc.",
            new[] { "Cua lột tươi", "Bột Tempura truyền thống", "Muối trà xanh Matcha Shio", "Chanh vàng" },
            new[] { "Chef Choice" }, 430, 0, 12, false, KitchenStationType.FryGrillStation, NoMods),
        new("TEMPURA", "KARA-01", "Chicken Karaage Yuzu Mayo", "鶏のから揚げ 柚子マヨ", "chicken-karaage-yuzu-mayo",
            115000m, null, "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80",
            "Thịt đùi gà rút xương ướp nước tương gừng tỏi 6 tiếng, áo bột giòn tan bên ngoài mọng nước bên trong, chấm cùng sốt Yuzu Mayonnaise thơm mùi vỏ quýt.",
            new[] { "Thịt đùi gà tươi", "Sốt ướp Shoyu gừng", "Sốt chấm Yuzu Mayonnaise", "Chanh tươi" },
            new[] { "Popular" }, 510, 0, 8, false, KitchenStationType.FryGrillStation, NoMods),
        new("TEMPURA", "TEMP-03", "Kaki Fry - Hàu Sữa Hiroshima Chiên Xù", "カキフライ", "kaki-fry-hiroshima",
            165000m, null, "https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=800&q=80",
            "Hàu sữa tươi vùng vịnh Hiroshima béo ngậy được tẩm bột xù Panko chiên vàng ruộm, ăn kèm sốt Tartar hành tây thơm béo.",
            new[] { "Hàu sữa Hiroshima", "Bột xù Panko Nhật", "Sốt Tartar trứng luộc", "Bắp cải thái sợi" },
            new[] { "Signature" }, 440, 0, 10, false, KitchenStationType.FryGrillStation, NoMods),

        // WAGYU & GRILL (4)
        new("WAGYU", "WAGYU-01", "A5 Wagyu Miyazaki Sirloin Steak (150g)", "宮崎牛A5サーロインステーキ", "a5-wagyu-miyazaki-sirloin-steak",
            890000m, 980000m, "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80",
            "Đỉnh cao thịt bò Wagyu A5 đến từ tỉnh Miyazaki từng đoạt giải quán quân Wagyu Olympic. Từng thớ thịt có vân mỡ tuyết BMS 10 tan chảy ngay ở nhiệt độ 25°C, phục vụ xèo xèo trên đĩa gang nóng cùng tỏi chiên giòn.",
            new[] { "Thịt thăn bò Wagyu Miyazaki A5", "Tỏi cô đơn chiên giòn", "Muối khoáng Himalaya", "Wasabi tươi", "Xốt Ponzu tiêu đen" },
            new[] { "Best Seller", "Signature", "Premium" }, 650, 0, 15, true, KitchenStationType.FryGrillStation, WagyuMods),
        new("WAGYU", "WAGYU-02", "Wagyu Kushiyaki Skewers (3 Xiên)", "和牛串焼き", "wagyu-kushiyaki-skewers",
            260000m, null, "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
            "Thịt bò Wagyu thái quân cờ xiên que nướng than hoa Binchotan hoa lửa, quét lớp xốt Tare đậu nành ngọt dịu thơm nức mùi khói.",
            new[] { "Thịt bò Wagyu", "Ớt chuông đỏ xanh", "Hành baro", "Xốt Tare mật ong" },
            new[] { "Popular" }, 420, 0, 12, false, KitchenStationType.FryGrillStation, WagyuMods),
        new("WAGYU", "GRILL-01", "Unagi Kabayaki - Lươn Nhật Nướng Tare", "鰻蒲焼き", "unagi-kabayaki-tare",
            340000m, null, "https://images.unsplash.com/photo-1583394293214-28ded15ee548?auto=format&fit=crop&w=800&q=80",
            "Lươn đồng Nhật nướng than hoa theo kỹ thuật Kansai da giòn thịt ngọt, quét xốt Tare bí truyền gia truyền qua 3 thế hệ, rắc bột tiêu Sansho cay nhẹ.",
            new[] { "Lươn Nhật Unagi tươi", "Xốt Tare truyền thống", "Tiêu Sansho Nhật Bản" },
            new[] { "Signature", "Chef Choice" }, 480, 1, 14, true, KitchenStationType.FryGrillStation, NoMods),
        new("WAGYU", "GRILL-02", "Gyu Tan Shio - Lưỡi Bò Nướng Muối Tiêu", "牛タン塩焼き", "gyu-tan-shio-lemon",
            220000m, null, "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
            "Phần cuống lưỡi bò nướng than hoa giòn sần sật đặc trưng phong cách Sendai, nêm muối biển và hạt tiêu đen, vắt thêm nước cốt chanh tươi chua thanh.",
            new[] { "Lưỡi bò cắt lát vừa", "Muối biển", "Hành paro băm nhỏ", "Chanh tươi vắt" },
            new[] { "Popular" }, 360, 0, 10, false, KitchenStationType.FryGrillStation, NoMods),

        // DONBURI (4)
        new("DONBURI", "DON-01", "Salmon Ikura Don - Cơm Hồi Trứng Cá", "鮭イクラ丼", "salmon-ikura-don",
            265000m, null, "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=800&q=80",
            "Thố cơm đầy ắp từng lát cá hồi tươi Na Uy phi lê bóng mượt cùng trứng cá hồi ngâm tương Ikura nổ tanh tách béo ngậy, phủ rong biển sợi Nori trên nền cơm giấm dẻo hạt.",
            new[] { "Cá hồi tươi phi lê", "Trứng cá hồi Ikura", "Cơm giấm Koshihikari", "Tía tô Shiso", "Rong biển Nori sợi" },
            new[] { "Best Seller", "Signature" }, 580, 0, 10, true, KitchenStationType.ColdDessertStation, DonburiMods),
        new("DONBURI", "DON-02", "Unadon Tokujo - Cơm Lươn Thố Đá Đặc Biệt", "うな丼 特上", "unadon-tokujo-special",
            320000m, 360000m, "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
            "Nguyên con lươn Nhật nướng sốt Tare dày thịt phủ kín mặt thố đá giữ nhiệt, nước sốt lươn ngấm sâu vào từng hạt cơm Nhật nóng hổi rưới chút gừng chua.",
            new[] { "Lươn nướng nguyên con", "Cơm trắng Niigata", "Sốt Tare gia truyền", "Gừng đỏ Gari" },
            new[] { "Popular", "Chef Choice" }, 640, 0, 12, true, KitchenStationType.FryGrillStation, DonburiMods),
        new("DONBURI", "DON-03", "Gyudon Truffle Onsen Tamago", "トリュフ牛丼 温泉卵", "gyudon-truffle-onsen-tamago",
            175000m, null, "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
            "Thịt bò Mỹ thái mỏng hầm cùng hành tây ngọt nước tương Mirin, ăn kèm trứng suối lòng đào Onsen béo ngậy và hương dầu nấm Truffle sang trọng.",
            new[] { "Thịt bò Mỹ bào mỏng", "Hành tây caramel", "Trứng lòng đào Onsen", "Tinh dầu nấm Truffle" },
            new[] { "Popular" }, 620, 0, 8, false, KitchenStationType.NoodleStation, DonburiMods),
        new("DONBURI", "DON-04", "Chirashi Don Hải Sản Thượng Hạng", "特選ちらし寿司丼", "chirashi-don-seafood-bowl",
            350000m, null, "https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=800&q=80",
            "Bát ngọc biển sâu quy tụ cá hồi, cá ngừ Akami, cá cam Hamachi, sò đỏ, tôm luộc, trứng cá chuồn Tobiko và trứng cuộn Tamagoyaki ngọt dịu.",
            new[] { "Cá hồi", "Cá ngừ", "Hamachi", "Sò đỏ", "Trứng cá chuồn", "Trứng cuộn Tamago", "Cơm giấm" },
            new[] { "Chef Choice" }, 520, 0, 10, false, KitchenStationType.ColdDessertStation, DonburiMods),

        // DRINKS & SAKE (4)
        new("DRINKS", "SAKE-01", "Dassai 23 Junmai Daiginjo (Chai 300ml)", "獺祭 磨き二割三分", "dassai-23-junmai-daiginjo-300ml",
            950000m, null, "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=800&q=80",
            "Tuyệt phẩm rượu Sake số một Nhật Bản, gạo Yamada Nishiki được mài tỉ mỉ tới 23% hạt. Hương thơm tinh tế của hoa quả nhiệt đới, dưa lưới và mật ong rừng với hậu vị mượt như nhung.",
            new[] { "Gạo Yamada Nishiki (tỷ lệ mài 23%)", "Men Koji Nhật", "Nước suối ngầm tinh khiết Yamaguchi" },
            new[] { "Premium", "Best Seller" }, 220, 0, 3, true, KitchenStationType.BeverageStation, SakeMods),
        new("DRINKS", "SAKE-02", "Kubota Senju Ginjo (Chai 300ml)", "久保田 千寿", "kubota-senju-ginjo-300ml",
            480000m, null, "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=800&q=80",
            "Dòng sake phong cách Tanrei Karakuchi khô ráo thanh mát từ vùng Niigata tuyết trắng. Vị êm dịu, sảng khoái và cực kỳ hoàn hảo khi kết hợp với Sashimi và bò nướng.",
            new[] { "Gạo Gohyakumangoku Niigata", "Nước suối ngầm tuyết tan" },
            new[] { "Popular" }, 210, 0, 3, false, KitchenStationType.BeverageStation, SakeMods),
        new("DRINKS", "DRINK-01", "Ume Shu Choya Shiso Plum Wine (Ly)", "チョーヤ 梅酒", "ume-shu-choya-shiso",
            120000m, null, "https://images.unsplash.com/photo-1541832676-9b763b0239ab?auto=format&fit=crop&w=800&q=80",
            "Rượu mơ Nhật Bản Choya ngâm cùng quả mơ Nanko tươi mọng và lá tía tô đỏ Shiso, vị chua ngọt kích thích vị giác sảng khoái tuyệt đối.",
            new[] { "Mơ Nanko Nhật Bản", "Rượu chưng cất", "Lá tía tô đỏ Shiso", "Đường phèn" },
            new[] { "Popular" }, 160, 0, 3, false, KitchenStationType.BeverageStation, NoMods),
        new("DRINKS", "DRINK-02", "Trà Xanh Genmaicha Gạo Lứt Rang (Ấm)", "玄米茶", "tra-xanh-genmaicha-gao-lut",
            45000m, null, "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80",
            "Lá trà xanh Sencha hòa trộn cùng hạt gạo lứt rang vàng óng, tỏa hương thơm nồng ấm dân dã, giúp thanh lọc cơ thể và cân bằng tiêu hóa sau bữa ăn.",
            new[] { "Lá trà xanh Sencha Shizuoka", "Gạo lứt rang hữu cơ" },
            new[] { "Signature" }, 5, 0, 5, false, KitchenStationType.BeverageStation, NoMods),

        // DESSERTS (3)
        new("DESSERT", "DES-01", "Uji Matcha Parfait Tokusen", "宇治抹茶パフェ", "uji-matcha-parfait-tokusen",
            95000m, null, "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=800&q=80",
            "Ly parfait nhiều tầng với kem tươi trà xanh Uji Kyoto hảo hạng, đậu đỏ Azuki nghiền ngọt bùi, viên dẻo Shiratama dẻo dai và thạch Matcha thạch sương sáo thanh nhiệt.",
            new[] { "Bột matcha Uji Kyoto", "Đậu đỏ Azuki Hokkaido", "Viên nếp Shiratama", "Kem tươi Hokkaido" },
            new[] { "Best Seller", "Chef Choice" }, 320, 0, 6, true, KitchenStationType.ColdDessertStation, NoMods),
        new("DESSERT", "DES-02", "Mochi Ice Cream Trio (3 Vị)", "もちアイス 3種盛り", "mochi-ice-cream-trio",
            75000m, null, "https://images.unsplash.com/photo-1505394033641-40c6ad1178d7?auto=format&fit=crop&w=800&q=80",
            "Set 3 viên bánh dẻo Mochi bọc kem lạnh thượng hạng với 3 hương vị: Trà xanh Matcha, Đậu đỏ Azuki và Mè đen mè rang Kurogoma.",
            new[] { "Vỏ nếp Mochi dẻo", "Kem trà xanh", "Kem mè đen", "Kem đậu đỏ" },
            new[] { "Popular" }, 240, 0, 5, false, KitchenStationType.ColdDessertStation, NoMods),
        new("DESSERT", "DES-03", "Raindrop Cake - Mizu Shingen Mochi", "水信玄餅", "raindrop-cake-mizu-shingen-mochi",
            65000m, null, "https://images.unsplash.com/photo-1587314168485-3236d6710814?auto=format&fit=crop&w=800&q=80",
            "Bánh giọt nước trong vắt như viên pha lê làm từ nước suối dãy Alps Nhật Bản, rưới mật mía đen Kuromitsu thơm lừng và bột đậu nành rang Kinako.",
            new[] { "Nước khoáng tinh khiết", "Bột thạch Agar Nhật", "Mật mía đen Kuromitsu", "Bột đậu nành Kinako" },
            new[] { "Signature" }, 110, 0, 5, false, KitchenStationType.ColdDessertStation, NoMods),
    };

    public static readonly string[] LegacyUnavailableDishCodes = Array.Empty<string>();

    public static readonly TableAreaSeed[] TableAreas =
    {
        new("BAR", "Quầy Omakase & Sushi Bar", "寿司カウンター席",
            "Trải nghiệm ngồi trực diện trước mặt bếp trưởng Omakase, thưởng lãm từng đường dao điêu luyện cắt thái cá tươi sống.",
            "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80",
            new[] { "Tương tác trực tiếp cùng Bếp trưởng", "Phục vụ từng miếng sushi nóng hổi", "Ghế đơn gỗ bách Hinoki sang trọng" },
            "1 - 2 khách / vị trí", 1, 4, false, null, 1),
        new("TATAMI", "Phòng Riêng Chiếu Tatami", "畳個室",
            "Không gian phòng riêng chuẩn văn hóa Nhật Bản với chiếu rơm Tatami tự nhiên, bàn chìm Horigotatsu để chân thoải mái và vách ngăn Shoji.",
            "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=600&q=80",
            new[] { "Cách âm yên tĩnh 100%", "Bàn chìm Horigotatsu không mỏi chân", "Phù hợp gia đình và đối tác quan trọng" },
            "4 - 8 khách / phòng", 4, 8, true, 50000m, 2),
        new("MAIN", "Sảnh Tiệc Chính Sakura", "メインホール",
            "Không gian sảnh rộng thoáng với đèn lồng lụa Washi phong cách Tokyo hiện đại, âm nhạc Shamisen êm dịu tạo không khí dùng bữa ấm cúng.",
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
            new[] { "Không gian mở ấm cúng", "Bàn 2 - 6 người linh hoạt ghép bàn", "View vườn tiểu cảnh phong cách Zen" },
            "2 - 6 khách / bàn", 1, 12, false, null, 3),
        new("VIP", "Phòng VIP Thương Gia & Bonsai", "VIP貴賓室",
            "Phòng tiệc hoàng gia với vườn Bonsai mini độc bản, phục vụ riêng một nhân viên phục vụ và tủ rượu Sake sưu tầm quý hiếm.",
            "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80",
            new[] { "Nhân viên quản gia riêng (Butler)", "Sân vườn Bonsai ngắm cảnh", "Hệ thống âm thanh ánh sáng tùy chỉnh" },
            "8 - 20 khách / phòng", 8, 20, true, 100000m, 4),
    };

    public static readonly TableSeed[] Tables =
    {
        new("MAIN", "T1-01", 4, 2),
        new("MAIN", "T1-02", 4, 2),
        new("MAIN", "T1-03", 6, 3),
        new("MAIN", "T1-04", 2, 1),
        new("VIP", "VIP-01", 10, 6),
        new("VIP", "VIP-02", 8, 4),
        new("VIP", "VIP-03", 20, 8),
        new("BAR", "BAR-01", 2, 1),
        new("BAR", "BAR-02", 2, 1),
        new("TATAMI", "TAT-01", 6, 4),
        new("TATAMI", "TAT-02", 8, 4),
    };

    public static readonly VoucherSeed[] Vouchers =
    {
        new("KAISEKI10", "Ưu đãi Thưởng Vị 10%",
            "Giảm 10% tổng hóa đơn cho đơn hàng từ 500.000₫ (Giảm tối đa 100.000₫)",
            DiscountType.Percentage, 10m, 500000m, 100000m,
            new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 12, 31, 23, 59, 59, DateTimeKind.Utc), 1000, 2),
        new("WAGYU50K", "Tặng 50.000₫ Món Nướng",
            "Giảm trực tiếp 50.000₫ cho đơn hàng món ăn có giá trị từ 400.000₫",
            DiscountType.FixedAmount, 50000m, 400000m, 50000m,
            new DateTime(2026, 10, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 12, 31, 23, 59, 59, DateTimeKind.Utc), 1000, 2),
        new("SAKURA15", "Đại Tiệc Sakura 15%",
            "Giảm ngay 15% cho hóa đơn tiệc từ 800.000₫ (Giảm tối đa 150.000₫)",
            DiscountType.Percentage, 15m, 800000m, 150000m,
            new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 12, 31, 23, 59, 59, DateTimeKind.Utc), 1000, 2),
        new("JAPANFOOD50K", "Tri Ân Khách Hàng Thân Thiết",
            "Giảm trực tiếp 50.000₫ cho đơn hàng tối thiểu từ 200.000₫",
            DiscountType.FixedAmount, 50000m, 200000m, 50000m,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 12, 31, 23, 59, 59, DateTimeKind.Utc), 1000, 2),
        new("WELCOME20", "Chào Mừng Thành Viên Mới 20%",
            "Giảm 20% cho đơn hàng đầu tiên từ 150.000₫ (Giảm tối đa 100.000₫)",
            DiscountType.Percentage, 20m, 150000m, 100000m,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 12, 31, 23, 59, 59, DateTimeKind.Utc), 500, 1),
        new("SUSHI100", "Ưu Đãi Tiệc Sushi 100.000₫",
            "Giảm trực tiếp 100.000₫ cho đơn hàng từ 500.000₫",
            DiscountType.FixedAmount, 100000m, 500000m, 100000m,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2027, 12, 31, 23, 59, 59, DateTimeKind.Utc), 300, 1),
    };

    public static readonly BranchSeed[] Branches =
    {
        new("branch-d1-hcmc", "Chi nhánh 1: Flagship Lê Thánh Tôn - Tokyo Town", "レタントン本店",
            "15A/2 Lê Thánh Tôn, Phường Bến Nghé, Quận 1", "Quận 1", "TP. Hồ Chí Minh",
            "028 3822 8899", "0903 123 456", "flagship@torisakura.vn",
            "10:30 - 14:00", "17:00 - 22:30", "Mở cửa tất cả các ngày trong tuần (kể cả Lễ, Tết)",
            "Giữ xe máy miễn phí ngay trước sảnh nhà hàng có bảo vệ trông",
            "Bãi đỗ xe ô tô tại Tòa nhà Vincom Center Đồng Khởi (cách 100m, nhà hàng hoàn trả 100% vé giữ xe)",
            "https://maps.google.com/?q=15A+Le+Thanh+Ton+District+1+HCMC",
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.447879948074!2d106.7028163!3d10.7769493!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752f46820542d1%3A0x6b5a34bb99bc5462!2zMTVBIEzDqiBUaMOhbmggVMO0biwgQuG6v24gTmdow6ksIFF14bqtbiAxLCBUaMOgbmggcGjhu5EgSOG7kyBDaMOtIE1pbmg!5e0!3m2!1svi!2s!4v1700000000000",
            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
            true, 1),
        new("branch-thaodien", "Chi nhánh 2: Thảo Điền Garden Villa & Tatami", "タオディエン庭園店",
            "68 Xuân Thủy, Phường Thảo Điền, TP. Thủ Đức", "TP. Thủ Đức", "TP. Hồ Chí Minh",
            "028 3744 6688", "0909 654 321", "thaodien@torisakura.vn",
            "10:30 - 14:00", "17:00 - 22:30", "Có khu vui chơi trẻ em và sân vườn ngoài trời phong cách Zen",
            "Sân giữ xe máy rộng rãi trong khuôn viên biệt thự",
            "Bãi đỗ ô tô miễn phí sức chứa 15 xe ngay trong sân nhà hàng",
            "https://maps.google.com/?q=68+Xuan+Thuy+Thao+Dien+Thu+Duc",
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.0617304724873!2d106.7329524!3d10.8065842!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752618991244bb%3A0x62a0ee12fefc2a9e!2zNjggWHXDom4gVGjhu6d5LCBUaOG6o28gxJBp4buBbiwgVGjhu6cgxJDhu6ljLCBUaMOgbmggcGjhu5EgSOG7kyBDaMOtIE1pbmg!5e0!3m2!1svi!2s!4v1700000000001",
            "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80",
            false, 2),
        new("branch-badinh-hanoi", "Chi nhánh 3: Ba Đình Heritage House", "ハノイ バーディン店",
            "36 Kim Mã, Phường Kim Mã, Quận Ba Đình", "Quận Ba Đình", "Hà Nội",
            "024 3726 9988", "0912 345 678", "hanoi@torisakura.vn",
            "10:30 - 14:00", "17:00 - 22:00", "Phòng VIP phong cách cố đô Kyoto cổ kính",
            "Nhân viên bảo vệ dắt và giữ xe máy miễn phí",
            "Hầm giữ xe tòa nhà đối diện (có tài xế valet parking hỗ trợ đánh xe)",
            "https://maps.google.com/?q=36+Kim+Ma+Ba+Dinh+Ha+Noi",
            "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3724.015243162601!2d105.8236124!3d21.0320752!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3135ab764f6993c1%3A0x442dfd08c5806c9a!2zMzYgS2ltIE3DoywgS2ltIE3DoywgQmEgxJDDrG5oLCBIw6AgTuG7mWk!5e0!3m2!1svi!2s!4v1700000000002",
            "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80",
            false, 3),
    };

    public static readonly BlogSeed[] BlogPosts =
    {
        new("nghe-thuat-thuong-thuc-sushi-edomae",
            "Nghệ Thuật Thưởng Thức Sushi Đúng Điệu Từ Các Bậc Thầy Edomae",
            "Những quy tắc bất thành văn giúp bạn cảm nhận trọn vẹn vị tươi ngon tinh khiết",
            "江戸前寿司の美学",
            "Cuisine Culture",
            "Kenji Takahashi",
            "Bếp trưởng Omakase (Executive Chef)",
            "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80",
            "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=1200&q=80",
            new DateTime(2026, 11, 15, 9, 0, 0, DateTimeKind.Utc), 6,
            "Khám phá cách chấm mặt cá thay vì cơm giấm, vai trò giải vị của gừng hồng Gari, và lý do vì sao ăn sushi bằng tay trần lại là sự tôn kính tuyệt đối với nghệ nhân.",
            """
            ### 1. Chấm mặt cá, tuyệt đối không chấm mặt cơm
            Sai lầm phổ biến nhất của thực khách là nhúng toàn bộ viên sushi vào đĩa nước tương Shoyu. Cơm giấm (Shari) khi hút nước tương sẽ lập tức rã nát và làm mặn chát vị giác. Hãy nhẹ nhàng nghiêng viên sushi và chỉ chấm nhẹ phần thịt cá (Neta) vào nước tương.

            ### 2. Dùng tay trần là văn hóa đỉnh cao
            Tại các quầy Omakase danh giá ở Tokyo, các đầu bếp hàng đầu luôn khuyến khích thực khách dùng ngón cái và ngón trỏ để cầm sushi. Nhiệt độ ấm áp từ bàn tay đầu bếp truyền vào hạt cơm sẽ được giữ nguyên vẹn khi bạn thưởng thức bằng tay trần trong vòng 5 giây sau khi ra món.

            ### 3. Gừng hồng Gari - Chiếc chìa khóa thanh lọc vòm họng
            Gừng ngâm chua ngọt không phải là món ăn kèm nhồi nhét cùng lúc với sushi. Hãy ăn một lát gừng nhỏ giữa hai loại cá khác nhau (ví dụ từ cá ngừ nạc sang cá hồi béo) để làm sạch hoàn toàn vị giác còn đọng lại trước đó.
            """,
            new[] { "Sushi", "Edomae", "Văn hóa Nhật", "Omakase" },
            new[] { "SASHIMI-01", "SUSHI-01", "SASHIMI-02", "SUSHI-02" }),

        new("tieu-chuan-phan-hang-bo-wagyu-a5-bms",
            "Giải Mã Tiêu Chuẩn Thịt Bò Wagyu A5 BMS 8-12: Vì Sao Đắt Giá Nhất Hành Tinh?",
            "Hiểu đúng về hệ thống chấm điểm khắt khe của Hiệp hội Xếp hạng Thịt Nhật Bản (JMGA)",
            "和牛A5ランクとBMS基準の真実",
            "Ingredients & Sourcing",
            "Trần Minh Đức",
            "Chuyên gia Giám định Nguyên liệu F&B",
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
            "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80",
            new DateTime(2026, 11, 10, 9, 0, 0, DateTimeKind.Utc), 8,
            "Chữ A biểu thị tỷ lệ thịt ăn được, số 5 đại diện cho chất lượng vân mỡ cao nhất, và chỉ số BMS từ 8 đến 12 là minh chứng cho miếng thịt có độ tan chảy kỳ diệu.",
            """
            ### Thang điểm A1 đến A5 nghĩa là gì?
            - **Chữ cái (A, B, C):** Điểm năng suất (Yield Grade), đo lường tỷ lệ thịt tinh khiết thu được từ một cá thể bò sau khi loại bỏ xương và mỡ thừa. Cấp A là tiêu chuẩn cao nhất.
            - **Con số (1 đến 5):** Đánh giá tổng hợp 4 tiêu chí: Độ vân mỡ cẩm thạch (BMS), màu sắc và độ sáng của thịt (BCS), độ săn chắc và kết cấu thớ thịt, màu sắc và chất lượng mỡ (BFS).

            ### Chỉ số cẩm thạch BMS (Beef Marbling Score)
            Chỉ những miếng thịt đạt BMS từ 8 đến 12 mới được chứng nhận hạng A5 thượng phẩm. Axit béo Oleic không no trong mỡ bò Wagyu có nhiệt độ nóng chảy thấp đến mức chỉ cần chạm vào đầu ngón tay là mỡ đã bắt đầu tan ra, mang lại cảm giác ngậy béo thanh khiết mà không hề gây ngấy.
            """,
            new[] { "Wagyu", "A5 Wagyu", "BMS", "Thịt bò Nhật" },
            new[] { "WAGYU-01", "WAGYU-02" }),

        new("hanh-trinh-hai-san-cho-toyosu-tokyo",
            "Hành Trình Hải Sản Chợ Đầu Mối Toyosu Tokyo: Từ Cảng Biển Đến Bàn Ăn Trong 24 Giờ",
            "Quy trình đấu giá lúc 4 giờ sáng và kỹ thuật sơ chế khử tanh Ikejime bảo toàn độ tươi",
            "豊洲市場から食卓への24時間",
            "Ingredients & Sourcing",
            "Kenji Takahashi",
            "Bếp trưởng Omakase",
            "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80",
            "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=1200&q=80",
            new DateTime(2026, 11, 5, 9, 0, 0, DateTimeKind.Utc), 7,
            "Mỗi tuần 3 chuyến bay vận chuyển lạnh chuyên dụng đưa cá ngừ vây xanh, sò điệp Hokkaido và cầu gai Uni cập cảng Tân Sơn Nhất và Nội Bài thẳng tiến bếp Tori Sakura.",
            """
            ### Phiên đấu giá nghìn đô lúc 4:30 sáng
            Tại sàn đấu giá chợ cá Toyosu mới (thay thế chợ Tsukiji lịch sử), các chuyên gia thu mua của Tori Sakura kiểm tra phần đuôi cắt mẫu của từng con cá ngừ đại dương. Chỉ những cá thể cá hồi Na Uy và cá ngừ Hon Maguro đạt chứng chỉ bơi ngược dòng nước lạnh sâu mới được lựa chọn.

            ### Kỹ thuật thần kinh Ikejime
            Ngay sau khi kéo lên mạn thuyền, cá được gây tê tủy sống bằng một thanh thép mảnh (Ikejime). Phương pháp này ngăn chặn việc giải phóng axit lactic và chất gây căng thẳng, giữ cho thịt cá trắng ngần, cơ thịt mềm và vị ngọt tự nhiên không hề có mùi tanh khó chịu.
            """,
            new[] { "Toyosu", "Hải sản tươi", "Ikejime", "Sashimi" },
            new[] { "SASHIMI-01", "SASHIMI-02", "SUSHI-02", "SASHIMI-03" }),

        new("bi-mat-18-tieng-ninh-nuoc-dung-tonkotsu",
            "Bí Mật 18 Tiếng Ninh Nước Súp Tonkotsu Của Nghệ Nhân Ramen",
            "Nghệ thuật chiết xuất collagen tủy xương và công thức tương Tare bí truyền",
            "豚骨スープ18時間の極意",
            "Culinary Art",
            "Nguyễn Hải Đăng",
            "Bếp phó Trạm Mì Noodle Station",
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80",
            "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1200&q=80",
            new DateTime(2026, 10, 28, 9, 0, 0, DateTimeKind.Utc), 5,
            "Nồi hầm áp suất lửa lớn liên tục khuấy đảo chuyển hóa tủy xương thành nhũ tương sánh mịn màu trắng sữa ngọc trai giàu collagen tái tạo sinh lực.",
            """
            ### Ngọn lửa sôi cuộn mãnh liệt
            Khác với nước súp trong vắt Consommé của phương Tây đòi hỏi lửa riu riu hớt bọt, nước dùng Tonkotsu vùng Hakata bắt buộc phải được đun sôi sùng sục ở nhiệt độ trên 100°C liên tục suốt 18 tiếng. Sự va đập của tủy xương heo và mỡ lưng tạo nên hiện tượng nhũ hóa tự nhiên, hòa quyện chất béo và nước thành một dung dịch trắng sữa béo thơm.

            ### Nước cốt Tare - Linh hồn định đoạt hương vị
            Nước dùng xương chỉ là thân xác, còn nước sốt Tare được nấu cô đặc từ cá bào Katsuobushi, tảo bẹ Kombu đảo Rishiri và rượu Mirin lâu năm mới chính là linh hồn mang lại vị Umami bùng nổ trong từng muỗng súp.
            """,
            new[] { "Ramen", "Tonkotsu", "Ẩm thực Nhật Bản", "Nước dùng" },
            new[] { "RAMEN-01", "RAMEN-02", "RAMEN-04" }),

        new("van-hoa-thuong-thuc-ruou-sake",
            "Văn Hóa Thưởng Thức Rượu Sake: Từ Nghi Thức Đền Chùa Đến Bàn Tiệc Hiện Đại",
            "Khám phá thế giới Sake từ Junmai Daiginjo đến nghi thức nâng chén Kanpai truyền thống",
            "日本酒の文化と心",
            "Cuisine Culture",
            "Kenji Takahashi",
            "Bếp trưởng Omakase (Executive Chef)",
            "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80",
            "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1200&q=80",
            new DateTime(2026, 10, 20, 9, 0, 0, DateTimeKind.Utc), 6,
            "Sake không đơn thuần là một thức uống có cồn, mà là tinh hoa văn hóa nghìn năm phản chiếu tâm hồn và sự tôn kính thiên nhiên của người Nhật.",
            """
            ### 1. Nguồn gốc thiêng liêng từ những ngôi đền Thần Đạo (Shinto)
            Từ xa xưa, Sake (Nihonshu) được ủ từ những hạt gạo tinh túy nhất của vụ mùa để dâng lên các vị thần linh (Kami) như lời tạ ơn đất trời mưa thuận gió hòa. Cho đến nay, trong các lễ hội Matsuri và đám cưới truyền thống, nghi thức đập thùng rượu thiêng Kagami Biraki vẫn là biểu tượng của sự may mắn, khởi đầu hanh thông và gắn kết cộng đồng.

            ### 2. Các phân hạng Sake: Tỷ lệ mài gạo Seimai Buai
            Độ tinh khiết của Sake được quyết định bởi tỷ lệ mài bỏ lớp vỏ cám bên ngoài của hạt gạo:
            - **Junmai:** Rượu gạo nguyên chất, đậm đà vị Umami tự nhiên của hạt gạo.
            - **Ginjo:** Gạo được mài ít nhất 40% (chỉ giữ lại 60% tâm gạo), lên men ở nhiệt độ thấp cho hương thơm trái cây và hoa cỏ tinh tế.
            - **Daiginjo thượng phẩm:** Gạo được mài tỉ mỉ từ 50% đến hơn 70%, tạo nên giọt rượu trong vắt với hậu vị thanh tao, sâu lắng như suối nguồn mùa xuân.

            ### 3. Nghệ thuật chọn nhiệt độ thưởng thức: Atsukan và Reishu
            Tùy thuộc vào thời tiết và món ăn đi kèm, Sake có thể được thưởng thức ở nhiều cung bậc nhiệt độ khác nhau:
            - **Reishu (Ướp lạnh 5 - 10°C):** Lý tưởng khi dùng kèm Sashimi cá ngừ O-Toro và hải sản tươi sống để tôn lên vị ngọt thanh.
            - **Atsukan (Hâm nóng 45 - 50°C):** Hoàn hảo cho những ngày mưa lạnh, đánh thức trọn vẹn hương men gạo nồng ấm bên nồi lẩu nướng Wagyu Sukiyaki.
            """,
            new[] { "Sake", "Nihonshu", "Văn hóa Nhật", "Đồ uống" },
            new[] { "DRINK-01", "DRINK-02", "SASHIMI-01" }),

        new("nghe-thuat-thuong-thuc-sashimi-chuan-edo",
            "Nghệ Thuật Cắt Thái Dao Nhật Hocho & Đỉnh Cao Trình Bày Sashimi",
            "Bí quyết đằng sau từng lát cắt ngọt lịm bảo toàn cấu trúc tế bào cá tươi sống",
            "和包丁と刺身の美学",
            "Culinary Art",
            "Kenji Takahashi",
            "Bếp trưởng Omakase (Executive Chef)",
            "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=200&q=80",
            "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=1200&q=80",
            new DateTime(2026, 10, 15, 9, 0, 0, DateTimeKind.Utc), 7,
            "Một lát Sashimi hoàn hảo không chỉ đến từ độ tươi của hải sản mà được quyết định bởi linh hồn của thanh dao Hocho và giác quan chuẩn xác của nghệ nhân.",
            """
            ### 1. Thanh dao Hocho - Trái tim của gian bếp Nhật
            Khác với dao Tây phương vát đều hai bên (Double-bevel), dao Nhật truyền thống như Yanagiba (dao thái cá) hay Deba (dao phi-lê) chỉ được mài sắc một mặt duy nhất (Single-bevel). Góc vát đặc biệt này cho phép lưỡi dao lướt ngọt qua thớ thịt cá mà không làm vỡ các tế bào chứa nước và lipid, giữ nguyên độ óng ả và kết cấu mọng nước tự nhiên.

            ### 2. Các kỹ thuật cắt thái kinh điển
            Mỗi loại hải sản đòi hỏi một đường dao riêng biệt:
            - **Hira-zukuri (Cắt thẳng chữ nhật):** Dành cho cá hồi Sake và cá ngừ nạc Maguro, tạo độ dày 10mm chắc nịch, đầm vị.
            - **Sogi-zukuri (Cắt nghiêng lướt lưỡi):** Áp dụng cho các loại cá thịt trắng như cá tráp Madai, cắt lát mỏng tang như dải lụa để thực khách cảm nhận độ giòn dai tinh tế.
            - **Hiki-zukuri (Cắt kéo một đường dứt khoát):** Nghệ nhân đặt lưỡi dao từ gốc đến ngọn, kéo nhẹ một nhịp duy nhất, mặt cắt phẳng mịn phản chiếu ánh sáng như gương.

            ### 3. Triết lý thẩm mỹ Moritsuke: Thiên nhiên trên đĩa tiệc
            Sashimi không bao giờ được bày ngẫu nhiên. Quy tắc bất đối xứng (Fukinsei) và số lẻ (3, 5, 7 lát) mô phỏng những ngọn núi, dòng thác và hòn đảo trong tự nhiên. Ăn kèm củ cải bào Daikon và lá tía tô Shiso xanh mướt không chỉ để trang trí mà còn là chất kháng khuẩn tự nhiên giúp cân bằng sức khỏe cho thực khách.
            """,
            new[] { "Sashimi", "Dao Hocho", "Kỹ thuật bếp", "Nghệ nhân Nhật" },
            new[] { "SASHIMI-01", "SASHIMI-02", "SASHIMI-03", "SUSHI-01" }),
    };

    public static readonly ReviewSeed[] Reviews =
    {
        new("ORD-SEED-REV-01", "reviewer1@torisakura.vn", "+84901000001", "Hoàng Nhật Minh",
            "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=120&q=80",
            "RAMEN-01", 5,
            "Tô Tonkotsu Ramen ở đây đỉnh thực sự, nước dùng béo ngậy đúng chuẩn Hakata mình từng ăn ở Fukuoka. Sợi mì chọn mức cứng Kata cắn sần sật cực mê!",
            new DateTime(2026, 11, 18, 12, 0, 0, DateTimeKind.Utc), 24),
        new("ORD-SEED-REV-02", "reviewer2@torisakura.vn", "+84901000002", "Lê Thuỳ Trang",
            "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80",
            "SASHIMI-01", 5,
            "Thuyền Sashimi Moriawase 7 món tươi rói, con tôm Botan ngọt lịm còn miếng cá ngừ O-Toro thì tan chảy như bơ trong miệng. Không gian phòng Tatami riêng tư tuyệt đối!",
            new DateTime(2026, 11, 17, 12, 0, 0, DateTimeKind.Utc), 38),
        new("ORD-SEED-REV-03", "reviewer3@torisakura.vn", "+84901000003", "Trần Đình Quang",
            "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=120&q=80",
            "WAGYU-01", 5,
            "Bò Wagyu A5 Miyazaki nướng đá muối xứng đáng từng đồng tiền bát gạo. Mùi thơm ngậy bốc lên ngào ngạt, chấm chút mù tạt tươi Shizuoka là bùng nổ vị giác.",
            new DateTime(2026, 11, 16, 12, 0, 0, DateTimeKind.Utc), 19),
        new("ORD-SEED-REV-04", "reviewer4@torisakura.vn", "+84901000004", "Phạm Kiều Oanh",
            "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=120&q=80",
            "DON-01", 5,
            "Giao hàng cực kỳ chu đáo! Mình đặt ship COD có chuyển cọc trước 50% qua VietQR rất nhanh gọn, nhận hàng món ăn vẫn còn nóng hổi và đóng hộp gỗ bento rất đẹp.",
            new DateTime(2026, 11, 14, 12, 0, 0, DateTimeKind.Utc), 15),
        new("ORD-SEED-REV-05", "reviewer5@torisakura.vn", "+84901000005", "Nguyễn Thanh Tùng",
            "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
            "SUSHI-01", 4,
            "Sushi khò lửa Aburi vị Mentaiko ăn rất cuốn, nhân viên phục vụ cúi chào lễ phép đúng phong cách Nhật Bản Omotenashi. Sẽ quay lại cùng gia đình.",
            new DateTime(2026, 11, 12, 12, 0, 0, DateTimeKind.Utc), 11),
        new("ORD-SEED-REV-06", "reviewer6@torisakura.vn", "+84901000006", "Vũ Hải Yến",
            "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80",
            "DES-01", 5,
            "Món tráng miệng Matcha Parfait thanh ngọt, viên dẻo Shiratama mềm thơm và bột trà xanh thơm ngát không hề bị ngọt gắt. Rất đáng thử!",
            new DateTime(2026, 11, 9, 12, 0, 0, DateTimeKind.Utc), 22),
        new("ORD-SEED-REV-07", "reviewer7@torisakura.vn", "+84901000007", "Bùi Anh Tuấn",
            "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=120&q=80",
            "SAKE-01", 5,
            "Chai rượu Dassai 23 uống lạnh cùng với bạn bè trong phòng VIP Tatami thì không còn gì bằng. Dịch vụ rót rượu và tư vấn ẩm thực rất chuyên nghiệp.",
            new DateTime(2026, 11, 4, 12, 0, 0, DateTimeKind.Utc), 14),
        new("ORD-SEED-REV-08", "reviewer8@torisakura.vn", "+84901000008", "Đặng Mai Lan",
            "https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?auto=format&fit=crop&w=120&q=80",
            "DON-02", 4,
            "Lươn nướng Unadon sốt Tare đậm vị, thịt lươn mềm ngậy không bị tanh hay sót xương dăm. Giá cả rất tương xứng với chất lượng thực phẩm tươi sống.",
            new DateTime(2026, 10, 30, 12, 0, 0, DateTimeKind.Utc), 8),
    };
}
