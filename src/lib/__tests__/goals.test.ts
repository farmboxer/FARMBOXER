import { describe, expect, it } from "vitest";
import { computeGoalPath } from "@/lib/goals";

describe("5-year path math", () => {
  it("computes CAGR from 15M to 1B over 5 years", () => {
    const path = computeGoalPath({
      currentSalesRmb: 15_000_000,
      targetSalesRmb: 1_000_000_000,
      targetYears: 5,
      marginFloorPercent: 15,
    });
    expect(path.multiple).toBeCloseTo(1000 / 15, 5);
    expect(path.cagr).toBeGreaterThan(1.3);
    expect(path.cagr).toBeLessThan(1.4);
    expect(path.milestones).toHaveLength(6);
    expect(path.milestones[0].salesRmb).toBe(15_000_000);
    expect(path.milestones[5].salesRmb).toBeCloseTo(1_000_000_000, -2);
    expect(path.milestones[5].minProfitRmb).toBeCloseTo(150_000_000, -2);
    expect(path.ambitious).toBe(true);
    expect(path.honestNote).toContain("激进");
  });
});
