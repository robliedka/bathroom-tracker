namespace BathroomWatch.Api.Contracts;

public record AdminUserResponse(
    string Id,
    string Email,
    string Name,
    int Points,
    IReadOnlyList<string> Roles);

public record SetUserRoleRequest(string Role);

