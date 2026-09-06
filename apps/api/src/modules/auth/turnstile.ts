export interface TurnstileVerifier {
  verify(token: string, remoteIp?: string): Promise<boolean>;
}

export class CloudflareTurnstileVerifier implements TurnstileVerifier {
  constructor(
    private readonly secretKey: string,
    private readonly timeoutMilliseconds = 3_000,
  ) {}

  async verify(token: string, remoteIp?: string): Promise<boolean> {
    const body = new URLSearchParams({
      secret: this.secretKey,
      response: token,
    });
    if (remoteIp) body.set('remoteip', remoteIp);
    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          body,
          signal: AbortSignal.timeout(this.timeoutMilliseconds),
        },
      );
      if (!response.ok) return false;
      const result = (await response.json()) as { success?: boolean };
      return result.success === true;
    } catch {
      return false;
    }
  }
}
