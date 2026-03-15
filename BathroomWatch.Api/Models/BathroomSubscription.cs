namespace BathroomWatch.Api.Models;

public class BathroomSubscription
{
    public Guid BathroomId { get; set; }
    public required string UserId { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }

    public Bathroom? Bathroom { get; set; }
    public ApplicationUser? User { get; set; }
}
