using BathroomWatch.Api.Contracts;
using BathroomWatch.Api.Data;
using BathroomWatch.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace BathroomWatch.Api.Endpoints;

public static class AdminEndpoints
{
    public const string RoleStandard = "standard";
    public const string RoleAdmin = "admin";

    public static RouteGroupBuilder MapAdminEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/admin")
            .RequireAuthorization(policy => policy.RequireRole(RoleAdmin));

        group.MapGet("/users", GetUsers);
        group.MapPut("/users/{userId}", SetUserRole);

        return group;
    }

    private static async Task<IResult> GetUsers(
        AppDbContext db,
        UserManager<ApplicationUser> userManager)
    {
        var users = await db.Users
            .AsNoTracking()
            .OrderBy(u => u.Email)
            .ToListAsync();

        var results = new List<AdminUserResponse>(users.Count);
        foreach (var user in users)
        {
            var roles = await userManager.GetRolesAsync(user);
            results.Add(new AdminUserResponse(
                user.Id,
                user.Email ?? string.Empty,
                user.FullName,
                user.Points,
                roles.OrderBy(r => r).ToArray()));
        }

        return Results.Ok(results);
    }

    private static async Task<IResult> SetUserRole(
        string userId,
        SetUserRoleRequest request,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager)
    {
        var role = (request.Role ?? string.Empty).Trim().ToLowerInvariant();
        if (role is not (RoleStandard or RoleAdmin))
        {
            return Results.BadRequest(new { message = "Role must be 'standard' or 'admin'." });
        }

        var user = await userManager.FindByIdAsync(userId);
        if (user is null)
        {
            return Results.NotFound();
        }

        // Ensure roles exist (avoid startup DB dependency).
        await EnsureRoleAsync(roleManager, RoleStandard);
        await EnsureRoleAsync(roleManager, RoleAdmin);

        var currentRoles = await userManager.GetRolesAsync(user);

        if (currentRoles.Contains(RoleAdmin, StringComparer.OrdinalIgnoreCase) && role == RoleStandard)
        {
            // Prevent removing the last admin.
            var admins = await userManager.GetUsersInRoleAsync(RoleAdmin);
            if (admins.Count == 1 && admins[0].Id == user.Id)
            {
                return Results.Conflict(new { message = "Cannot remove the last admin." });
            }
        }

        if (currentRoles.Count != 0)
        {
            var remove = await userManager.RemoveFromRolesAsync(user, currentRoles);
            if (!remove.Succeeded)
            {
                return Results.BadRequest(new { errors = remove.Errors.Select(e => e.Description).ToArray() });
            }
        }

        var add = await userManager.AddToRoleAsync(user, role);
        if (!add.Succeeded)
        {
            return Results.BadRequest(new { errors = add.Errors.Select(e => e.Description).ToArray() });
        }

        return Results.NoContent();
    }

    private static async Task EnsureRoleAsync(RoleManager<IdentityRole> roleManager, string role)
    {
        if (await roleManager.RoleExistsAsync(role))
        {
            return;
        }

        await roleManager.CreateAsync(new IdentityRole(role));
    }
}
