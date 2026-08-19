export function validateEPGSchedule(schedule: any[], channels: any[]) {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Group by channel
  const byChannel = new Map();
  schedule.forEach(block => {
    if (!byChannel.has(block.channelId)) byChannel.set(block.channelId, []);
    byChannel.get(block.channelId).push(block);
  });

  byChannel.forEach((blocks, chId) => {
    blocks.sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));

    for (let i = 1; i < blocks.length; i++) {
      const prevEnd = parseTime(blocks[i-1].startTime) + (blocks[i-1].durationMin || 0);
      const currStart = parseTime(blocks[i].startTime);

      if (currStart < prevEnd) errors.push(`Overlap on channel ${chId}`);
      else if (currStart > prevEnd + 10) warnings.push(`Gap on channel ${chId}`);
    }
  });

  return { isValid: errors.length === 0, errors, warnings };
}

function parseTime(t: string) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
