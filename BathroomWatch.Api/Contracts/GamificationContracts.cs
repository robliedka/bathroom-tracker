namespace BathroomWatch.Api.Contracts;

public record LeaderboardEntryResponse(
    int Rank,
    string Name,
    int Points,
    int Level,
    string LevelName);

public record LeaderboardResponse(
    int TotalUsers,
    IReadOnlyList<LeaderboardEntryResponse> Entries);

