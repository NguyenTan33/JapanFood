using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddBranchWifiConfigAndPosWorkflowEnhancements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "AMOUNT_GIVEN",
                table: "PAYMENT_TRANSACTIONS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CHANGE_AMOUNT",
                table: "PAYMENT_TRANSACTIONS",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BRANCH_WIFI_CONFIGS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    BRANCH_ID = table.Column<int>(type: "int", nullable: false),
                    SSID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    BSSID = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PUBLIC_IP_SUBNET = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BRANCH_WIFI_CONFIGS", x => x.ID);
                    table.ForeignKey(
                        name: "FK_BRANCH_WIFI_CONFIGS_BRANCHES_BRANCH_ID",
                        column: x => x.BRANCH_ID,
                        principalTable: "BRANCHES",
                        principalColumn: "BRANCH_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BRANCH_WIFI_CONFIGS_BRANCH_ID_SSID",
                table: "BRANCH_WIFI_CONFIGS",
                columns: new[] { "BRANCH_ID", "SSID" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BRANCH_WIFI_CONFIGS");

            migrationBuilder.DropColumn(
                name: "AMOUNT_GIVEN",
                table: "PAYMENT_TRANSACTIONS");

            migrationBuilder.DropColumn(
                name: "CHANGE_AMOUNT",
                table: "PAYMENT_TRANSACTIONS");
        }
    }
}
