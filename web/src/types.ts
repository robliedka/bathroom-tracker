export type AuthResponse = {
  accessToken: string;
  name: string;
  email: string;
};

export type HourlyPoint = {
  hourUtc: string;
  unavailableReports: number;
  totalReports: number;
};

export type BathroomSummary = {
  id: string;
  name: string;
  location?: string | null;
  statusColor: 'red' | 'yellow' | 'green';
  statusLabel: string;
  isSubscribed: boolean;
  last24Hours: HourlyPoint[];
  lastUpdatedUtc: string;
};

export type BathroomReport = {
  id: string;
  bathroomId: string;
  status: 'available' | 'unavailable';
  notes?: string | null;
  createdAtUtc: string;
  reporterName: string;
};
