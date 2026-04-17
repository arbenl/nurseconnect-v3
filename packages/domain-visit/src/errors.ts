export class VisitNotFoundError extends Error {
  constructor(message = "Request not found") {
    super(message);
    this.name = "VisitNotFoundError";
  }
}

export class VisitForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "VisitForbiddenError";
  }
}
