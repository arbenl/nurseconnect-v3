export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ProfileValidationError extends Error {
  details?: unknown;

  constructor(message = "Validation failed", details?: unknown) {
    super(message);
    this.name = "ProfileValidationError";
    this.details = details;
  }
}

export class RoleChangeValidationError extends Error {
  constructor(message = "Invalid role") {
    super(message);
    this.name = "RoleChangeValidationError";
  }
}

export class UserNotFoundError extends Error {
  constructor(message = "User not found") {
    super(message);
    this.name = "UserNotFoundError";
  }
}
