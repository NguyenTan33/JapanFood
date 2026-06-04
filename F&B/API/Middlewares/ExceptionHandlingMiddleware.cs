using System.Text.Json;
using Domain.Exceptions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API.Middlewares;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IWebHostEnvironment _env;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IWebHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (ForbiddenException ex)
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status403Forbidden, "FORBIDDEN", ex.Message);
        }
        catch (NotFoundException ex)
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status404NotFound, "NOT_FOUND", ex.Message);
        }
        catch (ConflictException ex)
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status409Conflict, "CONFLICT", ex.Message);
        }
        catch (BusinessException ex)
        {
            await WriteErrorResponseAsync(context, StatusCodes.Status400BadRequest, "BAD_REQUEST", ex.Message);
        }
        catch (DbUpdateConcurrencyException ex)
        {
            _logger.LogWarning(ex, "Database Concurrency Conflict: {Message}", ex.Message);
            await WriteErrorResponseAsync(context, StatusCodes.Status409Conflict, "CONFLICT", "Dữ liệu vừa được cập nhật bởi phiên giao dịch khác. Vui lòng tải lại và thử lại.");
        }
        catch (DbUpdateException ex)
        {
            _logger.LogError(ex, "EF Core Database Update Error: {Message}", ex.Message);
            if (ex.InnerException is SqlException innerSql && (innerSql.Number == 2627 || innerSql.Number == 2601))
            {
                await WriteErrorResponseAsync(context, StatusCodes.Status409Conflict, "DUPLICATE_ENTRY", "Dữ liệu đã tồn tại hoặc xung đột trạng thái duy nhất trong hệ thống.");
            }
            else
            {
                await WriteErrorResponseAsync(context, StatusCodes.Status500InternalServerError, "DATABASE_ERROR", "Lỗi cơ sở dữ liệu hệ thống.");
            }
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "SQL Server Database Error: {Message}", ex.Message);

            // 2627: Primary key / Unique constraint violation, 2601: Unique index violation
            if (ex.Number == 2627 || ex.Number == 2601)
            {
                await WriteErrorResponseAsync(context, StatusCodes.Status409Conflict, "DUPLICATE_ENTRY", "Dữ liệu đã tồn tại trong hệ thống (Email hoặc Số điện thoại trùng lặp).");
            }
            else
            {
                await WriteErrorResponseAsync(context, StatusCodes.Status500InternalServerError, "DATABASE_ERROR", "Lỗi cơ sở dữ liệu hệ thống.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled Exception: {Message}", ex.Message);

            var errorMessage = _env.IsDevelopment()
                ? ex.Message
                : "Đã có lỗi không mong muốn xảy ra trong hệ thống.";

            await WriteErrorResponseAsync(context, StatusCodes.Status500InternalServerError, "INTERNAL_SERVER_ERROR", errorMessage);
        }
    }

    private static async Task WriteErrorResponseAsync(
        HttpContext context,
        int statusCode,
        string code,
        string message)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = statusCode;

        var response = new
        {
            statusCode,
            code,
            message
        };

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = true
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(response, options));
    }
}
