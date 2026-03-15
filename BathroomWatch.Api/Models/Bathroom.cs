namespace BathroomWatch.Api.Models;

public class Bathroom
{
    public Guid Id { get; set; }
    public required string Name { get; set; }
    public string? Location { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public string? CreatedByUserId { get; set; }

    public ApplicationUser? CreatedByUser { get; set; }
    public List<BathroomReport> Reports { get; set; } = [];
    public List<BathroomSubscription> Subscriptions { get; set; } = [];
}
