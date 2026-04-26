export type AdminOpsStatusResponse = {
  generatedAt: string;
  db: "ok" | "error";
  serviceAreas: {
    active: number;
  };
  nurseSupply: {
    verifiedAndAvailable: number;
    launchMinimum: number;
    launchShortfall: number;
    launchReady: boolean;
    launchServiceAreaCount: number;
    launchLowestServiceAreaSupply: number;
    launchServiceAreasBelowMinimum: number;
  };
  requests: {
    unassigned: number;
    staleAssigned: number;
    staleEnroute: number;
    exceptionQueue: number;
  };
  payments: {
    authorizationsWithoutPayout: number;
    recentFailedAuthorizations: number;
    recentFailedPayouts: number;
  };
};

export type AdminOpsStatusCounts = Omit<AdminOpsStatusResponse, "db">;
