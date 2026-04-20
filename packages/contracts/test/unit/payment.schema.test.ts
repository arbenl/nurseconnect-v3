import {
  AdminRequestPaymentTraceSchema,
  MoneyCurrencySchema,
  RecordNursePayoutSchema,
  RecordPaymentAuthorizationSchema,
  UpdateNursePayoutStatusSchema,
  UpdatePaymentAuthorizationStatusSchema,
} from "../../src/payments";

describe("payment traceability contracts", () => {
  it("accepts ISO currency and positive cent amounts for authorization records", () => {
    expect(
      RecordPaymentAuthorizationSchema.parse({
        amountCents: 12500,
        currency: "USD",
        provider: "manual",
        providerReference: "auth-123",
        note: "Private-pay authorization recorded from phone order",
      }),
    ).toMatchObject({
      amountCents: 12500,
      currency: "USD",
    });

    expect(() => MoneyCurrencySchema.parse("usd")).toThrow();
    expect(() =>
      RecordPaymentAuthorizationSchema.parse({
        amountCents: 0,
        currency: "USD",
      }),
    ).toThrow();
  });

  it("requires a diagnostic reason when traces are marked failed", () => {
    expect(
      UpdatePaymentAuthorizationStatusSchema.parse({
        action: "fail",
        failureReason: "Card authorization expired",
      }),
    ).toMatchObject({ action: "fail" });

    expect(() =>
      UpdatePaymentAuthorizationStatusSchema.parse({
        action: "fail",
        failureReason: "no",
      }),
    ).toThrow();

    expect(() =>
      UpdateNursePayoutStatusSchema.parse({
        action: "fail",
        failureReason: "no",
      }),
    ).toThrow();
  });

  it("keeps payout records tied to a nurse and request", () => {
    expect(
      RecordNursePayoutSchema.parse({
        nurseUserId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0001",
        amountCents: 9000,
        currency: "USD",
      }),
    ).toMatchObject({
      amountCents: 9000,
      currency: "USD",
    });
  });

  it("serializes the admin request payment trace with nullable sides", () => {
    expect(
      AdminRequestPaymentTraceSchema.parse({
        requestId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0002",
        authorization: null,
        payout: null,
      }),
    ).toEqual({
      requestId: "018f5b1c-b7d0-77ef-9d47-a0a0f83d0002",
      authorization: null,
      payout: null,
    });
  });
});
