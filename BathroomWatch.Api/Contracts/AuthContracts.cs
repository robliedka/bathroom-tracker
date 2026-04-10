namespace BathroomWatch.Api.Contracts;

public record RegisterRequest(string Name, string Email, string Password);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string AccessToken, string Name, string Email, IReadOnlyList<string> Roles);
