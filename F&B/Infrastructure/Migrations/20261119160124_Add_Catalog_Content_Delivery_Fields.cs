using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Catalog_Content_Delivery_Fields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DESCRIPTION",
                table: "VOUCHERS",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TITLE",
                table: "VOUCHERS",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CAPACITY_PER_TABLE",
                table: "TABLE_AREAS",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DEPOSIT_PER_GUEST",
                table: "TABLE_AREAS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FEATURES",
                table: "TABLE_AREAS",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IMAGE_URL",
                table: "TABLE_AREAS",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JAPANESE_NAME",
                table: "TABLE_AREAS",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "MAX_GUESTS",
                table: "TABLE_AREAS",
                type: "int",
                nullable: false,
                defaultValue: 10);

            migrationBuilder.AddColumn<int>(
                name: "MIN_GUESTS",
                table: "TABLE_AREAS",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<bool>(
                name: "REQUIRES_DEPOSIT",
                table: "TABLE_AREAS",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "DELIVERY_ADDRESS",
                table: "ORDERS",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DELIVERY_FEE",
                table: "ORDERS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "DEPOSIT_AMOUNT",
                table: "ORDERS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "PAYMENT_METHOD",
                table: "ORDERS",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RECIPIENT_NAME",
                table: "ORDERS",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RECIPIENT_PHONE",
                table: "ORDERS",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "REMAINING_COD_AMOUNT",
                table: "ORDERS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<int>(
                name: "CALORIES",
                table: "MENU_ITEMS",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "INGREDIENTS",
                table: "MENU_ITEMS",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IS_FEATURED",
                table: "MENU_ITEMS",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<decimal>(
                name: "ORIGINAL_PRICE",
                table: "MENU_ITEMS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SLUG",
                table: "MENU_ITEMS",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SPICE_LEVEL",
                table: "MENU_ITEMS",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TAGS",
                table: "MENU_ITEMS",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "LIKES_COUNT",
                table: "MENU_ITEM_REVIEWS",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "ICON_NAME",
                table: "CATEGORIES",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "IMAGE_URL",
                table: "CATEGORIES",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "JAPANESE_NAME",
                table: "CATEGORIES",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BLOG_POSTS",
                columns: table => new
                {
                    BLOG_POST_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SLUG = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TITLE = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: false),
                    SUBTITLE = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    JAPANESE_TITLE = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CATEGORY = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    EXCERPT = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    CONTENT = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    COVER_IMAGE_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    AUTHOR_NAME = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    AUTHOR_ROLE = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    AUTHOR_AVATAR_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PUBLISHED_AT = table.Column<DateTime>(type: "datetime2", nullable: false),
                    READ_TIME_MINUTES = table.Column<int>(type: "int", nullable: false, defaultValue: 5),
                    TAGS = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RELATED_DISH_IDS = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IS_PUBLISHED = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BLOG_POSTS", x => x.BLOG_POST_ID);
                });

            migrationBuilder.CreateTable(
                name: "BRANCHES",
                columns: table => new
                {
                    BRANCH_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CODE = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    JAPANESE_NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ADDRESS = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    DISTRICT = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CITY = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PHONE = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    HOTLINE = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    EMAIL = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    OPENING_HOURS_LUNCH = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OPENING_HOURS_DINNER = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    OPENING_HOURS_NOTE = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PARKING_MOTORBIKE = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PARKING_CAR = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MAP_EMBED_URL = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    MAP_DIRECTIONS_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IMAGE_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IS_MAIN_BRANCH = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BRANCHES", x => x.BRANCH_ID);
                });

            migrationBuilder.CreateTable(
                name: "RESTAURANT_SETTINGS",
                columns: table => new
                {
                    RESTAURANT_SETTING_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SETTING_KEY = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    BRAND_NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    JAPANESE_NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    SLOGAN = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    HOTLINE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EMAIL = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    FACEBOOK_URL = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    INSTAGRAM_URL = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    BANK_NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BANK_ID = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ACCOUNT_NUMBER = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ACCOUNT_NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    BANK_BRANCH = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DEFAULT_QR_TEMPLATE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false, defaultValue: "compact2"),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RESTAURANT_SETTINGS", x => x.RESTAURANT_SETTING_ID);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDERS_DELIVERY_FEE",
                table: "ORDERS",
                sql: "[DELIVERY_FEE] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_OIM_PRICE_ADJUSTMENT",
                table: "ORDER_ITEM_MODIFIERS",
                sql: "[PRICE_ADJUSTMENT] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_OIM_QUANTITY",
                table: "ORDER_ITEM_MODIFIERS",
                sql: "[QUANTITY] > 0");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEMS_IS_FEATURED",
                table: "MENU_ITEMS",
                column: "IS_FEATURED");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEMS_SLUG",
                table: "MENU_ITEMS",
                column: "SLUG",
                unique: true,
                filter: "[SLUG] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_MENU_ITEMS_ORIGINAL_PRICE",
                table: "MENU_ITEMS",
                sql: "[ORIGINAL_PRICE] IS NULL OR [ORIGINAL_PRICE] >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_BLOG_POSTS_IS_PUBLISHED",
                table: "BLOG_POSTS",
                column: "IS_PUBLISHED");

            migrationBuilder.CreateIndex(
                name: "IX_BLOG_POSTS_SLUG",
                table: "BLOG_POSTS",
                column: "SLUG",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_BRANCHES_CODE",
                table: "BRANCHES",
                column: "CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RESTAURANT_SETTINGS_SETTING_KEY",
                table: "RESTAURANT_SETTINGS",
                column: "SETTING_KEY",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BLOG_POSTS");

            migrationBuilder.DropTable(
                name: "BRANCHES");

            migrationBuilder.DropTable(
                name: "RESTAURANT_SETTINGS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDERS_DELIVERY_FEE",
                table: "ORDERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OIM_PRICE_ADJUSTMENT",
                table: "ORDER_ITEM_MODIFIERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_OIM_QUANTITY",
                table: "ORDER_ITEM_MODIFIERS");

            migrationBuilder.DropIndex(
                name: "IX_MENU_ITEMS_IS_FEATURED",
                table: "MENU_ITEMS");

            migrationBuilder.DropIndex(
                name: "IX_MENU_ITEMS_SLUG",
                table: "MENU_ITEMS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_MENU_ITEMS_ORIGINAL_PRICE",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "DESCRIPTION",
                table: "VOUCHERS");

            migrationBuilder.DropColumn(
                name: "TITLE",
                table: "VOUCHERS");

            migrationBuilder.DropColumn(
                name: "CAPACITY_PER_TABLE",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "DEPOSIT_PER_GUEST",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "FEATURES",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "IMAGE_URL",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "JAPANESE_NAME",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "MAX_GUESTS",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "MIN_GUESTS",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "REQUIRES_DEPOSIT",
                table: "TABLE_AREAS");

            migrationBuilder.DropColumn(
                name: "DELIVERY_ADDRESS",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "DELIVERY_FEE",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "DEPOSIT_AMOUNT",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "PAYMENT_METHOD",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "RECIPIENT_NAME",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "RECIPIENT_PHONE",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "REMAINING_COD_AMOUNT",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "CALORIES",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "INGREDIENTS",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "IS_FEATURED",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "ORIGINAL_PRICE",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "SLUG",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "SPICE_LEVEL",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "TAGS",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "LIKES_COUNT",
                table: "MENU_ITEM_REVIEWS");

            migrationBuilder.DropColumn(
                name: "ICON_NAME",
                table: "CATEGORIES");

            migrationBuilder.DropColumn(
                name: "IMAGE_URL",
                table: "CATEGORIES");

            migrationBuilder.DropColumn(
                name: "JAPANESE_NAME",
                table: "CATEGORIES");
        }
    }
}
