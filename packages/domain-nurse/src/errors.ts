export class NurseAvailabilityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NurseAvailabilityError";
  }
}
