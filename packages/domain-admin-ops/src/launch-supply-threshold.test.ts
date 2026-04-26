import { describe, expect, it } from "vitest";

import {
  LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
  summarizeLaunchNurseSupply,
} from "./launch-supply-threshold";

describe("summarizeLaunchNurseSupply", () => {
  it("marks launch supply blocked until the minimum verified available density is met", () => {
    expect(
      summarizeLaunchNurseSupply({
        verifiedAndAvailable: 0,
        launchServiceAreaCount: 0,
        launchLowestServiceAreaSupply: 0,
        launchServiceAreasBelowMinimum: 0,
      }),
    ).toEqual({
      verifiedAndAvailable: 0,
      launchMinimum: LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
      launchShortfall: 10,
      launchReady: false,
      launchServiceAreaCount: 0,
      launchLowestServiceAreaSupply: 0,
      launchServiceAreasBelowMinimum: 0,
    });

    expect(
      summarizeLaunchNurseSupply({
        verifiedAndAvailable: 9,
        launchServiceAreaCount: 1,
        launchLowestServiceAreaSupply: 9,
        launchServiceAreasBelowMinimum: 1,
      }),
    ).toEqual({
      verifiedAndAvailable: 9,
      launchMinimum: LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
      launchShortfall: 1,
      launchReady: false,
      launchServiceAreaCount: 1,
      launchLowestServiceAreaSupply: 9,
      launchServiceAreasBelowMinimum: 1,
    });
  });

  it("marks launch supply ready at and above the minimum density", () => {
    expect(
      summarizeLaunchNurseSupply({
        verifiedAndAvailable: 10,
        launchServiceAreaCount: 1,
        launchLowestServiceAreaSupply: 10,
        launchServiceAreasBelowMinimum: 0,
      }),
    ).toEqual({
      verifiedAndAvailable: 10,
      launchMinimum: LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
      launchShortfall: 0,
      launchReady: true,
      launchServiceAreaCount: 1,
      launchLowestServiceAreaSupply: 10,
      launchServiceAreasBelowMinimum: 0,
    });

    expect(
      summarizeLaunchNurseSupply({
        verifiedAndAvailable: 12,
        launchServiceAreaCount: 2,
        launchLowestServiceAreaSupply: 12,
        launchServiceAreasBelowMinimum: 0,
      }),
    ).toEqual({
      verifiedAndAvailable: 12,
      launchMinimum: LAUNCH_MINIMUM_VERIFIED_AVAILABLE_NURSES,
      launchShortfall: 0,
      launchReady: true,
      launchServiceAreaCount: 2,
      launchLowestServiceAreaSupply: 12,
      launchServiceAreasBelowMinimum: 0,
    });
  });

  it("blocks launch when any active service area is below the minimum", () => {
    expect(
      summarizeLaunchNurseSupply({
        verifiedAndAvailable: 20,
        launchServiceAreaCount: 2,
        launchLowestServiceAreaSupply: 0,
        launchServiceAreasBelowMinimum: 1,
      }),
    ).toMatchObject({
      verifiedAndAvailable: 20,
      launchShortfall: 10,
      launchReady: false,
      launchServiceAreaCount: 2,
      launchLowestServiceAreaSupply: 0,
      launchServiceAreasBelowMinimum: 1,
    });
  });
});
