export class RequestValidationError extends Error {
  constructor(readonly details: readonly string[]) {
    super("The request is not valid");
    this.name = "RequestValidationError";
  }
}
