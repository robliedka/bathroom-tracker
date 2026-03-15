namespace BathroomWatch.Api.Models;

public enum BathroomReportStatus
{
    Available = 0,
    Unavailable = 1
}

public class BathroomReport
{
    public Guid Id { get; set; }
    public Guid BathroomId { get; set; }
    public required string ReporterUserId { get; set; }
    public BathroomReportStatus Status { get; set; }
    public string? Notes { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }

    public Bathroom? Bathroom { get; set; }
    public ApplicationUser? ReporterUser { get; set; }
}
