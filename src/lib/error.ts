export class AppError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function createError(message: string, statusCode: number): AppError {
  return new AppError(message, statusCode);
}
