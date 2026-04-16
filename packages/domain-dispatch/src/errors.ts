export class DispatchValidationError extends Error {
  constructor(message = "Invalid dispatch target") {
    super(message);
    this.name = "DispatchValidationError";
  }
}

export class DispatchCandidateNotFoundError extends Error {
  constructor(message = "No dispatch candidate found") {
    super(message);
    this.name = "DispatchCandidateNotFoundError";
  }
}

export class RequestReassignForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "RequestReassignForbiddenError";
  }
}

export class RequestReassignValidationError extends Error {
  constructor(message = "Invalid request reassignment") {
    super(message);
    this.name = "RequestReassignValidationError";
  }
}
