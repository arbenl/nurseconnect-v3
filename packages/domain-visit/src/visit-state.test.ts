import { describe, expect, it } from "vitest";

import { isVisitActive, isVisitHistorical, isVisitTerminal } from "./visit-state";

describe("visit-state", () => {
  it("treats open, assigned, accepted, and enroute as active", () => {
    expect(isVisitActive("open")).toBe(true);
    expect(isVisitActive("assigned")).toBe(true);
    expect(isVisitActive("accepted")).toBe(true);
    expect(isVisitActive("enroute")).toBe(true);
    expect(isVisitActive("completed")).toBe(false);
  });

  it("treats completed, canceled, and rejected as terminal/historical", () => {
    expect(isVisitTerminal("completed")).toBe(true);
    expect(isVisitTerminal("canceled")).toBe(true);
    expect(isVisitHistorical("rejected")).toBe(true);
    expect(isVisitHistorical("open")).toBe(false);
  });
});
