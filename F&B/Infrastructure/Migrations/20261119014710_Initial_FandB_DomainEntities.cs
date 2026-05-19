using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial_FandB_DomainEntities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CATEGORIES",
                columns: table => new
                {
                    CATEGORY_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CATEGORY_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CATEGORY_NAME = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CATEGORIES", x => x.CATEGORY_ID);
                });

            migrationBuilder.CreateTable(
                name: "KITCHEN_STATIONS",
                columns: table => new
                {
                    STATION_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NAME = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    STATION_TYPE = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KITCHEN_STATIONS", x => x.STATION_ID);
                });

            migrationBuilder.CreateTable(
                name: "KITCHEN_TICKETS",
                columns: table => new
                {
                    TICKET_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ORDER_ID = table.Column<int>(type: "int", nullable: false),
                    TICKET_NUMBER = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TABLE_NAME = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    IS_RUSH = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    NOTES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    READY_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SERVED_AT = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KITCHEN_TICKETS", x => x.TICKET_ID);
                });

            migrationBuilder.CreateTable(
                name: "MODIFIER_GROUPS",
                columns: table => new
                {
                    MODIFIER_GROUP_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    GROUP_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    GROUP_NAME = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MIN_SELECTION = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    MAX_SELECTION = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MODIFIER_GROUPS", x => x.MODIFIER_GROUP_ID);
                });

            migrationBuilder.CreateTable(
                name: "OTP_VERIFICATIONS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PHONE_NUMBER = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    OTP_HASH = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PURPOSE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EXPIRES_AT = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FAILED_ATTEMPTS = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    IS_USED = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OTP_VERIFICATIONS", x => x.ID);
                });

            migrationBuilder.CreateTable(
                name: "SHIFT_CHECKLISTS",
                columns: table => new
                {
                    CHECKLIST_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CHECKLIST_TYPE = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TITLE = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SHIFT_CHECKLISTS", x => x.CHECKLIST_ID);
                });

            migrationBuilder.CreateTable(
                name: "SUPPLIERS",
                columns: table => new
                {
                    SUPPLIER_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SUPPLIER_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NAME = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    CONTACT_PERSON = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PHONE_NUMBER = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EMAIL = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ADDRESS = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    TAX_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    PAYMENT_TERMS = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SUPPLIERS", x => x.SUPPLIER_ID);
                });

            migrationBuilder.CreateTable(
                name: "TABLE_AREAS",
                columns: table => new
                {
                    AREA_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AREA_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AREA_NAME = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TABLE_AREAS", x => x.AREA_ID);
                });

            migrationBuilder.CreateTable(
                name: "UNITS_OF_MEASURE",
                columns: table => new
                {
                    UOM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CODE = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    NAME = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    BASE_UOM_ID = table.Column<int>(type: "int", nullable: true),
                    CONVERSION_FACTOR = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false, defaultValue: 1.0000m),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UNITS_OF_MEASURE", x => x.UOM_ID);
                    table.ForeignKey(
                        name: "FK_UNITS_OF_MEASURE_UNITS_OF_MEASURE_BASE_UOM_ID",
                        column: x => x.BASE_UOM_ID,
                        principalTable: "UNITS_OF_MEASURE",
                        principalColumn: "UOM_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "USERS",
                columns: table => new
                {
                    USER_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FULL_NAME = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    EMAIL = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PHONE_NUMBER = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    PASSWORD_HASH = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    LOYALTY_POINTS = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    MEMBERSHIP_TIER = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "BRONZE"),
                    ACCOUNT_STATUS = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "ACTIVE"),
                    ROLE = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false, defaultValue: "CUSTOMER"),
                    AVATAR_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USERS", x => x.USER_ID);
                });

            migrationBuilder.CreateTable(
                name: "MENU_ITEMS",
                columns: table => new
                {
                    MENU_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CATEGORY_ID = table.Column<int>(type: "int", nullable: false),
                    CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    JAPANESE_NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    BASE_PRICE = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    IMAGE_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IS_AVAILABLE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    IS_KITCHEN_ITEM = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    KITCHEN_STATION = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ESTIMATED_PREP_MINUTES = table.Column<int>(type: "int", nullable: false, defaultValue: 10),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MENU_ITEMS", x => x.MENU_ITEM_ID);
                    table.ForeignKey(
                        name: "FK_MENU_ITEMS_CATEGORIES_CATEGORY_ID",
                        column: x => x.CATEGORY_ID,
                        principalTable: "CATEGORIES",
                        principalColumn: "CATEGORY_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "MODIFIER_OPTIONS",
                columns: table => new
                {
                    MODIFIER_OPTION_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MODIFIER_GROUP_ID = table.Column<int>(type: "int", nullable: false),
                    OPTION_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    OPTION_NAME = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PRICE_ADJUSTMENT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    IS_DEFAULT = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    IS_AVAILABLE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MODIFIER_OPTIONS", x => x.MODIFIER_OPTION_ID);
                    table.ForeignKey(
                        name: "FK_MODIFIER_OPTIONS_MODIFIER_GROUPS_MODIFIER_GROUP_ID",
                        column: x => x.MODIFIER_GROUP_ID,
                        principalTable: "MODIFIER_GROUPS",
                        principalColumn: "MODIFIER_GROUP_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CHECKLIST_ITEMS",
                columns: table => new
                {
                    CHECKLIST_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CHECKLIST_ID = table.Column<int>(type: "int", nullable: false),
                    SECTION = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DESCRIPTION = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    IS_MANDATORY = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0),
                    EXPECTED_STANDARD = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CHECKLIST_ITEMS", x => x.CHECKLIST_ITEM_ID);
                    table.ForeignKey(
                        name: "FK_CHECKLIST_ITEMS_SHIFT_CHECKLISTS_CHECKLIST_ID",
                        column: x => x.CHECKLIST_ID,
                        principalTable: "SHIFT_CHECKLISTS",
                        principalColumn: "CHECKLIST_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "INVENTORY_ITEMS",
                columns: table => new
                {
                    INVENTORY_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SKU = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    CATEGORY = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PRIMARY_UOM_ID = table.Column<int>(type: "int", nullable: false),
                    CURRENT_STOCK = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false, defaultValue: 0m),
                    MINIMUM_STOCK = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false, defaultValue: 0m),
                    UNIT_COST = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    STORAGE_LOCATION = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_INVENTORY_ITEMS", x => x.INVENTORY_ITEM_ID);
                    table.ForeignKey(
                        name: "FK_INVENTORY_ITEMS_UNITS_OF_MEASURE_PRIMARY_UOM_ID",
                        column: x => x.PRIMARY_UOM_ID,
                        principalTable: "UNITS_OF_MEASURE",
                        principalColumn: "UOM_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CHECKLIST_EXECUTIONS",
                columns: table => new
                {
                    EXECUTION_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    CHECKLIST_ID = table.Column<int>(type: "int", nullable: false),
                    SHIFT_DATE = table.Column<DateTime>(type: "date", nullable: false),
                    SHIFT_NAME = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    PERFORMER_USER_ID = table.Column<int>(type: "int", nullable: false),
                    PERFORMER_SIGNATURE = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PERFORMED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    MANAGER_USER_ID = table.Column<int>(type: "int", nullable: true),
                    MANAGER_SIGNATURE = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    APPROVED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    MANAGER_NOTES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CHECKLIST_EXECUTIONS", x => x.EXECUTION_ID);
                    table.ForeignKey(
                        name: "FK_CHECKLIST_EXECUTIONS_SHIFT_CHECKLISTS_CHECKLIST_ID",
                        column: x => x.CHECKLIST_ID,
                        principalTable: "SHIFT_CHECKLISTS",
                        principalColumn: "CHECKLIST_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CHECKLIST_EXECUTIONS_USERS_MANAGER_USER_ID",
                        column: x => x.MANAGER_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CHECKLIST_EXECUTIONS_USERS_PERFORMER_USER_ID",
                        column: x => x.PERFORMER_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "INVENTORY_AUDITS",
                columns: table => new
                {
                    AUDIT_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AUDIT_NUMBER = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AUDIT_DATE = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    AUDITOR_USER_ID = table.Column<int>(type: "int", nullable: false),
                    APPROVED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    APPROVED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    NOTES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_INVENTORY_AUDITS", x => x.AUDIT_ID);
                    table.ForeignKey(
                        name: "FK_INVENTORY_AUDITS_USERS_APPROVED_BY_USER_ID",
                        column: x => x.APPROVED_BY_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_INVENTORY_AUDITS_USERS_AUDITOR_USER_ID",
                        column: x => x.AUDITOR_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "KITCHEN_TICKET_ITEMS",
                columns: table => new
                {
                    TICKET_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    TICKET_ID = table.Column<int>(type: "int", nullable: false),
                    ORDER_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    STATION_ID = table.Column<int>(type: "int", nullable: false),
                    MENU_ITEM_NAME = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    QUANTITY = table.Column<int>(type: "int", nullable: false),
                    MODIFIERS_SUMMARY = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    COOKING_START_TIME = table.Column<DateTime>(type: "datetime2", nullable: true),
                    READY_TIME = table.Column<DateTime>(type: "datetime2", nullable: true),
                    SERVED_TIME = table.Column<DateTime>(type: "datetime2", nullable: true),
                    COOK_USER_ID = table.Column<int>(type: "int", nullable: true),
                    CANCELLATION_REASON = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KITCHEN_TICKET_ITEMS", x => x.TICKET_ITEM_ID);
                    table.ForeignKey(
                        name: "FK_KITCHEN_TICKET_ITEMS_KITCHEN_STATIONS_STATION_ID",
                        column: x => x.STATION_ID,
                        principalTable: "KITCHEN_STATIONS",
                        principalColumn: "STATION_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_KITCHEN_TICKET_ITEMS_KITCHEN_TICKETS_TICKET_ID",
                        column: x => x.TICKET_ID,
                        principalTable: "KITCHEN_TICKETS",
                        principalColumn: "TICKET_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KITCHEN_TICKET_ITEMS_USERS_COOK_USER_ID",
                        column: x => x.COOK_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PURCHASE_ORDERS",
                columns: table => new
                {
                    PO_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PO_NUMBER = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    SUPPLIER_ID = table.Column<int>(type: "int", nullable: false),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ORDER_DATE = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    EXPECTED_DELIVERY_DATE = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RECEIVED_DATE = table.Column<DateTime>(type: "datetime2", nullable: true),
                    APPROVED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    TOTAL_AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    NOTES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PURCHASE_ORDERS", x => x.PO_ID);
                    table.ForeignKey(
                        name: "FK_PURCHASE_ORDERS_SUPPLIERS_SUPPLIER_ID",
                        column: x => x.SUPPLIER_ID,
                        principalTable: "SUPPLIERS",
                        principalColumn: "SUPPLIER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PURCHASE_ORDERS_USERS_APPROVED_BY_USER_ID",
                        column: x => x.APPROVED_BY_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PURCHASE_ORDERS_USERS_CREATED_BY_USER_ID",
                        column: x => x.CREATED_BY_USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "REFRESH_TOKENS",
                columns: table => new
                {
                    ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ACCOUNT_ID = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    TOKEN_HASH = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    EXPIRES_AT = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IS_REVOKED = table.Column<bool>(type: "bit", nullable: false, defaultValue: false),
                    REVOKED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UserId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_REFRESH_TOKENS", x => x.ID);
                    table.ForeignKey(
                        name: "FK_REFRESH_TOKENS_USERS_UserId",
                        column: x => x.UserId,
                        principalTable: "USERS",
                        principalColumn: "USER_ID");
                });

            migrationBuilder.CreateTable(
                name: "USER_ADDRESSES",
                columns: table => new
                {
                    ADDRESS_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    USER_ID = table.Column<int>(type: "int", nullable: false),
                    RECIPIENT_NAME = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PHONE_NUMBER = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    STREET_ADDRESS = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    WARD = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    DISTRICT = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    CITY = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IS_DEFAULT = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: false, defaultValue: "N")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_USER_ADDRESSES", x => x.ADDRESS_ID);
                    table.ForeignKey(
                        name: "FK_USER_ADDRESSES_USERS_USER_ID",
                        column: x => x.USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MENU_ITEM_MODIFIER_GROUPS",
                columns: table => new
                {
                    MENU_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    MODIFIER_GROUP_ID = table.Column<int>(type: "int", nullable: false),
                    DISPLAY_ORDER = table.Column<int>(type: "int", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MENU_ITEM_MODIFIER_GROUPS", x => new { x.MENU_ITEM_ID, x.MODIFIER_GROUP_ID });
                    table.ForeignKey(
                        name: "FK_MENU_ITEM_MODIFIER_GROUPS_MENU_ITEMS_MENU_ITEM_ID",
                        column: x => x.MENU_ITEM_ID,
                        principalTable: "MENU_ITEMS",
                        principalColumn: "MENU_ITEM_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_MENU_ITEM_MODIFIER_GROUPS_MODIFIER_GROUPS_MODIFIER_GROUP_ID",
                        column: x => x.MODIFIER_GROUP_ID,
                        principalTable: "MODIFIER_GROUPS",
                        principalColumn: "MODIFIER_GROUP_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RECIPE_BOM",
                columns: table => new
                {
                    BOM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    MENU_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    INVENTORY_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    QUANTITY_REQUIRED = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    UOM_ID = table.Column<int>(type: "int", nullable: false),
                    WASTAGE_PERCENTAGE = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false, defaultValue: 0m),
                    PREPARATION_NOTES = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RECIPE_BOM", x => x.BOM_ID);
                    table.ForeignKey(
                        name: "FK_RECIPE_BOM_INVENTORY_ITEMS_INVENTORY_ITEM_ID",
                        column: x => x.INVENTORY_ITEM_ID,
                        principalTable: "INVENTORY_ITEMS",
                        principalColumn: "INVENTORY_ITEM_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RECIPE_BOM_MENU_ITEMS_MENU_ITEM_ID",
                        column: x => x.MENU_ITEM_ID,
                        principalTable: "MENU_ITEMS",
                        principalColumn: "MENU_ITEM_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RECIPE_BOM_UNITS_OF_MEASURE_UOM_ID",
                        column: x => x.UOM_ID,
                        principalTable: "UNITS_OF_MEASURE",
                        principalColumn: "UOM_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "CHECKLIST_ITEM_RESULTS",
                columns: table => new
                {
                    RESULT_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    EXECUTION_ID = table.Column<int>(type: "int", nullable: false),
                    CHECKLIST_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    IS_PASSED = table.Column<bool>(type: "bit", nullable: false),
                    ACTUAL_VALUE = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    PHOTO_URL = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    REMARKS = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CHECKLIST_ITEM_RESULTS", x => x.RESULT_ID);
                    table.ForeignKey(
                        name: "FK_CHECKLIST_ITEM_RESULTS_CHECKLIST_EXECUTIONS_EXECUTION_ID",
                        column: x => x.EXECUTION_ID,
                        principalTable: "CHECKLIST_EXECUTIONS",
                        principalColumn: "EXECUTION_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_CHECKLIST_ITEM_RESULTS_CHECKLIST_ITEMS_CHECKLIST_ITEM_ID",
                        column: x => x.CHECKLIST_ITEM_ID,
                        principalTable: "CHECKLIST_ITEMS",
                        principalColumn: "CHECKLIST_ITEM_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "INVENTORY_AUDIT_ITEMS",
                columns: table => new
                {
                    AUDIT_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AUDIT_ID = table.Column<int>(type: "int", nullable: false),
                    INVENTORY_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    SYSTEM_EXPECTED_QUANTITY = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    ACTUAL_QUANTITY = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    DISCREPANCY_QUANTITY = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    REASON = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_INVENTORY_AUDIT_ITEMS", x => x.AUDIT_ITEM_ID);
                    table.ForeignKey(
                        name: "FK_INVENTORY_AUDIT_ITEMS_INVENTORY_AUDITS_AUDIT_ID",
                        column: x => x.AUDIT_ID,
                        principalTable: "INVENTORY_AUDITS",
                        principalColumn: "AUDIT_ID",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_INVENTORY_AUDIT_ITEMS_INVENTORY_ITEMS_INVENTORY_ITEM_ID",
                        column: x => x.INVENTORY_ITEM_ID,
                        principalTable: "INVENTORY_ITEMS",
                        principalColumn: "INVENTORY_ITEM_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PURCHASE_ORDER_ITEMS",
                columns: table => new
                {
                    PO_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    PO_ID = table.Column<int>(type: "int", nullable: false),
                    INVENTORY_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    QUANTITY_ORDERED = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false),
                    QUANTITY_RECEIVED = table.Column<decimal>(type: "decimal(18,4)", precision: 18, scale: 4, nullable: false, defaultValue: 0m),
                    UNIT_PRICE = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    LINE_TOTAL = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PURCHASE_ORDER_ITEMS", x => x.PO_ITEM_ID);
                    table.ForeignKey(
                        name: "FK_PURCHASE_ORDER_ITEMS_INVENTORY_ITEMS_INVENTORY_ITEM_ID",
                        column: x => x.INVENTORY_ITEM_ID,
                        principalTable: "INVENTORY_ITEMS",
                        principalColumn: "INVENTORY_ITEM_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PURCHASE_ORDER_ITEMS_PURCHASE_ORDERS_PO_ID",
                        column: x => x.PO_ID,
                        principalTable: "PURCHASE_ORDERS",
                        principalColumn: "PO_ID",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ORDER_ITEM_MODIFIERS",
                columns: table => new
                {
                    ORDER_ITEM_MODIFIER_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ORDER_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    MODIFIER_OPTION_ID = table.Column<int>(type: "int", nullable: false),
                    MODIFIER_OPTION_NAME = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PRICE_ADJUSTMENT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    QUANTITY = table.Column<int>(type: "int", nullable: false, defaultValue: 1)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ORDER_ITEM_MODIFIERS", x => x.ORDER_ITEM_MODIFIER_ID);
                    table.ForeignKey(
                        name: "FK_ORDER_ITEM_MODIFIERS_MODIFIER_OPTIONS_MODIFIER_OPTION_ID",
                        column: x => x.MODIFIER_OPTION_ID,
                        principalTable: "MODIFIER_OPTIONS",
                        principalColumn: "MODIFIER_OPTION_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ORDER_ITEMS",
                columns: table => new
                {
                    ORDER_ITEM_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ORDER_ID = table.Column<int>(type: "int", nullable: false),
                    MENU_ITEM_ID = table.Column<int>(type: "int", nullable: false),
                    UNIT_PRICE = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    MODIFIERS_PRICE = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    QUANTITY = table.Column<int>(type: "int", nullable: false),
                    ITEM_STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    KITCHEN_STATION = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SPECIAL_INSTRUCTIONS = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CANCELLATION_REASON = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    SERVED_AT = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ORDER_ITEMS", x => x.ORDER_ITEM_ID);
                    table.ForeignKey(
                        name: "FK_ORDER_ITEMS_MENU_ITEMS_MENU_ITEM_ID",
                        column: x => x.MENU_ITEM_ID,
                        principalTable: "MENU_ITEMS",
                        principalColumn: "MENU_ITEM_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ORDERS",
                columns: table => new
                {
                    ORDER_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ORDER_NUMBER = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    TABLE_ID = table.Column<int>(type: "int", nullable: true),
                    USER_ID = table.Column<int>(type: "int", nullable: true),
                    RESERVATION_ID = table.Column<int>(type: "int", nullable: true),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    ORDER_TYPE = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    GUEST_COUNT = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    SUB_TOTAL = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    TAX_AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    DISCOUNT_AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    TOTAL_AMOUNT = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false, defaultValue: 0m),
                    NOTES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    COMPLETED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ORDERS", x => x.ORDER_ID);
                    table.ForeignKey(
                        name: "FK_ORDERS_USERS_USER_ID",
                        column: x => x.USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "TABLES",
                columns: table => new
                {
                    TABLE_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AREA_ID = table.Column<int>(type: "int", nullable: false),
                    TABLE_NUMBER = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CAPACITY = table.Column<int>(type: "int", nullable: false),
                    MIN_CAPACITY = table.Column<int>(type: "int", nullable: false, defaultValue: 1),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CURRENT_ORDER_ID = table.Column<int>(type: "int", nullable: true),
                    MERGED_INTO_TABLE_ID = table.Column<int>(type: "int", nullable: true),
                    IS_ACTIVE = table.Column<bool>(type: "bit", nullable: false, defaultValue: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TABLES", x => x.TABLE_ID);
                    table.ForeignKey(
                        name: "FK_TABLES_ORDERS_CURRENT_ORDER_ID",
                        column: x => x.CURRENT_ORDER_ID,
                        principalTable: "ORDERS",
                        principalColumn: "ORDER_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TABLES_TABLES_MERGED_INTO_TABLE_ID",
                        column: x => x.MERGED_INTO_TABLE_ID,
                        principalTable: "TABLES",
                        principalColumn: "TABLE_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_TABLES_TABLE_AREAS_AREA_ID",
                        column: x => x.AREA_ID,
                        principalTable: "TABLE_AREAS",
                        principalColumn: "AREA_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RESERVATIONS",
                columns: table => new
                {
                    RESERVATION_ID = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RESERVATION_CODE = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    CUSTOMER_NAME = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    PHONE_NUMBER = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    EMAIL = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    GUEST_COUNT = table.Column<int>(type: "int", nullable: false),
                    RESERVATION_TIME = table.Column<DateTime>(type: "datetime2", nullable: false),
                    STATUS = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    SPECIAL_REQUESTS = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ALLERGIES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    PREFERRED_AREA_ID = table.Column<int>(type: "int", nullable: true),
                    ASSIGNED_TABLE_ID = table.Column<int>(type: "int", nullable: true),
                    USER_ID = table.Column<int>(type: "int", nullable: true),
                    CONFIRMED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CONFIRMED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    SEATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CANCELLED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CANCELLED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    CANCELLATION_REASON = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    NOTES = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CREATED_AT = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    CREATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true),
                    UPDATED_AT = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UPDATED_BY_USER_ID = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RESERVATIONS", x => x.RESERVATION_ID);
                    table.ForeignKey(
                        name: "FK_RESERVATIONS_TABLES_ASSIGNED_TABLE_ID",
                        column: x => x.ASSIGNED_TABLE_ID,
                        principalTable: "TABLES",
                        principalColumn: "TABLE_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RESERVATIONS_TABLE_AREAS_PREFERRED_AREA_ID",
                        column: x => x.PREFERRED_AREA_ID,
                        principalTable: "TABLE_AREAS",
                        principalColumn: "AREA_ID",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RESERVATIONS_USERS_USER_ID",
                        column: x => x.USER_ID,
                        principalTable: "USERS",
                        principalColumn: "USER_ID",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CATEGORIES_CATEGORY_CODE",
                table: "CATEGORIES",
                column: "CATEGORY_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CHECKLIST_EXECUTIONS_CHECKLIST_ID_SHIFT_DATE",
                table: "CHECKLIST_EXECUTIONS",
                columns: new[] { "CHECKLIST_ID", "SHIFT_DATE" });

            migrationBuilder.CreateIndex(
                name: "IX_CHECKLIST_EXECUTIONS_MANAGER_USER_ID",
                table: "CHECKLIST_EXECUTIONS",
                column: "MANAGER_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CHECKLIST_EXECUTIONS_PERFORMER_USER_ID",
                table: "CHECKLIST_EXECUTIONS",
                column: "PERFORMER_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CHECKLIST_EXECUTIONS_STATUS",
                table: "CHECKLIST_EXECUTIONS",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_CHECKLIST_ITEM_RESULTS_CHECKLIST_ITEM_ID",
                table: "CHECKLIST_ITEM_RESULTS",
                column: "CHECKLIST_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_CHECKLIST_ITEM_RESULTS_EXECUTION_ID_CHECKLIST_ITEM_ID",
                table: "CHECKLIST_ITEM_RESULTS",
                columns: new[] { "EXECUTION_ID", "CHECKLIST_ITEM_ID" });

            migrationBuilder.CreateIndex(
                name: "IX_CHECKLIST_ITEMS_CHECKLIST_ID_DISPLAY_ORDER",
                table: "CHECKLIST_ITEMS",
                columns: new[] { "CHECKLIST_ID", "DISPLAY_ORDER" });

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_AUDIT_ITEMS_AUDIT_ID",
                table: "INVENTORY_AUDIT_ITEMS",
                column: "AUDIT_ID");

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_AUDIT_ITEMS_INVENTORY_ITEM_ID",
                table: "INVENTORY_AUDIT_ITEMS",
                column: "INVENTORY_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_AUDITS_APPROVED_BY_USER_ID",
                table: "INVENTORY_AUDITS",
                column: "APPROVED_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_AUDITS_AUDIT_NUMBER",
                table: "INVENTORY_AUDITS",
                column: "AUDIT_NUMBER",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_AUDITS_AUDITOR_USER_ID",
                table: "INVENTORY_AUDITS",
                column: "AUDITOR_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_AUDITS_STATUS",
                table: "INVENTORY_AUDITS",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_ITEMS_CATEGORY",
                table: "INVENTORY_ITEMS",
                column: "CATEGORY");

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_ITEMS_PRIMARY_UOM_ID",
                table: "INVENTORY_ITEMS",
                column: "PRIMARY_UOM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_INVENTORY_ITEMS_SKU",
                table: "INVENTORY_ITEMS",
                column: "SKU",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_STATIONS_STATION_TYPE",
                table: "KITCHEN_STATIONS",
                column: "STATION_TYPE");

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_TICKET_ITEMS_COOK_USER_ID",
                table: "KITCHEN_TICKET_ITEMS",
                column: "COOK_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_TICKET_ITEMS_STATION_ID",
                table: "KITCHEN_TICKET_ITEMS",
                column: "STATION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_TICKET_ITEMS_STATUS",
                table: "KITCHEN_TICKET_ITEMS",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_TICKET_ITEMS_TICKET_ID",
                table: "KITCHEN_TICKET_ITEMS",
                column: "TICKET_ID");

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_TICKETS_ORDER_ID",
                table: "KITCHEN_TICKETS",
                column: "ORDER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_TICKETS_STATUS",
                table: "KITCHEN_TICKETS",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_KITCHEN_TICKETS_TICKET_NUMBER",
                table: "KITCHEN_TICKETS",
                column: "TICKET_NUMBER",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEM_MODIFIER_GROUPS_MODIFIER_GROUP_ID",
                table: "MENU_ITEM_MODIFIER_GROUPS",
                column: "MODIFIER_GROUP_ID");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEMS_CATEGORY_ID",
                table: "MENU_ITEMS",
                column: "CATEGORY_ID");

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEMS_CODE",
                table: "MENU_ITEMS",
                column: "CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MENU_ITEMS_KITCHEN_STATION",
                table: "MENU_ITEMS",
                column: "KITCHEN_STATION");

            migrationBuilder.CreateIndex(
                name: "IX_MODIFIER_GROUPS_GROUP_CODE",
                table: "MODIFIER_GROUPS",
                column: "GROUP_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MODIFIER_OPTIONS_MODIFIER_GROUP_ID_OPTION_CODE",
                table: "MODIFIER_OPTIONS",
                columns: new[] { "MODIFIER_GROUP_ID", "OPTION_CODE" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ORDER_ITEM_MODIFIERS_MODIFIER_OPTION_ID",
                table: "ORDER_ITEM_MODIFIERS",
                column: "MODIFIER_OPTION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_ORDER_ITEM_MODIFIERS_ORDER_ITEM_ID",
                table: "ORDER_ITEM_MODIFIERS",
                column: "ORDER_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_ORDER_ITEMS_ITEM_STATUS",
                table: "ORDER_ITEMS",
                column: "ITEM_STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_ORDER_ITEMS_MENU_ITEM_ID",
                table: "ORDER_ITEMS",
                column: "MENU_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_ORDER_ITEMS_ORDER_ID",
                table: "ORDER_ITEMS",
                column: "ORDER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_ORDER_NUMBER",
                table: "ORDERS",
                column: "ORDER_NUMBER",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_ORDER_TYPE",
                table: "ORDERS",
                column: "ORDER_TYPE");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_RESERVATION_ID",
                table: "ORDERS",
                column: "RESERVATION_ID");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_STATUS",
                table: "ORDERS",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_TABLE_ID",
                table: "ORDERS",
                column: "TABLE_ID");

            migrationBuilder.CreateIndex(
                name: "IX_ORDERS_USER_ID",
                table: "ORDERS",
                column: "USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_OTP_VERIFICATIONS_PHONE_NUMBER_PURPOSE",
                table: "OTP_VERIFICATIONS",
                columns: new[] { "PHONE_NUMBER", "PURPOSE" });

            migrationBuilder.CreateIndex(
                name: "IX_PURCHASE_ORDER_ITEMS_INVENTORY_ITEM_ID",
                table: "PURCHASE_ORDER_ITEMS",
                column: "INVENTORY_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_PURCHASE_ORDER_ITEMS_PO_ID",
                table: "PURCHASE_ORDER_ITEMS",
                column: "PO_ID");

            migrationBuilder.CreateIndex(
                name: "IX_PURCHASE_ORDERS_APPROVED_BY_USER_ID",
                table: "PURCHASE_ORDERS",
                column: "APPROVED_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_PURCHASE_ORDERS_CREATED_BY_USER_ID",
                table: "PURCHASE_ORDERS",
                column: "CREATED_BY_USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_PURCHASE_ORDERS_PO_NUMBER",
                table: "PURCHASE_ORDERS",
                column: "PO_NUMBER",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PURCHASE_ORDERS_STATUS",
                table: "PURCHASE_ORDERS",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_PURCHASE_ORDERS_SUPPLIER_ID",
                table: "PURCHASE_ORDERS",
                column: "SUPPLIER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_RECIPE_BOM_INVENTORY_ITEM_ID",
                table: "RECIPE_BOM",
                column: "INVENTORY_ITEM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_RECIPE_BOM_MENU_ITEM_ID_INVENTORY_ITEM_ID",
                table: "RECIPE_BOM",
                columns: new[] { "MENU_ITEM_ID", "INVENTORY_ITEM_ID" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RECIPE_BOM_UOM_ID",
                table: "RECIPE_BOM",
                column: "UOM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_REFRESH_TOKENS_ACCOUNT_ID",
                table: "REFRESH_TOKENS",
                column: "ACCOUNT_ID");

            migrationBuilder.CreateIndex(
                name: "IX_REFRESH_TOKENS_TOKEN_HASH",
                table: "REFRESH_TOKENS",
                column: "TOKEN_HASH");

            migrationBuilder.CreateIndex(
                name: "IX_REFRESH_TOKENS_UserId",
                table: "REFRESH_TOKENS",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_RESERVATIONS_ASSIGNED_TABLE_ID",
                table: "RESERVATIONS",
                column: "ASSIGNED_TABLE_ID");

            migrationBuilder.CreateIndex(
                name: "IX_RESERVATIONS_PHONE_NUMBER",
                table: "RESERVATIONS",
                column: "PHONE_NUMBER");

            migrationBuilder.CreateIndex(
                name: "IX_RESERVATIONS_PREFERRED_AREA_ID",
                table: "RESERVATIONS",
                column: "PREFERRED_AREA_ID");

            migrationBuilder.CreateIndex(
                name: "IX_RESERVATIONS_RESERVATION_CODE",
                table: "RESERVATIONS",
                column: "RESERVATION_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RESERVATIONS_RESERVATION_TIME",
                table: "RESERVATIONS",
                column: "RESERVATION_TIME");

            migrationBuilder.CreateIndex(
                name: "IX_RESERVATIONS_STATUS",
                table: "RESERVATIONS",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_RESERVATIONS_USER_ID",
                table: "RESERVATIONS",
                column: "USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_SHIFT_CHECKLISTS_CHECKLIST_TYPE",
                table: "SHIFT_CHECKLISTS",
                column: "CHECKLIST_TYPE");

            migrationBuilder.CreateIndex(
                name: "IX_SUPPLIERS_SUPPLIER_CODE",
                table: "SUPPLIERS",
                column: "SUPPLIER_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TABLE_AREAS_AREA_CODE",
                table: "TABLE_AREAS",
                column: "AREA_CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TABLES_AREA_ID_TABLE_NUMBER",
                table: "TABLES",
                columns: new[] { "AREA_ID", "TABLE_NUMBER" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_TABLES_CURRENT_ORDER_ID",
                table: "TABLES",
                column: "CURRENT_ORDER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_TABLES_MERGED_INTO_TABLE_ID",
                table: "TABLES",
                column: "MERGED_INTO_TABLE_ID");

            migrationBuilder.CreateIndex(
                name: "IX_TABLES_STATUS",
                table: "TABLES",
                column: "STATUS");

            migrationBuilder.CreateIndex(
                name: "IX_UNITS_OF_MEASURE_BASE_UOM_ID",
                table: "UNITS_OF_MEASURE",
                column: "BASE_UOM_ID");

            migrationBuilder.CreateIndex(
                name: "IX_UNITS_OF_MEASURE_CODE",
                table: "UNITS_OF_MEASURE",
                column: "CODE",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USER_ADDRESSES_USER_ID",
                table: "USER_ADDRESSES",
                column: "USER_ID");

            migrationBuilder.CreateIndex(
                name: "IX_USERS_EMAIL",
                table: "USERS",
                column: "EMAIL",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_USERS_PHONE_NUMBER",
                table: "USERS",
                column: "PHONE_NUMBER");

            migrationBuilder.AddForeignKey(
                name: "FK_ORDER_ITEM_MODIFIERS_ORDER_ITEMS_ORDER_ITEM_ID",
                table: "ORDER_ITEM_MODIFIERS",
                column: "ORDER_ITEM_ID",
                principalTable: "ORDER_ITEMS",
                principalColumn: "ORDER_ITEM_ID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ORDER_ITEMS_ORDERS_ORDER_ID",
                table: "ORDER_ITEMS",
                column: "ORDER_ID",
                principalTable: "ORDERS",
                principalColumn: "ORDER_ID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ORDERS_RESERVATIONS_RESERVATION_ID",
                table: "ORDERS",
                column: "RESERVATION_ID",
                principalTable: "RESERVATIONS",
                principalColumn: "RESERVATION_ID",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ORDERS_TABLES_TABLE_ID",
                table: "ORDERS",
                column: "TABLE_ID",
                principalTable: "TABLES",
                principalColumn: "TABLE_ID",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ORDERS_USERS_USER_ID",
                table: "ORDERS");

            migrationBuilder.DropForeignKey(
                name: "FK_RESERVATIONS_USERS_USER_ID",
                table: "RESERVATIONS");

            migrationBuilder.DropForeignKey(
                name: "FK_TABLES_ORDERS_CURRENT_ORDER_ID",
                table: "TABLES");

            migrationBuilder.DropTable(
                name: "CHECKLIST_ITEM_RESULTS");

            migrationBuilder.DropTable(
                name: "INVENTORY_AUDIT_ITEMS");

            migrationBuilder.DropTable(
                name: "KITCHEN_TICKET_ITEMS");

            migrationBuilder.DropTable(
                name: "MENU_ITEM_MODIFIER_GROUPS");

            migrationBuilder.DropTable(
                name: "ORDER_ITEM_MODIFIERS");

            migrationBuilder.DropTable(
                name: "OTP_VERIFICATIONS");

            migrationBuilder.DropTable(
                name: "PURCHASE_ORDER_ITEMS");

            migrationBuilder.DropTable(
                name: "RECIPE_BOM");

            migrationBuilder.DropTable(
                name: "REFRESH_TOKENS");

            migrationBuilder.DropTable(
                name: "USER_ADDRESSES");

            migrationBuilder.DropTable(
                name: "CHECKLIST_EXECUTIONS");

            migrationBuilder.DropTable(
                name: "CHECKLIST_ITEMS");

            migrationBuilder.DropTable(
                name: "INVENTORY_AUDITS");

            migrationBuilder.DropTable(
                name: "KITCHEN_STATIONS");

            migrationBuilder.DropTable(
                name: "KITCHEN_TICKETS");

            migrationBuilder.DropTable(
                name: "MODIFIER_OPTIONS");

            migrationBuilder.DropTable(
                name: "ORDER_ITEMS");

            migrationBuilder.DropTable(
                name: "PURCHASE_ORDERS");

            migrationBuilder.DropTable(
                name: "INVENTORY_ITEMS");

            migrationBuilder.DropTable(
                name: "SHIFT_CHECKLISTS");

            migrationBuilder.DropTable(
                name: "MODIFIER_GROUPS");

            migrationBuilder.DropTable(
                name: "MENU_ITEMS");

            migrationBuilder.DropTable(
                name: "SUPPLIERS");

            migrationBuilder.DropTable(
                name: "UNITS_OF_MEASURE");

            migrationBuilder.DropTable(
                name: "CATEGORIES");

            migrationBuilder.DropTable(
                name: "USERS");

            migrationBuilder.DropTable(
                name: "ORDERS");

            migrationBuilder.DropTable(
                name: "RESERVATIONS");

            migrationBuilder.DropTable(
                name: "TABLES");

            migrationBuilder.DropTable(
                name: "TABLE_AREAS");
        }
    }
}
