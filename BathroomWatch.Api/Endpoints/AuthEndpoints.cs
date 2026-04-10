using BathroomWatch.Api.Contracts;
using BathroomWatch.Api.Endpoints;
using BathroomWatch.Api.Models;
using BathroomWatch.Api.Services;
using Microsoft.AspNetCore.Identity;

namespace BathroomWatch.Api.Endpoints;

public static class AuthEndpoints
{
    private const string BootstrapAdminEmailEnv = "BOOTSTRAP_ADMIN_EMAIL";

    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth");

        group.MapPost("/register", Register);
        group.MapPost("/login", Login);

        return group;
    }

    private static async Task<IResult> Register(
        RegisterRequest request,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        JwtTokenService tokenService)
    {
        var existing = await userManager.FindByEmailAsync(request.Email);
        if (existing is not null)
        {
            return Results.Conflict(new { message = "Email is already registered." });
        }

        var user = new ApplicationUser
        {
            FullName = request.Name.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            UserName = request.Email.Trim().ToLowerInvariant()
        };

        var result = await userManager.CreateAsync(user, request.Password);
        if (!result.Succeeded)
        {
            return Results.BadRequest(new { errors = result.Errors.Select(e => e.Description).ToArray() });
        }

        await EnsureRolesAsync(roleManager);

        // Default to standard; optionally bootstrap first admin via env var.
        var assignedRole = await ShouldBootstrapAdminAsync(user, userManager)
            ? AdminEndpoints.RoleAdmin
            : AdminEndpoints.RoleStandard;

        var addRole = await userManager.AddToRoleAsync(user, assignedRole);
        if (!addRole.Succeeded)
        {
            return Results.BadRequest(new { errors = addRole.Errors.Select(e => e.Description).ToArray() });
        }

        var roles = await userManager.GetRolesAsync(user);
        var token = tokenService.CreateToken(user, roles);
        return Results.Ok(new AuthResponse(token, user.FullName, user.Email!, roles.OrderBy(r => r).ToArray()));
    }

    private static async Task<IResult> Login(
        LoginRequest request,
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
        RoleManager<IdentityRole> roleManager,
        JwtTokenService tokenService)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await userManager.FindByEmailAsync(email);
        if (user is null)
        {
            return Results.Unauthorized();
        }

        var canSignIn = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: false);
        if (!canSignIn.Succeeded)
        {
            return Results.Unauthorized();
        }

        await EnsureRolesAsync(roleManager);

        // If configured, promote the bootstrap admin (only if there are currently no admins).
        if (await ShouldBootstrapAdminAsync(user, userManager))
        {
            var currentRoles = await userManager.GetRolesAsync(user);
            if (!currentRoles.Contains(AdminEndpoints.RoleAdmin, StringComparer.OrdinalIgnoreCase))
            {
                // Keep a single-role model: remove existing roles before adding admin.
                if (currentRoles.Count != 0)
                {
                    await userManager.RemoveFromRolesAsync(user, currentRoles);
                }
                await userManager.AddToRoleAsync(user, AdminEndpoints.RoleAdmin);
            }
        }

        var roles = await userManager.GetRolesAsync(user);
        var token = tokenService.CreateToken(user, roles);
        return Results.Ok(new AuthResponse(token, user.FullName, user.Email!, roles.OrderBy(r => r).ToArray()));
    }

    private static async Task EnsureRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        if (!await roleManager.RoleExistsAsync(AdminEndpoints.RoleStandard))
        {
            await roleManager.CreateAsync(new IdentityRole(AdminEndpoints.RoleStandard));
        }

        if (!await roleManager.RoleExistsAsync(AdminEndpoints.RoleAdmin))
        {
            await roleManager.CreateAsync(new IdentityRole(AdminEndpoints.RoleAdmin));
        }
    }

    private static async Task<bool> ShouldBootstrapAdminAsync(ApplicationUser user, UserManager<ApplicationUser> userManager)
    {
        var bootstrapEmail = Environment.GetEnvironmentVariable(BootstrapAdminEmailEnv)?.Trim();
        if (string.IsNullOrWhiteSpace(bootstrapEmail))
        {
            return false;
        }

        if (!string.Equals(user.Email, bootstrapEmail, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        var admins = await userManager.GetUsersInRoleAsync(AdminEndpoints.RoleAdmin);
        return admins.Count == 0;
    }
}
