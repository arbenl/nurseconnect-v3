import { PaymentTraceConflictError } from "./errors";
import {
  canTransitionNursePayout,
  canTransitionPaymentAuthorization,
} from "./payment-lifecycle";

describe("payment trace lifecycle", () => {
  it("captures authorized payment traces and rejects terminal replay", () => {
    expect(canTransitionPaymentAuthorization("authorized", "capture")).toBe("captured");

    expect(() =>
      canTransitionPaymentAuthorization("captured", "void"),
    ).toThrow(PaymentTraceConflictError);
  });

  it("marks owed payout traces paid and rejects non-owed transitions", () => {
    expect(canTransitionNursePayout("owed", "mark_paid")).toBe("paid");

    expect(() =>
      canTransitionNursePayout("paid", "fail"),
    ).toThrow(PaymentTraceConflictError);
  });
});
