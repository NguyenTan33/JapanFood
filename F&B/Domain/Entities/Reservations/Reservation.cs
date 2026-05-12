using Domain.Entities.Common;
using Domain.Entities.TableManagement;
using Domain.Exceptions;

namespace Domain.Entities.Reservations;

public class Reservation : BaseAuditableEntity
{
    public string ReservationCode { get; protected set; } = string.Empty;
    public string CustomerName { get; protected set; } = string.Empty;
    public string CustomerPhone { get; protected set; } = string.Empty;
    public string? CustomerEmail { get; protected set; }
    public int GuestCount { get; protected set; }
    public DateTime ReservationTime { get; protected set; }
    public ReservationStatus Status { get; protected set; } = ReservationStatus.Pending;
    public string? SpecialRequests { get; protected set; }
    public string? Allergies { get; protected set; }
    public int? PreferredAreaId { get; protected set; }
    public int? AssignedTableId { get; protected set; }
    public int? UserId { get; protected set; }
    public DateTime? ConfirmedAt { get; protected set; }
    public int? ConfirmedByUserId { get; protected set; }
    public DateTime? SeatedAt { get; protected set; }
    public DateTime? CancelledAt { get; protected set; }
    public int? CancelledByUserId { get; protected set; }
    public string? CancellationReason { get; protected set; }
    public string? Notes { get; protected set; }

    // Anti-DoS & Deposit Management
    public decimal DepositAmount { get; protected set; } = 0m;
    public DepositStatus DepositStatus { get; protected set; } = DepositStatus.None;
    public DateTime? DepositPaidAt { get; protected set; }
    public string? DepositTransactionCode { get; protected set; }

    // Optimistic Concurrency
    public byte[]? RowVersion { get; protected set; }

    // Navigation
    public virtual TableArea? PreferredArea { get; protected set; }
    public virtual Table? AssignedTable { get; protected set; }
    public virtual User? User { get; protected set; }

    protected Reservation() { } // EF Core

    public Reservation(
        string customerName,
        string customerPhone,
        string? customerEmail,
        int guestCount,
        DateTime reservationTime,
        string? specialRequests = null,
        string? allergies = null,
        int? preferredAreaId = null,
        int? userId = null)
    {
        ValidateCustomerInfo(customerName, customerPhone);
        ValidateGuestCount(guestCount);
        ValidateReservationTime(reservationTime);

        CustomerName = customerName.Trim();
        CustomerPhone = customerPhone.Trim();
        CustomerEmail = customerEmail?.Trim();
        GuestCount = guestCount;
        ReservationTime = reservationTime;
        SpecialRequests = specialRequests?.Trim();
        Allergies = allergies?.Trim();
        PreferredAreaId = preferredAreaId;
        UserId = userId;
        Status = ReservationStatus.Pending;
        ReservationCode = GenerateReservationCode(reservationTime);
    }

    // Domain Methods & Invariants
    public void Confirm(int staffUserId, int? tableId = null)
    {
        if (Status != ReservationStatus.Pending)
            throw new BusinessException($"Chỉ có thể xác nhận đơn đặt bàn ở trạng thái Chờ xử lý (Pending). Trạng thái hiện tại: {Status}.");

        Status = ReservationStatus.Confirmed;
        ConfirmedByUserId = staffUserId;
        ConfirmedAt = DateTime.UtcNow;

        if (tableId.HasValue)
        {
            AssignedTableId = tableId.Value;
        }
    }

    public void AssignTable(int tableId)
    {
        if (tableId <= 0)
            throw new BusinessException("Mã bàn không hợp lệ.");
        if (Status != ReservationStatus.Pending && Status != ReservationStatus.Confirmed)
            throw new BusinessException($"Không thể gán bàn cho đặt bàn có trạng thái {Status}. Chỉ cho phép khi Pending hoặc Confirmed.");

        AssignedTableId = tableId;
    }

    public void Seat(int tableId, DateTime? seatedAt = null)
    {
        if (tableId <= 0)
            throw new BusinessException("Mã bàn không hợp lệ.");
        if (Status == ReservationStatus.Cancelled)
            throw new BusinessException("Không thể xếp chỗ cho đơn đặt bàn đã bị hủy.");
        if (Status == ReservationStatus.NoShow)
            throw new BusinessException("Không thể xếp chỗ cho đơn đặt bàn đã bị đánh dấu No-Show.");
        if (Status == ReservationStatus.Seated)
            throw new BusinessException("Đơn đặt bàn này đã được xếp chỗ trước đó.");

        AssignedTableId = tableId;
        Status = ReservationStatus.Seated;
        SeatedAt = seatedAt ?? DateTime.UtcNow;
    }

    public void Cancel(string reason, int? cancelledByUserId = null)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hủy đặt bàn không được để trống.");
        if (Status == ReservationStatus.Seated)
            throw new BusinessException("Không thể hủy đơn đặt bàn đã nhận chỗ (Seated).");
        if (Status == ReservationStatus.Cancelled)
            throw new BusinessException("Đơn đặt bàn này đã được hủy trước đó.");

        Status = ReservationStatus.Cancelled;
        CancellationReason = reason.Trim();
        CancelledByUserId = cancelledByUserId;
        CancelledAt = DateTime.UtcNow;
    }

    public void MarkNoShow(string? notes = null, DateTime? currentTime = null)
    {
        if (Status != ReservationStatus.Confirmed)
            throw new BusinessException($"Chỉ có thể đánh dấu No-Show cho đơn đặt bàn đã Xác nhận (Confirmed). Trạng thái hiện tại: {Status}.");

        // Grace period check: at least 15 minutes past reservation time
        var now = currentTime ?? DateTime.UtcNow;
        if (now < ReservationTime.AddMinutes(15))
            throw new BusinessException("Chưa hết thời gian chờ gia hạn (15 phút sau giờ hẹn), không thể đánh dấu No-Show.");

        Status = ReservationStatus.NoShow;
        Notes = notes?.Trim();
    }

    public void RequireDeposit(decimal amount)
    {
        if (amount <= 0)
            throw new BusinessException("Số tiền đặt cọc yêu cầu phải lớn hơn 0.");
        if (Status != ReservationStatus.Pending)
            throw new BusinessException("Chỉ có thể yêu cầu đặt cọc khi đơn đặt bàn đang ở trạng thái Chờ xử lý.");

        DepositAmount = amount;
        DepositStatus = DepositStatus.Pending;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RecordDepositPaid(string transactionCode)
    {
        if (string.IsNullOrWhiteSpace(transactionCode))
            throw new BusinessException("Mã giao dịch đặt cọc không được để trống.");
        if (DepositStatus != DepositStatus.Pending)
            throw new BusinessException("Đơn đặt bàn này hiện không ở trạng thái chờ thanh toán cọc.");

        DepositStatus = DepositStatus.Paid;
        DepositTransactionCode = transactionCode.Trim();
        DepositPaidAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void RefundDeposit(string reason)
    {
        if (DepositStatus != DepositStatus.Paid)
            throw new BusinessException("Chỉ có thể hoàn tiền cho đơn đặt cọc đã thanh toán thành công.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("Lý do hoàn tiền cọc không được để trống.");

        DepositStatus = DepositStatus.Refunded;
        Notes = string.IsNullOrWhiteSpace(Notes) ? $"Hoàn cọc: {reason.Trim()}" : $"{Notes} | Hoàn cọc: {reason.Trim()}";
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(int guestCount, DateTime reservationTime, string? specialRequests, string? allergies, int? preferredAreaId)
    {
        if (Status != ReservationStatus.Pending && Status != ReservationStatus.Confirmed)
            throw new BusinessException($"Không thể thay đổi thông tin đặt bàn khi ở trạng thái {Status}.");

        ValidateGuestCount(guestCount);
        ValidateReservationTime(reservationTime);

        GuestCount = guestCount;
        ReservationTime = reservationTime;
        SpecialRequests = specialRequests?.Trim();
        Allergies = allergies?.Trim();
        PreferredAreaId = preferredAreaId;
    }

    private static void ValidateCustomerInfo(string name, string phone)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new BusinessException("Tên khách hàng không được để trống.");
        if (string.IsNullOrWhiteSpace(phone))
            throw new BusinessException("Số điện thoại khách hàng không được để trống.");
    }

    private static void ValidateGuestCount(int count)
    {
        if (count <= 0)
            throw new BusinessException("Số lượng khách đặt bàn phải lớn hơn 0.");
        if (count > 20)
            throw new BusinessException("Đơn đặt bàn trực tuyến tối đa 20 khách. Với số lượng lớn hơn vui lòng liên hệ trực tiếp.");
    }

    private static void ValidateReservationTime(DateTime time)
    {
        if (time <= DateTime.UtcNow.AddMinutes(30))
            throw new BusinessException("Thời gian đặt bàn phải trước ít nhất 30 phút so với thời điểm hiện tại.");

        var timeOfDay = time.TimeOfDay;
        var lunchStart = new TimeSpan(10, 30, 0);
        var lunchEnd = new TimeSpan(14, 0, 0);
        var dinnerStart = new TimeSpan(17, 0, 0);
        var dinnerEnd = new TimeSpan(22, 0, 0);

        bool inLunch = timeOfDay >= lunchStart && timeOfDay <= lunchEnd;
        bool inDinner = timeOfDay >= dinnerStart && timeOfDay <= dinnerEnd;

        if (!inLunch && !inDinner)
            throw new BusinessException($"Thời gian đặt bàn ngoài giờ mở cửa (Trưa: 10:30-14:00, Tối: 17:00-22:00). Giờ chọn: {timeOfDay:hh\\:mm}.");
    }

    private static string GenerateReservationCode(DateTime time) =>
        $"RSV-{time:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
}
