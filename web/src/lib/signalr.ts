import * as signalR from '@microsoft/signalr';

const HUB_URL = import.meta.env.VITE_SIGNALR_HUB_URL ?? 'http://localhost:5166/hubs/updates';

export function createHubConnection(token: string) {
  return new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, {
      accessTokenFactory: () => token,
      // We use bearer tokens (not cookies). Avoid CORS credential requirements cross-origin.
      withCredentials: false,
    })
    .withAutomaticReconnect()
    .build();
}
