export class NurseAvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NurseAvailabilityError";
  }
}

export class NurseCredentialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NurseCredentialValidationError";
  }
}

export class NurseLocationForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "NurseLocationForbiddenError";
  }
}
