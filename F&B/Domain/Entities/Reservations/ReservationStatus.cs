namespace Domain.Entities.Reservations;

public enum ReservationStatus
{
    Pending = 1,
    Confirmed = 2,
    Seated = 3,
    Cancelled = 4,
    NoShow = 5,
    Completed = 6
}
