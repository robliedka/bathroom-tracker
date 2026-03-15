using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace BathroomWatch.Api.Hubs;

[Authorize]
public class UpdatesHub : Hub
{
}
