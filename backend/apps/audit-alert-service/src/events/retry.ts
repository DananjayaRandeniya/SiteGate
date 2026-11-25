const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Runs `task` up to `attempts` times. Waits baseDelayMs, then double that, and so on
 * between attempts. If every attempt fails, the last error is thrown.
 */
export async function withRetry(
  task: () => Promise<void>,
  attempts: number,
  baseDelayMs: number,
  onRetry: (attempt: number, error: unknown) => void,
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      await task();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        onRetry(attempt, error);
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
    }
  }
  throw lastError;
}