using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddM1ShiftsDrawerLastLoginAndReviewReply : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "LAST_LOGIN_AT",
                table: "USERS",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SHIFT_ID",
                table: "PAYMENT_TRANSACTIONS",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "MANAGER_REPLY",
                table: "MENU_ITEM_REVIEWS",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "REPLIED_AT",
                table: "MENU_ITEM_REVIEWS",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "REPLIED_BY_USER_ID",
                table: "MENU_ITEM_REVIEWS",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CASHIER_SHIFTS",
                columns: table => new
                {
                    SHIFT_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SHIFT_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OPENED_BY_USER_ID = table.Column<int>(type: "int", nullable: false),
                    OPENED_AT = table.Column<DateTime>(type: "datetime2", nullable: false),
                    OPENING_CASH = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    CLOSED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    CLOSED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CLOSING_ACTUAL_CASH = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    EXPECTED_CASH = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    VARIANCE_AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: true),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    NOTES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ROW_VERSION = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CASHIER_SHIFTS", x => x.SHIFT_ID);
                    table.CheckConstraint("CK_SHIFT_CLOSING_CASH", "[CLOSING_ACTUAL_CASH] IS NULL OR [CLOSING_ACTUAL_CASH] >= 0");
                    table.CheckConstraint("CK_SHIFT_OPENING_CASH", "[OPENING_CASH] >= 0");
                    table.ForeignKey(
                        name: "FK_CASHIER_SHIFTS_USERS_CLOSED_BY_USER_ID",
                        column: x => x.CLOSED_BY_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CASHIER_SHIFTS_USERS_OPENED_BY_USER_ID",
                        column: x => x.OPENED_BY_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CASH_DRAWER_WITHDRAWALS",
                columns: table => new
                {
                    WITHDRAWAL_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SHIFT_ID = table.Column<int>(type: "int", nullable: false),
                    WITHDRAWN_BY_USER_ID = table.Column<int>(type: "int", nullable: false),
                    AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    PHOTO_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NOTE = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    WITHDRAWN_AT = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CASH_DRAWER_WITHDRAWALS", x => x.WITHDRAWAL_ID);
                    table.CheckConstraint("CK_WITHDRAWAL_AMOUNT", "[AMOUNT] > 0");
                    table.ForeignKey(
                        name: "FK_CASH_DRAWER_WITHDRAWALS_CASHIER_SHIFTS_SHIFT_ID",
                        column: x => x.SHIFT_ID,
                        principalTable: "CASHIER_SHIFTS",
                        principalColumn: "SHIFT_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CASH_DRAWER_WITHDRAWALS_USERS_WITHDRAWN_BY_USER_ID",
                        column: x => x.WITHDRAWN_BY_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PAYMENT_TRANSACTIONS_SHIFT_ID",
                table: "PAYMENT_TRANSACTIONS",
                column: "SHIFT_ID");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEM_REVIEWS_REPLIED_BY_USER_ID",
                table: "MENU_ITEM_REVIEWS",
                column: "REPLIED_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CASH_DRAWER_WITHDRAWALS_SHIFT_ID",
                table: "CASH_DRAWER_WITHDRAWALS",
                column: "SHIFT_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CASH_DRAWER_WITHDRAWALS_WITHDRAWN_AT",
                table: "CASH_DRAWER_WITHDRAWALS",
                column: "WITHDRAWN_AT");

            migrationBuilder.CreateIndex(
                name: "IX_CASH_DRAWER_WITHDRAWALS_WITHDRAWN_BY_USER_ID",
                table: "CASH_DRAWER_WITHDRAWALS",
                column: "WITHDRAWN_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CASHIER_SHIFTS_CLOSED_BY_USER_ID",
                table: "CASHIER_SHIFTS",
                column: "CLOSED_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CASHIER_SHIFTS_OPENED_AT",
                table: "CASHIER_SHIFTS",
                column: "OPENED_AT");

            migrationBuilder.CreateIndex(
                name: "IX_CASHIER_SHIFTS_OPENED_BY_USER_ID",
                table: "CASHIER_SHIFTS",
                column: "OPENED_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CASHIER_SHIFTS_SHIFT_CODE",
                table: "CASHIER_SHIFTS",
                column: "SHIFT_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CASHIER_SHIFTS_STATUS",
                table: "CASHIER_SHIFTS",
                column: "STATUS",
                unique: true,
                filter: "[STATUS] = 'Open'");

            migrationBuilder.AddForeignKey(
                name: "FK_MENU_ITEM_REVIEWS_USERS_REPLIED_BY_USER_ID",
                table: "MENU_ITEM_REVIEWS",
                column: "REPLIED_BY_USER_ID",
                principalTable: "USERS",
                principalColumn: "USER_ID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_PAYMENT_TRANSACTIONS_CASHIER_SHIFTS_SHIFT_ID",
                table: "PAYMENT_TRANSACTIONS",
                column: "SHIFT_ID",
                principalTable: "CASHIER_SHIFTS",
                principalColumn: "SHIFT_ID",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MENU_ITEM_REVIEWS_USERS_REPLIED_BY_USER_ID",
                table: "MENU_ITEM_REVIEWS");

            migrationBuilder.DropForeignKey(
                name: "FK_PAYMENT_TRANSACTIONS_CASHIER_SHIFTS_SHIFT_ID",
                table: "PAYMENT_TRANSACTIONS");

            migrationBuilder.DropTable(
                name: "CASH_DRAWER_WITHDRAWALS");

            migrationBuilder.DropTable(
                name: "CASHIER_SHIFTS");

            migrationBuilder.DropIndex(
                name: "IX_PAYMENT_TRANSACTIONS_SHIFT_ID",
                table: "PAYMENT_TRANSACTIONS");

            migrationBuilder.DropIndex(
                name: "IX_MENU_ITEM_REVIEWS_REPLIED_BY_USER_ID",
                table: "MENU_ITEM_REVIEWS");

            migrationBuilder.DropColumn(
                name: "LAST_LOGIN_AT",
                table: "USERS");

            migrationBuilder.DropColumn(
                name: "SHIFT_ID",
                table: "PAYMENT_TRANSACTIONS");

            migrationBuilder.DropColumn(
                name: "MANAGER_REPLY",
                table: "MENU_ITEM_REVIEWS");

            migrationBuilder.DropColumn(
                name: "REPLIED_AT",
                table: "MENU_ITEM_REVIEWS");

            migrationBuilder.DropColumn(
                name: "REPLIED_BY_USER_ID",
                table: "MENU_ITEM_REVIEWS");
        }
    }
}
