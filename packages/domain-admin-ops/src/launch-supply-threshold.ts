export const LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES = 10;

export type LaunchNurseSupplyInput = {
  verifiedAndAvailable: number;
  launchServiceAreaCount: number;
  launchLowestServiceAreaSupply: number;
  launchServiceAreasBelowMinimum: number;
};

export function summarizeLaunchNurseSupply(input: LaunchNurseSupplyInput) {
  const launchLowestServiceAreaSupply =
    input.launchServiceAreaCount > 0 ? input.launchLowestServiceAreaSupply : 0;
  const launchShortfall = Math.max(
    0,
    LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES - launchLowestServiceAreaSupply,
  );

  return {
    verifiedAndAvailable: input.verifiedAndAvailable,
    launchMinimum: LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
    launchShortfall,
    launchReady:
      input.launchServiceAreaCount > 0 &&
      input.launchServiceAreasBelowMinimum === 0,
    launchServiceAreaCount: input.launchServiceAreaCount,
    launchLowestServiceAreaSupply,
    launchServiceAreasBelowMinimum: input.launchServiceAreasBelowMinimum,
  };
}
