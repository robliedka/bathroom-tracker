using System.Security.Claims;
using BathroomWatch.Api.Contracts;
using BathroomWatch.Api.Data;
using BathroomWatch.Api.Hubs;
using BathroomWatch.Api.Models;
using BathroomWatch.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace BathroomWatch.Api.Endpoints;

public static class BathroomEndpoints
{
    public static RouteGroupBuilder MapBathroomEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/bathrooms")
            .RequireAuthorization();

        group.MapGet("/", GetBathrooms);
        group.MapPost("/", CreateBathroom);
        group.MapDelete("/{bathroomId:guid}", DeleteBathroom);
        group.MapPost("/{bathroomId:guid}/reports", CreateReport);
        group.MapGet("/{bathroomId:guid}/reports", GetReports);
        group.MapPost("/{bathroomId:guid}/subscribe", Subscribe);
        group.MapDelete("/{bathroomId:guid}/subscribe", Unsubscribe);

        return group;
    }

    [Authorize]
    private static async Task<IResult> GetBathrooms(
        ClaimsPrincipal principal,
        AppDbContext db,
        BathroomStatusService statusService)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Results.Unauthorized();
        }

        var bathrooms = await db.Bathrooms
            .AsNoTracking()
            .OrderBy(b => b.Name)
            .ToListAsync();

        var bathroomIds = bathrooms.Select(b => b.Id).ToList();
        var windowStart = DateTimeOffset.UtcNow.AddHours(-24);

        var allReports = await db.BathroomReports
            .AsNoTracking()
            .Where(r => bathroomIds.Contains(r.BathroomId) && r.CreatedAtUtc >= windowStart)
            .ToListAsync();

        var subscriptions = await db.BathroomSubscriptions
            .AsNoTracking()
            .Where(s => s.UserId == userId)
            .Select(s => s.BathroomId)
            .ToHashSetAsync();

        var summaries = bathrooms
            .Select(b =>
            {
                var reports = allReports.Where(r => r.BathroomId == b.Id).ToList();
                return statusService.BuildSummary(b, reports, subscriptions.Contains(b.Id));
            })
            .ToList();

        return Results.Ok(summaries);
    }

    [Authorize]
    private static async Task<IResult> CreateBathroom(
        ClaimsPrincipal principal,
        CreateBathroomRequest request,
        AppDbContext db)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Results.Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Results.BadRequest(new { message = "Bathroom name is required." });
        }

        var bathroom = new Bathroom
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow,
            CreatedByUserId = userId
        };

        db.Bathrooms.Add(bathroom);
        await db.SaveChangesAsync();

        return Results.Created($"/api/bathrooms/{bathroom.Id}", bathroom.Id);
    }

    [Authorize]
    private static async Task<IResult> DeleteBathroom(
        Guid bathroomId,
        ClaimsPrincipal principal,
        AppDbContext db,
        IHubContext<UpdatesHub> hubContext)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Results.Unauthorized();
        }

        var bathroom = await db.Bathrooms.FirstOrDefaultAsync(b => b.Id == bathroomId);
        if (bathroom is null)
        {
            return Results.NotFound();
        }

        // Simple safety rule:
        // - user-created bathrooms can only be deleted by the creator
        // - seeded/system bathrooms (CreatedByUserId == null) can be deleted by any authenticated user
        if (!string.IsNullOrWhiteSpace(bathroom.CreatedByUserId) && bathroom.CreatedByUserId != userId)
        {
            return Results.Forbid();
        }

        var deletedBathroomName = bathroom.Name;

        db.Bathrooms.Remove(bathroom);
        await db.SaveChangesAsync();

        await hubContext.Clients.All.SendAsync("BathroomDeleted", new
        {
            bathroomId,
            bathroomName = deletedBathroomName
        });

        return Results.NoContent();
    }

    [Authorize]
    private static async Task<IResult> CreateReport(
        Guid bathroomId,
        ClaimsPrincipal principal,
        CreateReportRequest request,
        AppDbContext db,
        BathroomStatusService statusService,
        IHubContext<UpdatesHub> hubContext)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        var reporterName = principal.FindFirstValue("full_name") ?? principal.FindFirstValue(ClaimTypes.Name) ?? "Unknown";
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Results.Unauthorized();
        }

        var bathroom = await db.Bathrooms.FirstOrDefaultAsync(b => b.Id == bathroomId);
        if (bathroom is null)
        {
            return Results.NotFound();
        }

        if (!TryParseStatus(request.Status, out var status))
        {
            return Results.BadRequest(new { message = "Status must be 'available' or 'unavailable'." });
        }

        var report = new BathroomReport
        {
            Id = Guid.NewGuid(),
            BathroomId = bathroomId,
            ReporterUserId = userId,
            Status = status,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        db.BathroomReports.Add(report);
        await db.SaveChangesAsync();

        var windowStart = DateTimeOffset.UtcNow.AddHours(-24);
        var reports = await db.BathroomReports
            .AsNoTracking()
            .Where(r => r.BathroomId == bathroomId && r.CreatedAtUtc >= windowStart)
            .ToListAsync();

        var summary = statusService.BuildSummary(bathroom, reports, false);

        var subscribers = await db.BathroomSubscriptions
            .AsNoTracking()
            .Where(s => s.BathroomId == bathroomId)
            .Select(s => s.UserId)
            .ToListAsync();

        var reportResponse = new BathroomReportResponse(
            report.Id,
            bathroomId,
            status == BathroomReportStatus.Unavailable ? "unavailable" : "available",
            report.Notes,
            report.CreatedAtUtc,
            reporterName);

        await hubContext.Clients.All.SendAsync("BathroomUpdated", summary);

        if (subscribers.Count != 0)
        {
            await hubContext.Clients.Users(subscribers).SendAsync("BathroomReportNotification", new
            {
                bathroomId,
                bathroomName = bathroom.Name,
                report = reportResponse,
                message = $"{reporterName} reported {bathroom.Name} as {reportResponse.Status}."
            });
        }

        return Results.Ok(reportResponse);
    }

    [Authorize]
    private static async Task<IResult> GetReports(
        Guid bathroomId,
        ClaimsPrincipal principal,
        AppDbContext db,
        int hours = 24)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Results.Unauthorized();
        }

        var bathroomExists = await db.Bathrooms.AsNoTracking().AnyAsync(b => b.Id == bathroomId);
        if (!bathroomExists)
        {
            return Results.NotFound();
        }

        hours = Math.Clamp(hours, 1, 168);
        var since = DateTimeOffset.UtcNow.AddHours(-hours);

        var reports = await db.BathroomReports
            .AsNoTracking()
            .Where(r => r.BathroomId == bathroomId && r.CreatedAtUtc >= since)
            .OrderByDescending(r => r.CreatedAtUtc)
            .Join(db.Users,
                r => r.ReporterUserId,
                u => u.Id,
                (r, u) => new BathroomReportResponse(
                    r.Id,
                    r.BathroomId,
                    r.Status == BathroomReportStatus.Unavailable ? "unavailable" : "available",
                    r.Notes,
                    r.CreatedAtUtc,
                    u.FullName))
            .ToListAsync();

        return Results.Ok(reports);
    }

    [Authorize]
    private static async Task<IResult> Subscribe(
        Guid bathroomId,
        ClaimsPrincipal principal,
        AppDbContext db)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Results.Unauthorized();
        }

        var exists = await db.Bathrooms.AsNoTracking().AnyAsync(b => b.Id == bathroomId);
        if (!exists)
        {
            return Results.NotFound();
        }

        var alreadySubscribed = await db.BathroomSubscriptions
            .AsNoTracking()
            .AnyAsync(s => s.BathroomId == bathroomId && s.UserId == userId);

        if (!alreadySubscribed)
        {
            db.BathroomSubscriptions.Add(new BathroomSubscription
            {
                BathroomId = bathroomId,
                UserId = userId,
                CreatedAtUtc = DateTimeOffset.UtcNow
            });
            await db.SaveChangesAsync();
        }

        return Results.NoContent();
    }

    [Authorize]
    private static async Task<IResult> Unsubscribe(
        Guid bathroomId,
        ClaimsPrincipal principal,
        AppDbContext db)
    {
        var userId = principal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId))
        {
            return Results.Unauthorized();
        }

        var subscription = await db.BathroomSubscriptions
            .FirstOrDefaultAsync(s => s.BathroomId == bathroomId && s.UserId == userId);

        if (subscription is null)
        {
            return Results.NoContent();
        }

        db.BathroomSubscriptions.Remove(subscription);
        await db.SaveChangesAsync();

        return Results.NoContent();
    }

    private static bool TryParseStatus(string value, out BathroomReportStatus status)
    {
        status = BathroomReportStatus.Available;

        if (string.Equals(value, "available", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.Equals(value, "unavailable", StringComparison.OrdinalIgnoreCase))
        {
            status = BathroomReportStatus.Unavailable;
            return true;
        }

        return false;
    }
}
