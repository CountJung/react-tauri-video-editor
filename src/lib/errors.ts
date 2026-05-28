export interface AppError {
  code: string
  message: string
  details?: string
}

export function isAppError(err: unknown): err is AppError {
  return typeof err === 'object' && err !== null && 'code' in err && 'message' in err
}

export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err
  if (err instanceof Error) {
    return { code: 'UNKNOWN', message: err.message }
  }
  return { code: 'UNKNOWN', message: String(err) }
}
