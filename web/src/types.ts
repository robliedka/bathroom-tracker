export type AuthResponse = {
  accessToken: string;
  name: string;
  email: string;
  roles: string[];
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

export type GamificationMe = {
  points: number;
  level: number;
  levelName: string;
  nextLevelPoints: number;
  rank: number;
  totalUsers: number;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  points: number;
  level: number;
  levelName: string;
};

export type LeaderboardResponse = {
  totalUsers: number;
  entries: LeaderboardEntry[];
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  points: number;
  roles: string[];
};
