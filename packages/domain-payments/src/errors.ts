export class PaymentTraceNotFoundError extends Error {
  constructor(message = "Payment trace not found") {
    super(message);
    this.name = "PaymentTraceNotFoundError";
  }
}

export class PaymentTraceConflictError extends Error {
  constructor(message = "Payment trace conflict") {
    super(message);
    this.name = "PaymentTraceConflictError";
  }
}
