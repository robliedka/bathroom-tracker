using BathroomWatch.Api.Contracts;
using BathroomWatch.Api.Models;

namespace BathroomWatch.Api.Services;

public class BathroomStatusService
{
    public BathroomSummaryResponse BuildSummary(
        Bathroom bathroom,
        IReadOnlyList<BathroomReport> last24Hours,
        bool isSubscribed)
    {
        var now = DateTimeOffset.UtcNow;
        var hourStart = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, 0, 0, TimeSpan.Zero);

        var points = Enumerable.Range(0, 24)
            .Select(offset => hourStart.AddHours(-(23 - offset)))
            .Select(hour =>
            {
                var next = hour.AddHours(1);
                var reports = last24Hours.Where(r => r.CreatedAtUtc >= hour && r.CreatedAtUtc < next).ToList();
                var unavailable = reports.Count(r => r.Status == BathroomReportStatus.Unavailable);
                return new HourlyPoint(hour, unavailable, reports.Count);
            })
            .ToList();

        var recent60 = last24Hours.Where(r => r.CreatedAtUtc >= now.AddMinutes(-60)).ToList();
        var recent120 = last24Hours.Where(r => r.CreatedAtUtc >= now.AddMinutes(-120)).ToList();

        var recentUnavailable = recent60.Count(r => r.Status == BathroomReportStatus.Unavailable);
        var recentAvailable = recent120.Count(r => r.Status == BathroomReportStatus.Available);
        var recentUnavailable120 = recent120.Count(r => r.Status == BathroomReportStatus.Unavailable);

        var (color, label) = EvaluateStatus(recent60.Count, recentUnavailable, recentAvailable, recentUnavailable120);

        var lastUpdated = last24Hours.Count == 0 ? bathroom.CreatedAtUtc : last24Hours.Max(r => r.CreatedAtUtc);

        return new BathroomSummaryResponse(
            bathroom.Id,
            bathroom.Name,
            bathroom.Location,
            color,
            label,
            isSubscribed,
            points,
            lastUpdated);
    }

    private static (string Color, string Label) EvaluateStatus(int sampleSize60, int unavailable60, int available120, int unavailable120)
    {
        if (sampleSize60 >= 3 && ((double)unavailable60 / sampleSize60) >= 0.7)
        {
            return ("red", "confirmed unavailable");
        }

        if (unavailable120 > available120)
        {
            return ("yellow", "may be unavailable");
        }

        return ("green", "likely available");
    }
}
