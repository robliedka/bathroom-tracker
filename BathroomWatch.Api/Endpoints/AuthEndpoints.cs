using BathroomWatch.Api.Contracts;
using BathroomWatch.Api.Models;
using BathroomWatch.Api.Services;
using Microsoft.AspNetCore.Identity;

namespace BathroomWatch.Api.Endpoints;

public static class AuthEndpoints
{
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

        var token = tokenService.CreateToken(user);

        return Results.Ok(new AuthResponse(token, user.FullName, user.Email!));
    }

    private static async Task<IResult> Login(
        LoginRequest request,
        UserManager<ApplicationUser> userManager,
        SignInManager<ApplicationUser> signInManager,
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

        var token = tokenService.CreateToken(user);
        return Results.Ok(new AuthResponse(token, user.FullName, user.Email!));
    }
}
