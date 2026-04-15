export class RequestCreationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestCreationValidationError";
  }
}
