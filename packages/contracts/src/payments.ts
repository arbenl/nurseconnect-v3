import { z } from "zod";

const IsoDateTimeSchema = z.string().datetime({ offset: true });
const NullableIsoDateTimeSchema = IsoDateTimeSchema.nullable();

export const MoneyCurrencySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, "Currency must be an ISO 4217 code");
export type MoneyCurrency = z.infer<typeof MoneyCurrencySchema>;

const MoneyAmountCentsSchema = z.number().int().positive().max(100_000_000);

const TraceProviderSchema = z.string().trim().min(1).max(64).optional();
const TraceProviderReferenceSchema = z.string().trim().min(1).max(255).optional();
const TraceNoteSchema = z.string().trim().min(1).max(1000).optional();

export const PaymentAuthorizationStatusSchema = z.enum([
  "authorized",
  "captured",
  "voided",
  "failed",
]);
export type PaymentAuthorizationStatus = z.infer<typeof PaymentAuthorizationStatusSchema>;

export const NursePayoutStatusSchema = z.enum([
  "owed",
  "paid",
  "failed",
  "canceled",
]);
export type NursePayoutStatus = z.infer<typeof NursePayoutStatusSchema>;

export const PaymentAuthorizationActionSchema = z.enum([
  "capture",
  "void",
  "fail",
]);
export type PaymentAuthorizationAction = z.infer<typeof PaymentAuthorizationActionSchema>;

export const NursePayoutActionSchema = z.enum([
  "mark_paid",
  "fail",
  "cancel",
]);
export type NursePayoutAction = z.infer<typeof NursePayoutActionSchema>;

export const RecordPaymentAuthorizationSchema = z.object({
  amountCents: MoneyAmountCentsSchema,
  currency: MoneyCurrencySchema,
  provider: TraceProviderSchema,
  providerReference: TraceProviderReferenceSchema,
  note: TraceNoteSchema,
});
export type RecordPaymentAuthorizationInput = z.infer<typeof RecordPaymentAuthorizationSchema>;

export const UpdatePaymentAuthorizationStatusSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("capture"),
    providerReference: TraceProviderReferenceSchema,
    note: TraceNoteSchema,
  }),
  z.object({
    action: z.literal("void"),
    note: TraceNoteSchema,
  }),
  z.object({
    action: z.literal("fail"),
    failureReason: z.string().trim().min(3).max(1000),
    note: TraceNoteSchema,
  }),
]);
export type UpdatePaymentAuthorizationStatusInput = z.infer<typeof UpdatePaymentAuthorizationStatusSchema>;

export const RecordNursePayoutSchema = z.object({
  nurseUserId: z.string().uuid(),
  amountCents: MoneyAmountCentsSchema,
  currency: MoneyCurrencySchema,
  provider: TraceProviderSchema,
  providerReference: TraceProviderReferenceSchema,
  note: TraceNoteSchema,
});
export type RecordNursePayoutInput = z.infer<typeof RecordNursePayoutSchema>;

export const UpdateNursePayoutStatusSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("mark_paid"),
    providerReference: TraceProviderReferenceSchema,
    note: TraceNoteSchema,
  }),
  z.object({
    action: z.literal("fail"),
    failureReason: z.string().trim().min(3).max(1000),
    note: TraceNoteSchema,
  }),
  z.object({
    action: z.literal("cancel"),
    note: TraceNoteSchema,
  }),
]);
export type UpdateNursePayoutStatusInput = z.infer<typeof UpdateNursePayoutStatusSchema>;

export const AdminPaymentTraceMutationSchema = z.union([
  z.object({
    kind: z.literal("authorization"),
    action: z.literal("record"),
    amountCents: MoneyAmountCentsSchema,
    currency: MoneyCurrencySchema,
    provider: TraceProviderSchema,
    providerReference: TraceProviderReferenceSchema,
    note: TraceNoteSchema,
  }),
  z.object({
    kind: z.literal("authorization"),
    action: z.literal("capture"),
    providerReference: TraceProviderReferenceSchema,
    note: TraceNoteSchema,
  }),
  z.object({
    kind: z.literal("authorization"),
    action: z.literal("void"),
    note: TraceNoteSchema,
  }),
  z.object({
    kind: z.literal("authorization"),
    action: z.literal("fail"),
    failureReason: z.string().trim().min(3).max(1000),
    note: TraceNoteSchema,
  }),
  z.object({
    kind: z.literal("payout"),
    action: z.literal("record"),
    nurseUserId: z.string().uuid(),
    amountCents: MoneyAmountCentsSchema,
    currency: MoneyCurrencySchema,
    provider: TraceProviderSchema,
    providerReference: TraceProviderReferenceSchema,
    note: TraceNoteSchema,
  }),
  z.object({
    kind: z.literal("payout"),
    action: z.literal("mark_paid"),
    providerReference: TraceProviderReferenceSchema,
    note: TraceNoteSchema,
  }),
  z.object({
    kind: z.literal("payout"),
    action: z.literal("fail"),
    failureReason: z.string().trim().min(3).max(1000),
    note: TraceNoteSchema,
  }),
  z.object({
    kind: z.literal("payout"),
    action: z.literal("cancel"),
    note: TraceNoteSchema,
  }),
]);
export type AdminPaymentTraceMutationInput = z.infer<typeof AdminPaymentTraceMutationSchema>;

export const PaymentAuthorizationTraceSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  patientUserId: z.string().uuid(),
  status: PaymentAuthorizationStatusSchema,
  amountCents: z.number().int().positive(),
  currency: MoneyCurrencySchema,
  provider: z.string().nullable(),
  providerReference: z.string().nullable(),
  note: z.string().nullable(),
  failureReason: z.string().nullable(),
  authorizedAt: NullableIsoDateTimeSchema,
  capturedAt: NullableIsoDateTimeSchema,
  voidedAt: NullableIsoDateTimeSchema,
  failedAt: NullableIsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type PaymentAuthorizationTrace = z.infer<typeof PaymentAuthorizationTraceSchema>;

export const NursePayoutTraceSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  nurseUserId: z.string().uuid(),
  status: NursePayoutStatusSchema,
  amountCents: z.number().int().positive(),
  currency: MoneyCurrencySchema,
  provider: z.string().nullable(),
  providerReference: z.string().nullable(),
  note: z.string().nullable(),
  failureReason: z.string().nullable(),
  owedAt: IsoDateTimeSchema,
  paidAt: NullableIsoDateTimeSchema,
  failedAt: NullableIsoDateTimeSchema,
  canceledAt: NullableIsoDateTimeSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type NursePayoutTrace = z.infer<typeof NursePayoutTraceSchema>;

export const AdminRequestPaymentTraceSchema = z.object({
  requestId: z.string().uuid(),
  authorization: PaymentAuthorizationTraceSchema.nullable(),
  payout: NursePayoutTraceSchema.nullable(),
});
export type AdminRequestPaymentTrace = z.infer<typeof AdminRequestPaymentTraceSchema>;
