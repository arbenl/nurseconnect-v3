export type HealthResponse = {
  ok: boolean;
  db: "ok" | "error";
  serviceAreas: {
    active: number;
  };
  nurseSupply: {
    verifiedAndAvailable: number;
  };
  timestamp: string;
};
