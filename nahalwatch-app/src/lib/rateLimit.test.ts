import { describe, expect, it } from 'vitest';
import { RateLimiter, clientIp, isSameOrigin } from './rateLimit';

describe('RateLimiter', () => {
  it('allows up to max per window, then blocks until the window ends', () => {
    const rl = new RateLimiter({ max: 3, windowMs: 1000 });
    expect([rl.hit('a', 0), rl.hit('a', 10), rl.hit('a', 20), rl.hit('a', 30)]).toEqual([true, true, true, false]);
    expect(rl.hit('b', 30)).toBe(true); // other visitors are counted separately
    expect(rl.hit('a', 1000)).toBe(true); // new window
  });

  it('stays bounded in memory', () => {
    const rl = new RateLimiter({ max: 1, windowMs: 1000 }, 3);
    for (let i = 0; i < 10; i++) expect(rl.hit(`ip${i}`, 0)).toBe(true);
    expect((rl as unknown as { windows: Map<string, unknown> }).windows.size).toBeLessThanOrEqual(3);
  });
});

describe('request checks', () => {
  it('reads the client IP from the proxy headers', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(clientIp(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(clientIp(new Headers())).toBe('unknown');
  });

  it('accepts our own origin and rejects other sites', () => {
    const url = 'https://nahalwatch.example/api/ask';
    expect(isSameOrigin(new Headers({ origin: 'https://nahalwatch.example', host: 'nahalwatch.example' }), url)).toBe(true);
    expect(isSameOrigin(new Headers({ origin: 'https://evil.example', host: 'nahalwatch.example' }), url)).toBe(false);
    expect(isSameOrigin(new Headers({ host: 'nahalwatch.example' }), url)).toBe(true);
  });
});
