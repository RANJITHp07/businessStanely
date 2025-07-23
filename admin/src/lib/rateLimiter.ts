// Simple in-memory rate limiter for OTP requests
// In production, consider using Redis or a database-based solution

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private attempts: Map<string, RateLimitEntry> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 3, windowMs: number = 15 * 60 * 1000) {
    // 3 attempts per 15 minutes
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    if (!entry) {
      // First attempt
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (now > entry.resetTime) {
      // Reset window
      this.attempts.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxAttempts) {
      return false;
    }

    // Increment count
    entry.count++;
    this.attempts.set(identifier, entry);
    return true;
  }

  getRemainingTime(identifier: string): number {
    const entry = this.attempts.get(identifier);
    if (!entry) return 0;

    const now = Date.now();
    return Math.max(0, entry.resetTime - now);
  }

  getRemainingAttempts(identifier: string): number {
    const entry = this.attempts.get(identifier);
    if (!entry) return this.maxAttempts;

    const now = Date.now();
    if (now > entry.resetTime) return this.maxAttempts;

    return Math.max(0, this.maxAttempts - entry.count);
  }

  // Clean up expired entries (optional, for memory management)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.attempts.entries()) {
      if (now > entry.resetTime) {
        this.attempts.delete(key);
      }
    }
  }
}

// Create a global rate limiter instance
export const otpRateLimiter = new RateLimiter(3, 15 * 60 * 1000); // 3 attempts per 15 minutes

// Helper function to format remaining time
export function formatRemainingTime(ms: number): string {
  const minutes = Math.ceil(ms / (60 * 1000));
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

// Clean up expired entries every hour
if (typeof global !== "undefined") {
  setInterval(() => {
    otpRateLimiter.cleanup();
  }, 60 * 60 * 1000); // 1 hour
}