import { withRetry } from './retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs the task once when it succeeds', async () => {
    const task = jest.fn().mockResolvedValue(undefined);
    const onRetry = jest.fn();

    await withRetry(task, 3, 500, onRetry);

    expect(task).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries after a failure and stops when the task succeeds', async () => {
    const error = new Error('temporary problem');
    const task = jest.fn().mockRejectedValueOnce(error).mockResolvedValue(undefined);
    const onRetry = jest.fn();

    const promise = withRetry(task, 3, 500, onRetry);
    await jest.advanceTimersByTimeAsync(500);
    await promise;

    expect(task).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, error);
  });

  it('waits 500 ms, then 1000 ms, and throws the last error after 3 attempts', async () => {
    const task = jest
      .fn()
      .mockRejectedValueOnce(new Error('error 1'))
      .mockRejectedValueOnce(new Error('error 2'))
      .mockRejectedValueOnce(new Error('error 3'));
    const onRetry = jest.fn();

    const promise = withRetry(task, 3, 500, onRetry);
    // Attach the check first, so the rejection is never "unhandled"
    const assertion = expect(promise).rejects.toThrow('error 3');

    expect(task).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(500);
    expect(task).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1000);
    expect(task).toHaveBeenCalledTimes(3);

    await assertion;
    expect(onRetry).toHaveBeenCalledTimes(2); // no retry callback after the last attempt
  });
});