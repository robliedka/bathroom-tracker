using BathroomWatch.Api.Data;
using BathroomWatch.Api.Hubs;
using BathroomWatch.Api.Models;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BathroomWatch.Api.Services;

public class PredictionHostedService(
    IServiceScopeFactory scopeFactory,
    IHubContext<UpdatesHub> hubContext,
    ILogger<PredictionHostedService> logger) : BackgroundService
{
    private readonly Dictionary<Guid, DateTimeOffset> _lastSentByBathroom = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await EvaluateBathroomsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed while running availability prediction task.");
            }

            await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
        }
    }

    private async Task EvaluateBathroomsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var bathrooms = await db.Bathrooms
            .AsNoTracking()
            .ToListAsync(ct);

        var now = DateTimeOffset.UtcNow;

        foreach (var bathroom in bathrooms)
        {
            if (_lastSentByBathroom.TryGetValue(bathroom.Id, out var lastSent) && now - lastSent < TimeSpan.FromHours(1))
            {
                continue;
            }

            var windowStart = now.AddDays(-30);
            var reports = await db.BathroomReports
                .AsNoTracking()
                .Where(r => r.BathroomId == bathroom.Id && r.CreatedAtUtc >= windowStart)
                .ToListAsync(ct);

            var sameHourSamples = reports
                .Where(r => r.CreatedAtUtc.Hour == now.Hour)
                .ToList();

            if (sameHourSamples.Count < 8)
            {
                continue;
            }

            var unavailableRatio = sameHourSamples.Count(r => r.Status == BathroomReportStatus.Unavailable) /
                                   (double)sameHourSamples.Count;

            if (unavailableRatio < 0.65)
            {
                continue;
            }

            var subscriberIds = await db.BathroomSubscriptions
                .AsNoTracking()
                .Where(s => s.BathroomId == bathroom.Id)
                .Select(s => s.UserId)
                .ToListAsync(ct);

            if (subscriberIds.Count == 0)
            {
                continue;
            }

            _lastSentByBathroom[bathroom.Id] = now;

            await hubContext.Clients.Users(subscriberIds).SendAsync(
                "BathroomPrediction",
                new
                {
                    bathroomId = bathroom.Id,
                    bathroomName = bathroom.Name,
                    probabilityUnavailable = Math.Round(unavailableRatio, 2),
                    message = $"{bathroom.Name} may be going unavailable soon based on recent history."
                },
                cancellationToken: ct);
        }
    }
}
