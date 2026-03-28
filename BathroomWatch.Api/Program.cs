using System.Text;
using BathroomWatch.Api.Data;
using BathroomWatch.Api.Endpoints;
using BathroomWatch.Api.Hubs;
using BathroomWatch.Api.Models;
using BathroomWatch.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection(JwtSettings.SectionName));
var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
                  ?? throw new InvalidOperationException("Jwt settings are missing.");

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("SqlServer"),
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

builder.Services.AddCors(options =>
{
    options.AddPolicy("web", policy =>
    {
        var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        policy.WithOrigins(origins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
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

app.UseHttpsRedirection();
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();

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
app.MapHub<UpdatesHub>("/hubs/updates");

app.MapGet("/api/me", (System.Security.Claims.ClaimsPrincipal principal) =>
{
    if (!principal.Identity?.IsAuthenticated ?? true)
    {
        return Results.Unauthorized();
    }

    return Results.Ok(new
    {
        name = principal.FindFirst("full_name")?.Value ?? principal.Identity?.Name,
        email = principal.FindFirst(System.Security.Claims.ClaimTypes.Email)?.Value ?? principal.FindFirst("email")?.Value
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

app.Run();
