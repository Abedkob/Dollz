const MAX_TRACKED_KEYS = 50_000;

export class LoginRateLimiter {
  private readonly attempts = new Map<
    string,
    { count: number; blockedUntil: number }
  >();

  constructor(
    private readonly maximumAttempts: number,
    private readonly lockMilliseconds: number,
  ) {}

  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.attempts.get(key);
    if (!entry) return false;
    if (entry.blockedUntil > now) return true;
    if (entry.blockedUntil !== 0) this.attempts.delete(key);
    return false;
  }

  recordFailure(key: string, now = Date.now()): boolean {
    const entry = this.attempts.get(key) ?? { count: 0, blockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= this.maximumAttempts)
      entry.blockedUntil = now + this.lockMilliseconds;
    this.attempts.delete(key);
    this.attempts.set(key, entry);
    while (this.attempts.size > MAX_TRACKED_KEYS) {
      const oldestKey = this.attempts.keys().next().value;
      if (oldestKey === undefined) break;
      this.attempts.delete(oldestKey);
    }
    return entry.blockedUntil > now;
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
