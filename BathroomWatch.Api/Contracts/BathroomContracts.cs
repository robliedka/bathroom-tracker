namespace BathroomWatch.Api.Contracts;

public record CreateBathroomRequest(string Name, string? Location);
public record CreateReportRequest(string Status, string? Notes);

public record BathroomSummaryResponse(
    Guid Id,
    string Name,
    string? Location,
    string StatusColor,
    string StatusLabel,
    bool IsSubscribed,
    IReadOnlyList<HourlyPoint> Last24Hours,
    DateTimeOffset LastUpdatedUtc);

public record HourlyPoint(DateTimeOffset HourUtc, int UnavailableReports, int TotalReports);

public record BathroomReportResponse(
    Guid Id,
    Guid BathroomId,
    string Status,
    string? Notes,
    DateTimeOffset CreatedAtUtc,
    string ReporterName);
