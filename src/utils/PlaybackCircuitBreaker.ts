export class PlaybackCircuitBreaker {
    private maxRetries: number;
    private timeWindowMs: number;
    public attempts: number;
    private firstAttemptTimestamp: number;
    public isTripped: boolean;

    constructor(maxRetries = 3, timeWindowMs = 12000) {
        this.maxRetries = maxRetries;
        this.timeWindowMs = timeWindowMs; // How long to track rapid failures (e.g., 12 seconds)
        this.attempts = 0;
        this.firstAttemptTimestamp = 0;
        this.isTripped = false;
    }

    /**
     * Call this every time the player enters an 'error' or 'stalled' state.
     * Returns TRUE if the breaker has tripped (stop retrying!).
     */
    public recordFailure(): boolean {
        const now = Date.now();

        // Reset the counter if the previous failures were outside our time window
        if (this.attempts === 0 || (now - this.firstAttemptTimestamp > this.timeWindowMs)) {
            this.attempts = 1;
            this.firstAttemptTimestamp = now;
            this.isTripped = false;
        } else {
            this.attempts++;
        }

        if (this.attempts >= this.maxRetries) {
            this.isTripped = true;
            console.warn(`[Circuit Breaker] TRIPPED! ${this.attempts} failures in ${this.timeWindowMs}ms.`);
        }

        return this.isTripped;
    }

    public reset(): void {
        this.attempts = 0;
        this.isTripped = false;
    }
}
