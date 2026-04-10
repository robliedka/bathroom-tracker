using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using BathroomWatch.Api.Contracts;
using BathroomWatch.Api.Data;
using BathroomWatch.Api.Endpoints;
using BathroomWatch.Api.Hubs;
using BathroomWatch.Api.Models;
using BathroomWatch.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection(JwtSettings.SectionName));
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
                  ?? throw new InvalidOperationException("Jwt settings are missing.");

// Prefer .NET configuration so Azure App Service "Connection strings" and env vars both work.
// Supported:
// - App Service Connection string named "SqlServer" (recommended)
// - Environment variable "ConnectionStrings__SqlServer"
// - Environment variable "SQL_CONNECTION" (legacy)
var sqlConnectionString =
    builder.Configuration.GetConnectionString("SqlServer")
    ?? Environment.GetEnvironmentVariable("ConnectionStrings__SqlServer")
    ?? Environment.GetEnvironmentVariable("SQL_CONNECTION");
if (string.IsNullOrWhiteSpace(sqlConnectionString))
{
    throw new InvalidOperationException(
        "Missing SQL connection string. Set App Service Connection string 'SqlServer' or env var 'ConnectionStrings__SqlServer' (or 'SQL_CONNECTION').");
}

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(
        sqlConnectionString,
        sqlOptions => sqlOptions.EnableRetryOnFailure());
});

builder.Services.AddIdentityCore<ApplicationUser>(options =>
{
    options.User.RequireUniqueEmail = true;
    options.Password.RequiredLength = 8;
    options.Password.RequireDigit = true;
    options.Password.RequireUppercase = true;
    options.Password.RequireLowercase = true;
    options.Password.RequireNonAlphanumeric = false;
})
.AddSignInManager<SignInManager<ApplicationUser>>()
.AddRoles<IdentityRole>()
.AddEntityFrameworkStores<AppDbContext>();

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateIssuerSigningKey = true,
        ValidateLifetime = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey))
    };

    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/updates"))
            {
                context.Token = accessToken;
            }

            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization();
builder.Services.AddSignalR();
builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<BathroomStatusService>();
builder.Services.AddScoped<GamificationService>();
builder.Services.AddHostedService<PredictionHostedService>();

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // Azure App Service acts as a reverse proxy; clearing these avoids having to hardcode proxy IPs.
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("web", policy =>
    {
        // Supports:
        // - JSON array in config: Cors:AllowedOrigins: ["https://...", ...]
        // - Comma/semicolon-separated string in env: Cors__AllowedOrigins: "https://a,https://b"
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        if (origins.Length == 0)
        {
            var raw = builder.Configuration["Cors:AllowedOrigins"];
            if (!string.IsNullOrWhiteSpace(raw))
            {
                origins = raw
                    .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToArray();
            }
        }

        var normalizedOrigins = origins
            .Select(o => o.Trim().TrimEnd('/'))
            .Where(o => !string.IsNullOrWhiteSpace(o))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        policy.WithOrigins(normalizedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = static async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            message = "Rate limit exceeded. Max 5 reports per minute."
        }, token);
    };

    options.AddPolicy("reports", httpContext =>
    {
        // Authenticated users are partitioned by user id; this is per-instance in memory.
        var userId = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? httpContext.Connection.RemoteIpAddress?.ToString()
                     ?? "anon";

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: userId,
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
                AutoReplenishment = true
            });
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

// Keep dev convenience only. In Azure, use migrations or run the provided schema script.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.EnsureCreatedAsync();

    if (!await db.Bathrooms.AnyAsync())
    {
        var now = DateTimeOffset.UtcNow;
        db.Bathrooms.AddRange(
            new Bathroom { Id = Guid.NewGuid(), Name = "Lobby Restroom", Location = "Floor 1", CreatedAtUtc = now },
            new Bathroom { Id = Guid.NewGuid(), Name = "North Wing Restroom", Location = "Floor 2", CreatedAtUtc = now },
            new Bathroom { Id = Guid.NewGuid(), Name = "Cafeteria Restroom", Location = "Floor 1", CreatedAtUtc = now },
            new Bathroom { Id = Guid.NewGuid(), Name = "Gym Restroom", Location = "Basement", CreatedAtUtc = now });
        await db.SaveChangesAsync();
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseForwardedHeaders();
app.UseHttpsRedirection();
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapGet("/", () =>
{
    return Results.Ok(new
    {
        service = "BathroomWatch.Api",
        status = "ok",
        timeUtc = DateTimeOffset.UtcNow
    });
});

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

app.MapAuthEndpoints();
app.MapBathroomEndpoints();
app.MapAdminEndpoints();
app.MapHub<UpdatesHub>("/hubs/updates");

app.MapGet("/api/me", async (
    System.Security.Claims.ClaimsPrincipal principal,
    UserManager<ApplicationUser> userManager) =>
{
    if (!principal.Identity?.IsAuthenticated ?? true)
    {
        return Results.Unauthorized();
    }

    var userId = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrWhiteSpace(userId))
    {
        return Results.Unauthorized();
    }

    var user = await userManager.FindByIdAsync(userId);
    if (user is null)
    {
        return Results.Unauthorized();
    }

    var roles = await userManager.GetRolesAsync(user);

    return Results.Ok(new
    {
        name = user.FullName,
        email = user.Email,
        roles = roles.OrderBy(r => r).ToArray()
    });
}).RequireAuthorization();

app.MapGet("/api/gamification/me", async (
    System.Security.Claims.ClaimsPrincipal principal,
    AppDbContext db,
    GamificationService gamification) =>
{
    var userId = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
    if (string.IsNullOrWhiteSpace(userId))
    {
        return Results.Unauthorized();
    }

    var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
    if (user is null)
    {
        return Results.Unauthorized();
    }

    var status = gamification.GetStatus(user.Points);

    // Dense rank: ties share the same rank.
    var higherCount = await db.Users.AsNoTracking().CountAsync(u => u.Points > user.Points);
    var totalUsers = await db.Users.AsNoTracking().CountAsync();
    var rank = higherCount + 1;

    return Results.Ok(new
    {
        points = status.Points,
        level = status.Level,
        levelName = status.LevelName,
        nextLevelPoints = status.NextLevelPoints,
        rank,
        totalUsers
    });
}).RequireAuthorization();

app.MapGet("/api/gamification/leaderboard", async (
    AppDbContext db,
    GamificationService gamification,
    int take = 25) =>
{
    take = Math.Clamp(take, 1, 100);

    var users = await db.Users
        .AsNoTracking()
        .OrderByDescending(u => u.Points)
        .ThenBy(u => u.FullName)
        .Take(take)
        .Select(u => new { u.FullName, u.Points })
        .ToListAsync();

    var totalUsers = await db.Users.AsNoTracking().CountAsync();

    var entries = new List<LeaderboardEntryResponse>(users.Count);
    var currentRank = 0;
    int? lastPoints = null;
    foreach (var user in users)
    {
        if (lastPoints is null || user.Points != lastPoints.Value)
        {
            currentRank++;
            lastPoints = user.Points;
        }

        var name = (user.FullName ?? "").Trim();
        var firstName = string.IsNullOrWhiteSpace(name) ? "Anonymous" : name.Split(' ', StringSplitOptions.RemoveEmptyEntries)[0];
        var status = gamification.GetStatus(user.Points);

        entries.Add(new LeaderboardEntryResponse(
            currentRank,
            firstName,
            status.Points,
            status.Level,
            status.LevelName));
    }

    return Results.Ok(new LeaderboardResponse(totalUsers, entries));
}).RequireAuthorization();

app.Run();
