/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react"
import React from "react"
import { describe, it, expect } from "vitest"

import RoleBadge from "../role-badge"
import '@testing-library/jest-dom/vitest';

describe("RoleBadge", () => {
  it("renders Patient", () => {
    render(<RoleBadge role="patient" />);
    expect(screen.getByText("Patient")).toBeInTheDocument();
  });
});
