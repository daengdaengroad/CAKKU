/** 사용자에게 그대로 보여줘도 되는 에러. 그 외 에러는 500으로 뭉갠다. */
export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly hint?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
