using System.Text.Json;
using Application.DTOs.Reservations;
using Application.Interfaces;
using Application.Interfaces.Communication;
using Application.Interfaces.Repositories;
using Application.Interfaces.Services;
using Application.Common.Validation;
using Domain.Entities.Menu;
using Domain.Entities.Operations;
using Domain.Entities.Reservations;
using Domain.Entities.TableManagement;
using Domain.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Application.Services;

public class TableReservationService : ITableReservationService
{
    private const string OpenShiftRequiredMessage = "Vui lòng mở ca trực trước khi mở bàn hoặc thu tiền.";

    private readonly IUnitOfWork _unitOfWork;
    private readonly ITableReservationQueryRepository _reservationQueryRepo;
    private readonly IValidationFactory _validationFactory;
    private readonly IEmailService _emailService;
    private readonly ILogger<TableReservationService> _logger;

    public TableReservationService(
        IUnitOfWork unitOfWork,
        ITableReservationQueryRepository reservationQueryRepo,
        IValidationFactory validationFactory,
        IEmailService emailService,
        ILogger<TableReservationService> logger)
    {
        _unitOfWork = unitOfWork;
        _reservationQueryRepo = reservationQueryRepo;
        _validationFactory = validationFactory;
        _emailService = emailService;
        _logger = logger;
    }

    public async Task<ReservationSummaryDto> CreateReservationAsync(CreateReservationRequestDto request, CancellationToken ct = default)
    {
        // 1. Validate request via IValidationFactory
        await _validationFactory.ValidateAsync(request, ct);

        // 1.1 Anti-Spam / Anti-DoS: Limit max 2 active reservations per phone number on the same day
        var dayStart = request.ReservationTime.Date;
        var dayEnd = dayStart.AddDays(1);
        var normalizedPhone = request.CustomerPhone.Trim();
        var activeSameDayCount = await _unitOfWork.Context.Reservations
            .CountAsync(r => r.CustomerPhone == normalizedPhone
                          && (r.Status == ReservationStatus.Pending || r.Status == ReservationStatus.Confirmed)
                          && r.ReservationTime >= dayStart
                          && r.ReservationTime < dayEnd, ct);

        if (activeSameDayCount >= 2)
        {
            throw new BusinessException("Số điện thoại này đã có tối đa 2 lịch đặt bàn đang chờ trong cùng một ngày.");
        }

        // 2. Find available tables using interval overlap query
        var availableTables = await _reservationQueryRepo.FindAvailableTablesAsync(
            request.ReservationTime,
            durationMinutes: 120,
            guestCount: request.GuestCount,
            areaId: request.PreferredAreaId,
            ct: ct);

        if (!availableTables.Any())
        {
            throw new BusinessException("Rất tiếc, vào khung giờ này nhà hàng đã kín bàn phù hợp với số lượng khách yêu cầu. Vui lòng chọn khung giờ khác.");
        }

        var selectedTable = availableTables.First();

        // 3. Instantiate Domain Entity
        var reservation = new Reservation(
            request.CustomerName,
            request.CustomerPhone,
            request.CustomerEmail,
            request.GuestCount,
            request.ReservationTime,
            request.SpecialRequests,
            request.Allergies,
            request.PreferredAreaId,
            request.UserId);

        // 4. Assign Table
        reservation.AssignTable(selectedTable.TableId);

        _unitOfWork.Context.Reservations.Add(reservation);
        await _unitOfWork.SaveChangesAsync(ct);

        // 5. Send confirmation email if email is provided
        if (!string.IsNullOrWhiteSpace(request.CustomerEmail))
        {
            try
            {
                await _emailService.SendEmailAsync(
                    request.CustomerEmail,
                    $"[JapanFood] Xác nhận đặt bàn #{reservation.ReservationCode}",
                    $"Xin chào {request.CustomerName}, bàn của bạn đã được tiếp nhận thành công vào lúc {request.ReservationTime:HH:mm dd/MM/yyyy}.",
                    ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Không thể gửi email xác nhận đặt bàn tới {Email}", request.CustomerEmail);
            }
        }

        return new ReservationSummaryDto
        {
            ReservationId = reservation.Id,
            ReservationCode = reservation.ReservationCode,
            CustomerName = reservation.CustomerName,
            CustomerPhone = reservation.CustomerPhone,
            GuestCount = reservation.GuestCount,
            ReservationTime = reservation.ReservationTime,
            Status = reservation.Status.ToString(),
            DepositStatus = reservation.DepositStatus.ToString(),
            DepositAmount = reservation.DepositAmount,
            AssignedTableNumber = selectedTable.TableNumber,
            PreferredAreaName = selectedTable.AreaName,
            SpecialRequests = reservation.SpecialRequests,
            Allergies = reservation.Allergies
        };
    }

    public async Task<bool> ConfirmReservationAsync(int reservationId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên xác nhận không hợp lệ.");

        var reservation = await _unitOfWork.Context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId, ct);
        if (reservation == null)
            throw new NotFoundException($"Không tìm thấy phiếu đặt bàn #{reservationId}.");

        reservation.Confirm(staffUserId);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> CheckInGuestAsync(int reservationId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên đón khách không hợp lệ.");

        using var tx = await _unitOfWork.BeginTransactionAsync(ct);
        try
        {
            var reservation = await _unitOfWork.Context.Reservations
                .Include(r => r.AssignedTable)
                .FirstOrDefaultAsync(r => r.Id == reservationId, ct);

            if (reservation == null)
                throw new NotFoundException($"Không tìm thấy phiếu đặt bàn #{reservationId}.");

            if (!reservation.AssignedTableId.HasValue || reservation.AssignedTable == null)
                throw new BusinessException($"Phiếu đặt bàn #{reservationId} chưa được gán bàn.");

            if (!await HasOpenShiftAsync(ct))
                throw new BusinessException(OpenShiftRequiredMessage);

            var table = reservation.AssignedTable;
            if (!table.IsActive)
                throw new BusinessException($"Bàn {table.TableNumber} hiện đang ngừng hoạt động.");

            if (table.Status != TableStatus.Empty && table.Status != TableStatus.Reserved)
                throw new BusinessException($"Bàn {table.TableNumber} hiện đang ở trạng thái {table.Status}, không thể check-in.");

            reservation.Seat(table.Id);

            var order = new Order(
                OrderType.DineIn,
                table.Id,
                reservation.UserId,
                reservation.Id,
                reservation.GuestCount,
                reservation.SpecialRequests);

            await _unitOfWork.Context.Orders.AddAsync(order, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            table.Occupy(order.Id, reservation.GuestCount);
            await _unitOfWork.SaveChangesAsync(ct);

            await _unitOfWork.CommitTransactionAsync(ct);
            return true;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync(ct);
            throw;
        }
    }

    public async Task<bool> CancelReservationAsync(int reservationId, string reason, int? staffUserId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy đặt bàn không được để trống.");

        var reservation = await _unitOfWork.Context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId, ct);
        if (reservation == null)
            throw new NotFoundException($"Không tìm thấy phiếu đặt bàn #{reservationId}.");

        reservation.Cancel(reason, staffUserId);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> CompleteCleaningAsync(int tableId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên dọn bàn không hợp lệ.");

        var table = await _unitOfWork.Context.Tables
            .Include(t => t.CurrentOrder)
            .Include(t => t.MergedChildren)
            .FirstOrDefaultAsync(t => t.Id == tableId, ct);

        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        // Nếu bàn đang Serving nhưng đơn hàng đã thanh toán hoặc cần dọn, giải phóng bàn ngay lập tức
        if (table.Status == Domain.Entities.TableManagement.TableStatus.Serving)
        {
            table.ReleaseToCleaning();
        }

        table.CompleteCleaning();
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> CancelEmptyTableAsync(int tableId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        var table = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .Include(t => t.CurrentOrder)
                .ThenInclude(o => o!.Items)
            .FirstOrDefaultAsync(t => t.Id == tableId, ct);

        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        if (table.CurrentOrder != null)
        {
            var activeItems = table.CurrentOrder.Items
                .Where(i => i.ItemStatus != OrderItemStatus.Cancelled)
                .ToList();

            if (activeItems.Any())
            {
                throw new BusinessException($"Bàn {table.TableNumber} đã có {activeItems.Count} món ăn, không thể hủy như bàn 0đ. Vui lòng thanh toán hoặc hủy món trước.");
            }

            table.CurrentOrder.CancelOrder("Khách rời bàn trước khi gọi món (Bàn 0đ)");
        }

        if (table.MergedIntoTableId.HasValue)
        {
            var parentTable = await _unitOfWork.Context.Tables
                .Include(t => t.MergedChildren)
                .FirstOrDefaultAsync(t => t.Id == table.MergedIntoTableId.Value, ct);
            parentTable?.UnmergeTable(table);
        }

        table.CancelEmptySession();
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> TransferTableAsync(int sourceTableId, int targetTableId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên chuyển bàn không hợp lệ.");

        var sourceTable = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .FirstOrDefaultAsync(t => t.Id == sourceTableId, ct);
        if (sourceTable == null)
            throw new NotFoundException($"Không tìm thấy bàn nguồn #{sourceTableId}.");

        var targetTable = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .FirstOrDefaultAsync(t => t.Id == targetTableId, ct);
        if (targetTable == null)
            throw new NotFoundException($"Không tìm thấy bàn đích #{targetTableId}.");

        sourceTable.TransferTo(targetTable);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> MergeTablesAsync(int masterTableId, int secondaryTableId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên gộp bàn không hợp lệ.");

        var masterTable = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .FirstOrDefaultAsync(t => t.Id == masterTableId, ct);
        if (masterTable == null)
            throw new NotFoundException($"Không tìm thấy bàn chính #{masterTableId}.");

        var secondaryTable = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .FirstOrDefaultAsync(t => t.Id == secondaryTableId, ct);
        if (secondaryTable == null)
            throw new NotFoundException($"Không tìm thấy bàn phụ #{secondaryTableId}.");

        masterTable.MergeTable(secondaryTable);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<OpenTableResponseDto> OpenTableAsync(int tableId, OpenTableRequestDto request, int staffUserId, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên mở bàn không hợp lệ.");

        if (!await HasOpenShiftAsync(ct))
            throw new BusinessException(OpenShiftRequiredMessage);

        var table = await _unitOfWork.Context.Tables
            .Include(t => t.Area)
            .FirstOrDefaultAsync(t => t.Id == tableId, ct);

        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        if (table.Status != Domain.Entities.TableManagement.TableStatus.Empty)
            throw new BusinessException($"Bàn {table.TableNumber} hiện đang ở trạng thái {table.Status}. Chỉ có thể mở bàn khi bàn ở trạng thái Trống (Empty).");

        // Khởi tạo phiên đơn hàng Dine-In cho bàn
        var order = new Domain.Entities.Menu.Order(
            Domain.Entities.Menu.OrderType.DineIn,
            tableId,
            null,
            null,
            request.GuestCount,
            request.Notes);

        await _unitOfWork.Context.Orders.AddAsync(order, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        // Chuyển bàn sang trạng thái Serving
        table.Occupy(order.Id, request.GuestCount);

        var pinCode = System.Security.Cryptography.RandomNumberGenerator.GetInt32(1000, 10000).ToString();
        var rawEntropy = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16));
        var tokenBytes = System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes($"TABLE_{table.Id}_{order.Id}_{rawEntropy}_{DateTime.UtcNow.Ticks}_{pinCode}"));
        var sessionToken = Convert.ToHexString(tokenBytes)[..32].ToLowerInvariant();

        table.SetSessionSecurity(sessionToken, pinCode);
        await _unitOfWork.SaveChangesAsync(ct);

        var setting = await _unitOfWork.Context.RestaurantSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(ct);

        var bankId = setting?.BankId ?? "970422";
        var accountNo = setting?.AccountNumber ?? "0987654321";
        var template = setting?.DefaultQrTemplate ?? "compact2";

        var orderQrUrl = $"https://order.japanfood.vn/table/{table.Id}?token={sessionToken}";
        var vietQrUrl = $"https://img.vietqr.io/image/{bankId}-{accountNo}-{template}.png?amount=0&addInfo=JF%20T{table.TableNumber}";

        return new OpenTableResponseDto
        {
            TableId = table.Id,
            TableNumber = table.TableNumber,
            OrderId = order.Id,
            OrderNumber = order.OrderNumber,
            SessionToken = sessionToken,
            PinCode = pinCode,
            OrderQrUrl = orderQrUrl,
            VietQrUrl = vietQrUrl,
            OpenedAt = DateTime.UtcNow
        };
    }

    public async Task<RegeneratePinResponseDto> RegenerateTablePinAsync(int tableId, int staffUserId, CancellationToken ct = default)
    {
        if (staffUserId <= 0)
            throw new BusinessException("Mã nhân viên không hợp lệ.");

        var table = await _unitOfWork.Context.Tables
            .FirstOrDefaultAsync(t => t.Id == tableId, ct);

        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        if (table.Status != Domain.Entities.TableManagement.TableStatus.Serving)
            throw new BusinessException($"Chỉ có thể đổi mã PIN cho bàn đang phục vụ. Bàn {table.TableNumber} đang ở trạng thái {table.Status}.");

        var newPin = table.RegeneratePin();
        await _unitOfWork.SaveChangesAsync(ct);

        var orderQrUrl = $"https://order.japanfood.vn/table/{table.Id}?token={table.SessionToken}";

        return new RegeneratePinResponseDto
        {
            TableId = table.Id,
            TableNumber = table.TableNumber,
            NewPinCode = newPin,
            SessionToken = table.SessionToken ?? string.Empty,
            OrderQrUrl = orderQrUrl,
            GeneratedAt = DateTime.UtcNow
        };
    }

    public async Task<VerifyTableNetworkResponseDto> VerifyTableNetworkAsync(VerifyTableNetworkRequestDto request, string? clientIp, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var table = await _unitOfWork.Context.Tables
            .Include(t => t.Area)
            .Include(t => t.CurrentOrder)
            .FirstOrDefaultAsync(t => t.Id == request.TableId, ct);

        if (table == null)
        {
            return new VerifyTableNetworkResponseDto
            {
                IsAllowed = false,
                Message = "Không tìm thấy thông tin bàn."
            };
        }

        if (table.Status != Domain.Entities.TableManagement.TableStatus.Serving || !table.CurrentOrderId.HasValue)
        {
            return new VerifyTableNetworkResponseDto
            {
                IsAllowed = false,
                RequiresPin = false,
                Message = $"Bàn {table.TableNumber} hiện chưa được mở để phục vụ gọi món."
            };
        }

        if (string.IsNullOrWhiteSpace(table.SessionToken))
        {
            return new VerifyTableNetworkResponseDto
            {
                IsAllowed = false,
                RequiresPin = false,
                Message = $"Bàn {table.TableNumber} chưa được cấp mã phiên gọi món hợp lệ. Vui lòng liên hệ nhân viên phục vụ."
            };
        }

        // Kiểm tra đối soát Token phiên QR hoặc Mã PIN bàn (Ngăn chặn dùng lại mã QR cũ của lượt khách trước)
        bool isTokenValid = !string.IsNullOrWhiteSpace(request.Token) &&
                            string.Equals(request.Token.Trim(), table.SessionToken, StringComparison.OrdinalIgnoreCase);

        bool isPinValid = !string.IsNullOrWhiteSpace(request.PinCode) &&
                          !string.IsNullOrWhiteSpace(table.PinCode) &&
                          string.Equals(request.PinCode.Trim(), table.PinCode, StringComparison.OrdinalIgnoreCase);

        if (!isTokenValid && !isPinValid)
        {
            return new VerifyTableNetworkResponseDto
            {
                IsAllowed = false,
                RequiresPin = true,
                TableNumber = table.TableNumber,
                Message = !string.IsNullOrWhiteSpace(request.PinCode)
                    ? "Mã PIN không chính xác. Quý khách vui lòng kiểm tra lại mã PIN 4 số in trên hóa đơn mở bàn."
                    : "Mã QR phiên gọi món không hợp lệ hoặc đã hết hạn từ lượt khách trước. Quý khách vui lòng nhập mã PIN trên hóa đơn mở bàn hoặc quét lại mã mới."
            };
        }

        // Kiểm tra đối soát IP WiFi của quán (Khách kết nối WiFi quán thì IP ngoại mạng sẽ khớp với quán)
        bool isNetworkAllowed = false;

        if (clientIp == "127.0.0.1" || clientIp == "::1" || clientIp == "localhost")
        {
            isNetworkAllowed = true;
        }
        else
        {
            var activeConfigs = await _unitOfWork.Context.BranchWifiConfigs
                .AsNoTracking()
                .Where(w => w.IsActive)
                .ToListAsync(ct);

            if (!activeConfigs.Any())
            {
                isNetworkAllowed = true;
            }
            else
            {
                if (!string.IsNullOrWhiteSpace(clientIp))
                {
                    isNetworkAllowed = activeConfigs.Any(w => !string.IsNullOrWhiteSpace(w.PublicIpSubnet) &&
                        (clientIp.Trim().Equals(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase) ||
                         clientIp.Trim().StartsWith(w.PublicIpSubnet.Trim(), StringComparison.OrdinalIgnoreCase)));
                }
            }
        }

        if (!isNetworkAllowed)
        {
            var sampleSsid = await _unitOfWork.Context.BranchWifiConfigs
                .Where(w => w.IsActive)
                .Select(w => w.Ssid)
                .FirstOrDefaultAsync(ct) ?? "WiFi của nhà hàng";

            return new VerifyTableNetworkResponseDto
            {
                IsAllowed = false,
                RequiresPin = false,
                SessionToken = isTokenValid || isPinValid ? table.SessionToken : null,
                Message = $"Vui lòng kết nối vào mạng WiFi '{sampleSsid}' của quán để có thể gọi món tại bàn."
            };
        }

        return new VerifyTableNetworkResponseDto
        {
            IsAllowed = true,
            RequiresPin = false,
            SessionToken = table.SessionToken,
            Message = "Xác thực mạng và phiên gọi món thành công. Quý khách có thể bắt đầu gọi món.",
            BranchId = 1,
            BranchName = "Tori Sakura Dining",
            TableNumber = table.TableNumber,
            CurrentOrderId = table.CurrentOrderId
        };
    }

    public async Task<bool> MarkNoShowAsync(int reservationId, string? notes = null, CancellationToken ct = default)
    {
        var reservation = await _unitOfWork.Context.Reservations.FirstOrDefaultAsync(r => r.Id == reservationId, ct);
        if (reservation == null)
            throw new NotFoundException($"Không tìm thấy phiếu đặt bàn #{reservationId}.");

        reservation.MarkNoShow(notes);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<TableAreaDto> CreateAreaAsync(CreateTableAreaRequestDto request, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var codeUpper = request.AreaCode.Trim().ToUpperInvariant();
        var exists = await _unitOfWork.Context.TableAreas.AnyAsync(a => a.AreaCode == codeUpper, ct);
        if (exists)
            throw new ConflictException($"Khu vực với mã '{codeUpper}' đã tồn tại.");

        var featuresJson = JsonSerializer.Serialize(request.Features ?? new List<string>());
        var area = new TableArea(codeUpper, request.AreaName, request.Description, request.DisplayOrder);
        area.UpdateRichDetails(
            request.AreaName,
            request.JapaneseName,
            request.Description,
            request.ImageUrl,
            featuresJson,
            request.CapacityPerTable,
            request.MinGuests,
            request.MaxGuests,
            request.RequiresDeposit,
            request.DepositPerGuest,
            request.DisplayOrder);

        _unitOfWork.Context.TableAreas.Add(area);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapAreaDto(area, 0, request.Features);
    }

    public async Task<TableAreaDto> UpdateAreaAsync(int areaId, UpdateTableAreaRequestDto request, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var area = await _unitOfWork.Context.TableAreas
            .Include(a => a.Tables)
            .FirstOrDefaultAsync(a => a.Id == areaId, ct);

        if (area == null)
            throw new NotFoundException($"Không tìm thấy khu vực bàn #{areaId}.");

        var featuresJson = JsonSerializer.Serialize(request.Features ?? new List<string>());
        area.UpdateRichDetails(
            request.AreaName,
            request.JapaneseName,
            request.Description,
            request.ImageUrl,
            featuresJson,
            request.CapacityPerTable,
            request.MinGuests,
            request.MaxGuests,
            request.RequiresDeposit,
            request.DepositPerGuest,
            request.DisplayOrder);

        await _unitOfWork.SaveChangesAsync(ct);

        return MapAreaDto(area, area.Tables.Count, request.Features);
    }

    public async Task<bool> SetAreaStatusAsync(int areaId, bool isActive, CancellationToken ct = default)
    {
        var area = await _unitOfWork.Context.TableAreas.FirstOrDefaultAsync(a => a.Id == areaId, ct);
        if (area == null)
            throw new NotFoundException($"Không tìm thấy khu vực bàn #{areaId}.");

        if (!isActive)
        {
            var hasServingTables = await _unitOfWork.Context.Tables
                .AnyAsync(t => t.AreaId == areaId && t.Status == TableStatus.Serving, ct);
            if (hasServingTables)
                throw new BusinessException($"Không thể ngừng hoạt động khu vực '{area.AreaName}' khi vẫn còn bàn đang phục vụ khách.");

            area.Deactivate();
        }
        else
        {
            area.Activate();
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteAreaAsync(int areaId, CancellationToken ct = default)
    {
        var area = await _unitOfWork.Context.TableAreas.FirstOrDefaultAsync(a => a.Id == areaId, ct);
        if (area == null)
            throw new NotFoundException($"Không tìm thấy khu vực bàn #{areaId}.");

        var hasServing = await _unitOfWork.Context.Tables
            .AnyAsync(t => t.AreaId == areaId && t.Status == TableStatus.Serving, ct);
        if (hasServing)
            throw new BusinessException($"Không thể xóa khu vực '{area.AreaName}' khi đang có bàn phục vụ khách.");

        var hasTables = await _unitOfWork.Context.Tables.AnyAsync(t => t.AreaId == areaId, ct);
        var hasReservations = await _unitOfWork.Context.Reservations.AnyAsync(r => r.PreferredAreaId == areaId, ct);
        if (hasTables || hasReservations)
            throw new BusinessException($"Khu vực '{area.AreaName}' đã có bàn hoặc lịch đặt bàn liên kết, không thể xóa. Vui lòng tắt hoạt động thay thế.");

        _unitOfWork.Context.TableAreas.Remove(area);
        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<TableDto> CreateTableAsync(CreateTableRequestDto request, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var area = await _unitOfWork.Context.TableAreas.FirstOrDefaultAsync(a => a.Id == request.AreaId, ct);
        if (area == null)
            throw new NotFoundException($"Không tìm thấy khu vực bàn #{request.AreaId}.");

        var normalizedNumber = request.TableNumber.Trim().ToUpperInvariant();
        var duplicate = await _unitOfWork.Context.Tables
            .AnyAsync(t => t.AreaId == request.AreaId && t.TableNumber == normalizedNumber, ct);
        if (duplicate)
            throw new ConflictException($"Bàn số '{normalizedNumber}' đã tồn tại trong khu vực '{area.AreaName}'.");

        var table = new Table(request.AreaId, normalizedNumber, request.Capacity, request.MinCapacity);
        _unitOfWork.Context.Tables.Add(table);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapTableDto(table, area.AreaName);
    }

    public async Task<TableDto> UpdateTableAsync(int tableId, UpdateTableRequestDto request, CancellationToken ct = default)
    {
        await _validationFactory.ValidateAsync(request, ct);

        var table = await _unitOfWork.Context.Tables.FirstOrDefaultAsync(t => t.Id == tableId, ct);
        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        var area = await _unitOfWork.Context.TableAreas.FirstOrDefaultAsync(a => a.Id == request.AreaId, ct);
        if (area == null)
            throw new NotFoundException($"Không tìm thấy khu vực bàn #{request.AreaId}.");

        var normalizedNumber = request.TableNumber.Trim().ToUpperInvariant();
        var duplicate = await _unitOfWork.Context.Tables
            .AnyAsync(t => t.Id != tableId && t.AreaId == request.AreaId && t.TableNumber == normalizedNumber, ct);
        if (duplicate)
            throw new ConflictException($"Bàn số '{normalizedNumber}' đã tồn tại trong khu vực '{area.AreaName}'.");

        table.UpdateDetails(request.AreaId, normalizedNumber, request.Capacity, request.MinCapacity);
        await _unitOfWork.SaveChangesAsync(ct);

        return MapTableDto(table, area.AreaName);
    }

    public async Task<bool> SetTableStatusAsync(int tableId, bool isActive, CancellationToken ct = default)
    {
        var table = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .FirstOrDefaultAsync(t => t.Id == tableId, ct);
        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        if (isActive)
            table.Activate();
        else
            table.Deactivate();

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    public async Task<bool> DeleteTableAsync(int tableId, CancellationToken ct = default)
    {
        var table = await _unitOfWork.Context.Tables
            .Include(t => t.MergedChildren)
            .FirstOrDefaultAsync(t => t.Id == tableId, ct);
        if (table == null)
            throw new NotFoundException($"Không tìm thấy bàn #{tableId}.");

        var hasMergedChildren = table.MergedChildren.Any() ||
            await _unitOfWork.Context.Tables.AnyAsync(t => t.MergedIntoTableId == tableId, ct);

        if (table.Status == TableStatus.Serving || table.CurrentOrderId.HasValue || table.MergedIntoTableId.HasValue || hasMergedChildren)
        {
            throw new BusinessException($"Không thể xóa bàn {table.TableNumber} khi đang phục vụ khách hoặc đang gộp bàn.");
        }

        var hasOrders = await _unitOfWork.Context.Orders.AnyAsync(o => o.TableId == tableId, ct);
        var hasReservations = await _unitOfWork.Context.Reservations.AnyAsync(r => r.AssignedTableId == tableId, ct);

        if (hasOrders || hasReservations)
        {
            table.Deactivate();
            _logger.LogInformation("Bàn #{TableId} ({TableNumber}) đã có đơn hàng hoặc lịch đặt bàn lịch sử nên được chuyển sang ngừng hoạt động.", table.Id, table.TableNumber);
        }
        else
        {
            _unitOfWork.Context.Tables.Remove(table);
        }

        await _unitOfWork.SaveChangesAsync(ct);
        return true;
    }

    private Task<bool> HasOpenShiftAsync(CancellationToken ct)
    {
        return _unitOfWork.Context.CashierShifts.AnyAsync(s => s.Status == ShiftStatus.Open, ct);
    }

    private static TableAreaDto MapAreaDto(TableArea area, int tableCount, List<string>? features) => new()
    {
        Id = area.Id,
        Code = area.AreaCode,
        Name = area.AreaName,
        JapaneseName = area.JapaneseName,
        Description = area.Description,
        ImageUrl = area.ImageUrl,
        Features = features ?? new List<string>(),
        CapacityPerTable = area.CapacityPerTable,
        MinGuests = area.MinGuests,
        MaxGuests = area.MaxGuests,
        RequiresDeposit = area.RequiresDeposit,
        DepositPerGuest = area.DepositPerGuest,
        DisplayOrder = area.DisplayOrder,
        IsActive = area.IsActive,
        TableCount = tableCount
    };

    private static TableDto MapTableDto(Table table, string areaName) => new()
    {
        TableId = table.Id,
        TableNumber = table.TableNumber,
        Capacity = table.Capacity,
        MinCapacity = table.MinCapacity,
        AreaId = table.AreaId,
        AreaName = areaName,
        Status = table.Status.ToString(),
        CurrentOrderId = table.CurrentOrderId,
        ActiveOrderId = table.CurrentOrderId,
        MergedIntoTableId = table.MergedIntoTableId,
        IsActive = table.IsActive
    };
}
