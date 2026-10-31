export class StorageError extends Error {
  constructor(
    message: string,
    public readonly code:
      "CORRUPT" | "WRITE_FAILED" | "NOT_FOUND" | "INVALID_CURSOR",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "StorageError";
  }
}
