using Microsoft.AspNetCore.Identity;

namespace BathroomWatch.Api.Models;

public class ApplicationUser : IdentityUser
{
    public required string FullName { get; set; }
}
