namespace BathroomWatch.Api.Services;

public record GamificationStatus(
    int Points,
    int Level,
    string LevelName,
    int NextLevelPoints);

public class GamificationService
{
    // Five levels. Adjust thresholds/names as you like.
    private static readonly (int MinPoints, string Name)[] Levels =
    [
        (0, "Sprout"),
        (50, "Scout"),
        (150, "Regular"),
        (350, "Guardian"),
        (750, "Legend")
    ];

    public GamificationStatus GetStatus(int points)
    {
        points = Math.Max(0, points);

        var levelIndex = 0;
        for (var i = Levels.Length - 1; i >= 0; i--)
        {
            if (points >= Levels[i].MinPoints)
            {
                levelIndex = i;
                break;
            }
        }

        var level = levelIndex + 1;
        var nextLevelPoints = levelIndex >= Levels.Length - 1 ? Levels[^1].MinPoints : Levels[levelIndex + 1].MinPoints;
        return new GamificationStatus(points, level, Levels[levelIndex].Name, nextLevelPoints);
    }
}

