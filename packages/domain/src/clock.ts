/** Every place that needs "now" reads it through a Clock, never `Date.now()`/`new Date()` directly — makes TTL/expiry logic deterministically testable. */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

export class FixedClock implements Clock {
  private current: Date;

  constructor(initial: Date) {
    this.current = initial;
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(next: Date): void {
    this.current = new Date(next.getTime());
  }
}
