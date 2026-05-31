export function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error) return err.message
  return fallback
}
