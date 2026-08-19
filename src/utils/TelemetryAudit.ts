export class TelemetryAudit {
  static createTrace(actionType: string, expectedData: any) {
    return {
      traceId: `trace_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actionType,
      expected: expectedData,
      actual: null,
      status: "PENDING"
    };
  }

  static finalizeTrace(trace: any, actualData: any, playbackSuccess = true) {
    trace.actual = actualData;
    
    const isChannelMatch = trace.expected.channelId === trace.actual.channelId;
    const isTitleMatch = trace.expected.showTitle === trace.actual.showTitle;
    const isScheduleMatch = isChannelMatch && isTitleMatch;

    const questionnaire = `
================================================================================
[TELEMETRY AUDIT LEDGER] - Trace ID: ${trace.traceId}
================================================================================
TRIGGER ACTION:  ${trace.actionType}
EXPECTED TARGET: [${trace.expected.channelId}] | ${trace.expected.showTitle}
RESOLVED TARGET: [${trace.actual.channelId}] | ${trace.actual.showTitle}
STREAM SOURCE:   ${trace.actual.streamUrl}
--------------------------------------------------------------------------------
AUDIT QUESTIONNAIRE (Transcribe / Mark Results):
[${isChannelMatch ? 'YES' : 'NO '}] 1. Selected Channel Match:  [YES / NO / NEED REPAIR]
[${isTitleMatch ? 'YES' : 'NO '}] 2. Selected Title Match:    [YES / NO / NEED REPAIR]
[${isScheduleMatch ? 'YES' : 'NO '}] 3. Schedule Alignment:      [YES / NO / NEED REPAIR]
[${playbackSuccess ? 'YES' : 'NO '}] 4. Media Playback Success:  [YES / NO / NEED REPAIR]

DIAGNOSTIC STATUS: ${
      isScheduleMatch && playbackSuccess
        ? 'HEALTHY - ALIGNED'
        : 'NEED REPAIR - MISMATCH DETECTED'
    }
================================================================================`;

    console.log(questionnaire);

    // Save to local storage for batch auditing
    try {
      const existingTraces = JSON.parse(localStorage.getItem('telemetry_audit_traces') || '[]');
      existingTraces.push({
        trace,
        questionnaire,
        timestamp: new Date().toISOString()
      });
      // Keep last 100 traces
      if (existingTraces.length > 100) {
        existingTraces.shift();
      }
      localStorage.setItem('telemetry_audit_traces', JSON.stringify(existingTraces));
    } catch (e) {
      console.warn('Failed to save telemetry trace to local storage', e);
    }

    return questionnaire;
  }

  static exportTracesAsJSON() {
    try {
      const traces = localStorage.getItem('telemetry_audit_traces') || '[]';
      if (traces === '[]') {
        alert("No telemetry traces found. Please play a stream from the schedule to generate an audit trace.");
        return;
      }
      const blob = new Blob([traces], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telemetry_audit_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export traces', e);
    }
  }

  static exportTracesAsText() {
    try {
      const tracesObj = JSON.parse(localStorage.getItem('telemetry_audit_traces') || '[]');
      if (tracesObj.length === 0) {
        alert("No telemetry traces found. Please play a stream from the schedule to generate an audit trace.");
        return;
      }
      const text = tracesObj.map((t: any) => t.questionnaire).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `telemetry_audit_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export traces', e);
    }
  }
}
