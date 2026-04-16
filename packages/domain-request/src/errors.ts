export class RequestCreationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestCreationValidationError";
  }
}

export class RequestNotFoundError extends Error {
  constructor(message = "Request not found") {
    super(message);
    this.name = "RequestNotFoundError";
  }
}

export class RequestForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "RequestForbiddenError";
  }
}

export class RequestConflictError extends Error {
  constructor(message = "Request conflict") {
    super(message);
    this.name = "RequestConflictError";
  }
}

export class RequestEventValidationError extends Error {
  constructor(message = "Invalid request event payload") {
    super(message);
    this.name = "RequestEventValidationError";
  }
}
