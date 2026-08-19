export interface QuarantineRecord {
  failures: number;
  isQuarantined: boolean;
  lastFailedAt: number;
}

const STORAGE_KEY = 'ajn_quarantined_channels';

export class QuarantineLedger {
  private static getLedger(): Record<string, QuarantineRecord> {
    if (typeof window === 'undefined') return {};
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  private static saveLedger(ledger: Record<string, QuarantineRecord>) {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
      } catch (e) {}
    }
  }

  static recordFailure(channelId: string) {
    if (!channelId || channelId === 'unknown') return;
    const ledger = this.getLedger();
    const record = ledger[channelId] || { failures: 0, isQuarantined: false, lastFailedAt: 0 };
    
    record.failures += 1;
    record.lastFailedAt = Date.now();
    
    if (record.failures >= 3) {
      record.isQuarantined = true;
    }
    
    ledger[channelId] = record;
    this.saveLedger(ledger);
  }

  static isQuarantined(channelId: string): boolean {
    if (!channelId || channelId === 'unknown') return false;
    const ledger = this.getLedger();
    return ledger[channelId]?.isQuarantined || false;
  }

  static resetChannel(channelId: string) {
    if (!channelId) return;
    const ledger = this.getLedger();
    if (ledger[channelId]) {
      delete ledger[channelId];
      this.saveLedger(ledger);
    }
  }

  static clearLedger() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
}
