using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Add_Voucher_Payment_Cart_Review_SecurityHardening : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "ROW_VERSION",
                table: "TABLES",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "DEPOSIT_AMOUNT",
                table: "RESERVATIONS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<DateTime>(
                name: "DEPOSIT_PAID_AT",
                table: "RESERVATIONS",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DEPOSIT_STATUS",
                table: "RESERVATIONS",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "None");

            migrationBuilder.AddColumn<string>(
                name: "DEPOSIT_TRANSACTION_CODE",
                table: "RESERVATIONS",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "ROW_VERSION",
                table: "RESERVATIONS",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "ROW_VERSION",
                table: "ORDERS",
                type: "rowversion",
                rowVersion: true,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VOUCHER_ID",
                table: "ORDERS",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CART_ITEMS",
                columns: table => new
                {
                    CART_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    USER_ID = table.Column<int>(type: "int", nullable: false),
                    MENU_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    QUANTITY = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    SPECIAL_INSTRUCTIONS = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CART_ITEMS", x => x.CART_ITEM_ID);
                    table.CheckConstraint("CK_CART_ITEMS_QUANTITY", "[QUANTITY] > 0");
                    table.ForeignKey(
                        name: "FK_CART_ITEMS_MENU_ITEMS_MENU_ITEM_ID",
                        column: x => x.MENU_ITEM_ID,
                        principalTable: "MENU_ITEMS",
                        principalColumn: "MENU_ITEM_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CART_ITEMS_USERS_USER_ID",
                        column: x => x.USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MENU_ITEM_REVIEWS",
                columns: table => new
                {
                    REVIEW_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    USER_ID = table.Column<int>(type: "int", nullable: false),
                    MENU_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    ORDER_ID = table.Column<int>(type: "int", nullable: false),
                    RATING = table.Column<int>(type: "int", nullable: false),
                    COMMENT = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    IS_APPROVED = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    APPROVED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    APPROVED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    REJECTION_REASON = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MENU_ITEM_REVIEWS", x => x.REVIEW_ID);
                    table.CheckConstraint("CK_REVIEW_RATING", "[RATING] >= 1 AND [RATING] <= 5");
                    table.ForeignKey(
                        name: "FK_MENU_ITEM_REVIEWS_MENU_ITEMS_MENU_ITEM_ID",
                        column: x => x.MENU_ITEM_ID,
                        principalTable: "MENU_ITEMS",
                        principalColumn: "MENU_ITEM_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MENU_ITEM_REVIEWS_ORDERS_ORDER_ID",
                        column: x => x.ORDER_ID,
                        principalTable: "ORDERS",
                        principalColumn: "ORDER_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MENU_ITEM_REVIEWS_USERS_APPROVED_BY_USER_ID",
                        column: x => x.APPROVED_BY_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MENU_ITEM_REVIEWS_USERS_USER_ID",
                        column: x => x.USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PAYMENT_TRANSACTIONS",
                columns: table => new
                {
                    TRANSACTION_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ORDER_ID = table.Column<int>(type: "int", nullable: false),
                    TRANSACTION_NUMBER = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GATEWAY = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    GATEWAY_TRANSACTION_ID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    GATEWAY_RESPONSE_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    IP_ADDRESS = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    RAW_PAYLOAD = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    FAILURE_REASON = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    REFUND_REFERENCE = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PAID_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PAYMENT_TRANSACTIONS", x => x.TRANSACTION_ID);
                    table.CheckConstraint("CK_PAYMENT_TXN_AMOUNT", "[AMOUNT] > 0");
                    table.ForeignKey(
                        name: "FK_PAYMENT_TRANSACTIONS_ORDERS_ORDER_ID",
                        column: x => x.ORDER_ID,
                        principalTable: "ORDERS",
                        principalColumn: "ORDER_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "VOUCHERS",
                columns: table => new
                {
                    VOUCHER_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VOUCHER_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    DISCOUNT_TYPE = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    DISCOUNT_VALUE = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MIN_ORDER_AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    MAX_DISCOUNT_AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    USAGE_LIMIT = table.Column<int>(type: "int", nullable: false, defaultValue: 100),
                    USED_COUNT = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    USAGE_PER_USER_LIMIT = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    START_DATE = table.Column<DateTime>(type: "datetime2", nullable: false),
                    END_DATE = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    ROW_VERSION = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VOUCHERS", x => x.VOUCHER_ID);
                    table.CheckConstraint("CK_VOUCHERS_DISCOUNT_VALUE", "[DISCOUNT_VALUE] > 0");
                    table.CheckConstraint("CK_VOUCHERS_MIN_ORDER_AMOUNT", "[MIN_ORDER_AMOUNT] >= 0");
                    table.CheckConstraint("CK_VOUCHERS_USAGE_LIMIT", "[USAGE_LIMIT] > 0");
                    table.CheckConstraint("CK_VOUCHERS_USED_COUNT", "[USED_COUNT] >= 0");
                });

            migrationBuilder.CreateTable(
                name: "CART_ITEM_MODIFIERS",
                columns: table => new
                {
                    CART_ITEM_MODIFIER_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CART_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    MODIFIER_OPTION_ID = table.Column<int>(type: "int", nullable: false),
                    QUANTITY = table.Column<int>(type: "int", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CART_ITEM_MODIFIERS", x => x.CART_ITEM_MODIFIER_ID);
                    table.CheckConstraint("CK_CIM_QUANTITY", "[QUANTITY] > 0");
                    table.ForeignKey(
                        name: "FK_CART_ITEM_MODIFIERS_CART_ITEMS_CART_ITEM_ID",
                        column: x => x.CART_ITEM_ID,
                        principalTable: "CART_ITEMS",
                        principalColumn: "CART_ITEM_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CART_ITEM_MODIFIERS_MODIFIER_OPTIONS_MODIFIER_OPTION_ID",
                        column: x => x.MODIFIER_OPTION_ID,
                        principalTable: "MODIFIER_OPTIONS",
                        principalColumn: "MODIFIER_OPTION_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "USER_VOUCHER_USAGES",
                columns: table => new
                {
                    USAGE_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VOUCHER_ID = table.Column<int>(type: "int", nullable: false),
                    USER_ID = table.Column<int>(type: "int", nullable: false),
                    ORDER_ID = table.Column<int>(type: "int", nullable: false),
                    DISCOUNT_APPLIED = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    USED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_VOUCHER_USAGES", x => x.USAGE_ID);
                    table.CheckConstraint("CK_UVU_DISCOUNT_APPLIED", "[DISCOUNT_APPLIED] > 0");
                    table.ForeignKey(
                        name: "FK_USER_VOUCHER_USAGES_ORDERS_ORDER_ID",
                        column: x => x.ORDER_ID,
                        principalTable: "ORDERS",
                        principalColumn: "ORDER_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_USER_VOUCHER_USAGES_USERS_USER_ID",
                        column: x => x.USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_USER_VOUCHER_USAGES_VOUCHERS_VOUCHER_ID",
                        column: x => x.VOUCHER_ID,
                        principalTable: "VOUCHERS",
                        principalColumn: "VOUCHER_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_TABLES_CAPACITY",
                table: "TABLES",
                sql: "[CAPACITY] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_TABLES_MIN_CAPACITY",
                table: "TABLES",
                sql: "[MIN_CAPACITY] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_RESERVATIONS_DEPOSIT_AMOUNT",
                table: "RESERVATIONS",
                sql: "[DEPOSIT_AMOUNT] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_RESERVATIONS_GUEST_COUNT",
                table: "RESERVATIONS",
                sql: "[GUEST_COUNT] > 0");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_VOUCHER_ID",
                table: "ORDERS",
                column: "VOUCHER_ID");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDERS_DISCOUNT_AMOUNT",
                table: "ORDERS",
                sql: "[DISCOUNT_AMOUNT] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDERS_GUEST_COUNT",
                table: "ORDERS",
                sql: "[GUEST_COUNT] > 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDERS_SUB_TOTAL",
                table: "ORDERS",
                sql: "[SUB_TOTAL] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDERS_TAX_AMOUNT",
                table: "ORDERS",
                sql: "[TAX_AMOUNT] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDERS_TOTAL_AMOUNT",
                table: "ORDERS",
                sql: "[TOTAL_AMOUNT] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDER_ITEMS_MODIFIERS_PRICE",
                table: "ORDER_ITEMS",
                sql: "[MODIFIERS_PRICE] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDER_ITEMS_QUANTITY",
                table: "ORDER_ITEMS",
                sql: "[QUANTITY] > 0");



            migrationBuilder.AddCheckConstraint(
                name: "CK_ORDER_ITEMS_UNIT_PRICE",
                table: "ORDER_ITEMS",
                sql: "[UNIT_PRICE] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_MODIFIER_OPTIONS_PRICE_ADJ",
                table: "MODIFIER_OPTIONS",
                sql: "[PRICE_ADJUSTMENT] >= 0");

            migrationBuilder.AddCheckConstraint(
                name: "CK_MENU_ITEMS_BASE_PRICE",
                table: "MENU_ITEMS",
                sql: "[BASE_PRICE] >= 0");

            migrationBuilder.CreateIndex(
                name: "IX_CART_ITEM_MODIFIERS_CART_ITEM_ID",
                table: "CART_ITEM_MODIFIERS",
                column: "CART_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CART_ITEM_MODIFIERS_MODIFIER_OPTION_ID",
                table: "CART_ITEM_MODIFIERS",
                column: "MODIFIER_OPTION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CART_ITEMS_MENU_ITEM_ID",
                table: "CART_ITEMS",
                column: "MENU_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CART_ITEMS_USER_ID_MENU_ITEM_ID",
                table: "CART_ITEMS",
                columns: new[] { "USER_ID", "MENU_ITEM_ID" });

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEM_REVIEWS_APPROVED_BY_USER_ID",
                table: "MENU_ITEM_REVIEWS",
                column: "APPROVED_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEM_REVIEWS_MENU_ITEM_ID",
                table: "MENU_ITEM_REVIEWS",
                column: "MENU_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEM_REVIEWS_ORDER_ID",
                table: "MENU_ITEM_REVIEWS",
                column: "ORDER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEM_REVIEWS_USER_ID_MENU_ITEM_ID_ORDER_ID",
                table: "MENU_ITEM_REVIEWS",
                columns: new[] { "USER_ID", "MENU_ITEM_ID", "ORDER_ID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PAYMENT_TRANSACTIONS_GATEWAY_TRANSACTION_ID",
                table: "PAYMENT_TRANSACTIONS",
                column: "GATEWAY_TRANSACTION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_PAYMENT_TRANSACTIONS_ORDER_ID",
                table: "PAYMENT_TRANSACTIONS",
                column: "ORDER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_PAYMENT_TRANSACTIONS_TRANSACTION_NUMBER",
                table: "PAYMENT_TRANSACTIONS",
                column: "TRANSACTION_NUMBER",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_VOUCHER_USAGES_ORDER_ID",
                table: "USER_VOUCHER_USAGES",
                column: "ORDER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_USER_VOUCHER_USAGES_USER_ID_VOUCHER_ID_ORDER_ID",
                table: "USER_VOUCHER_USAGES",
                columns: new[] { "USER_ID", "VOUCHER_ID", "ORDER_ID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_VOUCHER_USAGES_VOUCHER_ID",
                table: "USER_VOUCHER_USAGES",
                column: "VOUCHER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_VOUCHERS_VOUCHER_CODE",
                table: "VOUCHERS",
                column: "VOUCHER_CODE",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ORDERS_VOUCHERS_VOUCHER_ID",
                table: "ORDERS",
                column: "VOUCHER_ID",
                principalTable: "VOUCHERS",
                principalColumn: "VOUCHER_ID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ORDERS_VOUCHERS_VOUCHER_ID",
                table: "ORDERS");

            migrationBuilder.DropTable(
                name: "CART_ITEM_MODIFIERS");

            migrationBuilder.DropTable(
                name: "MENU_ITEM_REVIEWS");

            migrationBuilder.DropTable(
                name: "PAYMENT_TRANSACTIONS");

            migrationBuilder.DropTable(
                name: "USER_VOUCHER_USAGES");

            migrationBuilder.DropTable(
                name: "CART_ITEMS");

            migrationBuilder.DropTable(
                name: "VOUCHERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TABLES_CAPACITY",
                table: "TABLES");

            migrationBuilder.DropCheckConstraint(
                name: "CK_TABLES_MIN_CAPACITY",
                table: "TABLES");

            migrationBuilder.DropCheckConstraint(
                name: "CK_RESERVATIONS_DEPOSIT_AMOUNT",
                table: "RESERVATIONS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_RESERVATIONS_GUEST_COUNT",
                table: "RESERVATIONS");

            migrationBuilder.DropIndex(
                name: "IX_ORDERS_VOUCHER_ID",
                table: "ORDERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDERS_DISCOUNT_AMOUNT",
                table: "ORDERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDERS_GUEST_COUNT",
                table: "ORDERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDERS_SUB_TOTAL",
                table: "ORDERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDERS_TAX_AMOUNT",
                table: "ORDERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDERS_TOTAL_AMOUNT",
                table: "ORDERS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDER_ITEMS_MODIFIERS_PRICE",
                table: "ORDER_ITEMS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDER_ITEMS_QUANTITY",
                table: "ORDER_ITEMS");



            migrationBuilder.DropCheckConstraint(
                name: "CK_ORDER_ITEMS_UNIT_PRICE",
                table: "ORDER_ITEMS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_MODIFIER_OPTIONS_PRICE_ADJ",
                table: "MODIFIER_OPTIONS");

            migrationBuilder.DropCheckConstraint(
                name: "CK_MENU_ITEMS_BASE_PRICE",
                table: "MENU_ITEMS");

            migrationBuilder.DropColumn(
                name: "ROW_VERSION",
                table: "TABLES");

            migrationBuilder.DropColumn(
                name: "DEPOSIT_AMOUNT",
                table: "RESERVATIONS");

            migrationBuilder.DropColumn(
                name: "DEPOSIT_PAID_AT",
                table: "RESERVATIONS");

            migrationBuilder.DropColumn(
                name: "DEPOSIT_STATUS",
                table: "RESERVATIONS");

            migrationBuilder.DropColumn(
                name: "DEPOSIT_TRANSACTION_CODE",
                table: "RESERVATIONS");

            migrationBuilder.DropColumn(
                name: "ROW_VERSION",
                table: "RESERVATIONS");

            migrationBuilder.DropColumn(
                name: "ROW_VERSION",
                table: "ORDERS");

            migrationBuilder.DropColumn(
                name: "VOUCHER_ID",
                table: "ORDERS");
        }
    }
}
