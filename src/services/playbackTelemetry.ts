class PlaybackTelemetryAgent {
  private errorQueue: Array<any> = [];

  constructor() {
    window.addEventListener('error', (event) => this.logError('window_error', event.message));
    window.addEventListener('unhandledrejection', (event) => this.logError('unhandled_rejection', event.reason));
  }

  public logError(type: string, details: any) {
    const entry = { timestamp: Date.now(), type, details };
    this.errorQueue.push(entry);
    
    // Send to local dev server log collector if queue grows or critical failure
    if (this.errorQueue.length >= 1) {
      this.flush();
    }
  }

  private async flush() {
    if (this.errorQueue.length === 0) return;
    const batch = [...this.errorQueue];
    this.errorQueue = [];

    try {
      await fetch('/__dev_telemetry_sink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
    } catch {
      // Fallback if dev server is unreachable
    }
  }
}

export const telemetryAgent = new PlaybackTelemetryAgent();
