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

export class NurseProfileNotFoundError extends Error {
  constructor(message = "Nurse profile not found") {
    super(message);
    this.name = "NurseProfileNotFoundError";
  }
}

export class NurseLocationForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "NurseLocationForbiddenError";
  }
}
