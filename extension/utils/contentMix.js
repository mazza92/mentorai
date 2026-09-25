const MIX = [
  { key: 'value', label: 'Real value', color: '#059669', icon: '🎯' },
  { key: 'story', label: 'Personal story', color: '#7c3aed', icon: '📖' },
  { key: 'fluff', label: 'Fluff / padding', color: '#d97706', icon: '💬' },
  { key: 'ads', label: 'Sponsors / ads', color: '#e11d48', icon: '📢' }
];

function parseClock(value) {
  const parts = String(value || '').split(':').map((n) => parseInt(n, 10));
  if (parts.some((n) => Number.isNaN(n))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

function parseChapters(description) {
  const chapters = [];
  const re = /^[\s>*•\-]*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+[-–—.]?\s*(.+)$/gm;
  let match;
  while ((match = re.exec(description || ''))) {
    const title = match[2].replace(/\s+/g, ' ').trim();
    if (!title) continue;
    chapters.push({ timestamp: parseClock(match[1]), title });
  }
  return chapters;
}

function classifyChapter(title) {
  const t = String(title || '').toLowerCase();
  if (/sponsor|ad break|affiliat|promo|partner|use code/.test(t)) return 'ads';
  if (/intro|outro|recap|subscribe|thanks|wrap.?up|let'?s get started/.test(t)) return 'fluff';
  if (/story|journey|background|why i|my life|personal|origin/.test(t)) return 'story';
  return 'value';
}

function roundTo100(parts) {
  const keys = Object.keys(parts);
  const total = keys.reduce((sum, key) => sum + parts[key], 0) || 1;
  const raw = keys.map((key) => ({ key, pct: (parts[key] / total) * 100 }));
  const rounded = raw.map((row) => ({ ...row, pct: Math.round(row.pct) }));
  const drift = 100 - rounded.reduce((sum, row) => sum + row.pct, 0);
  if (rounded.length) rounded[0].pct += drift;
  return Object.fromEntries(rounded.map((row) => [row.key, Math.max(0, row.pct)]));
}

function fromChapters(chapters, durationSec) {
  const duration = Math.max(1, Number(durationSec) || chapters[chapters.length - 1].timestamp + 90);
  const parts = { value: 0, story: 0, fluff: 0, ads: 0 };
  chapters.forEach((chapter, i) => {
    const next = chapters[i + 1]?.timestamp ?? duration;
    const span = Math.max(8, next - chapter.timestamp);
    parts[classifyChapter(chapter.title)] += span;
  });
  return roundTo100(parts);
}

function fromSignals(video) {
  const duration = Number(video.durationSec) || 0;
  const title = String(video.title || '');
  const description = String(video.description || '');
  const blob = `${title} ${description}`.toLowerCase();

  let value = 44;
  let fluff = 24;
  let story = 18;
  let ads = 14;

  if (duration && duration < 240) {
    value = 60; fluff = 18; story = 12; ads = 10;
  } else if (duration && duration > 1200) {
    value = 36; fluff = 26; story = 24; ads = 14;
  }

  if (/how to|tutorial|tips|fix |drill|step|workflow|template|setup/.test(blob)) value += 14;
  if (/sponsor|affiliat|use code|nordvpn|skillshare|raycon|betterhelp|patreon|raid shadow/.test(blob)) ads += 12;
  if (/\b(my story|i used to|when i was|journey|personal|story time)\b/.test(blob)) story += 12;
  if (/forever|must watch|you won'?t believe|secret|gone wrong|gone viral/.test(title.toLowerCase())) fluff += 10;
  if (/[A-Z]{4,}/.test(title) && title.replace(/[^A-Z]/g, '').length >= 8) fluff += 6;
  if (/subscribe|smash that|link in description|before we (get|dive)/.test(blob)) fluff += 6;

  return roundTo100({ value, fluff, story, ads });
}

export function estimateContentMix(video) {
  const chapters = parseChapters(video?.description || '');
  const duration = Number(video?.durationSec) || 0;
  const parts = chapters.length >= 3 && duration
    ? fromChapters(chapters, duration)
    : fromSignals(video || {});

  const segments = MIX.map((item) => ({
    ...item,
    pct: parts[item.key] || 0
  })).filter((item) => item.pct > 0);

  return {
    segments,
    source: chapters.length >= 3 ? 'chapters' : 'signals',
    chapterCount: chapters.length
  };
}

export function mixSummary(mix) {
  const top = [...(mix.segments || [])].sort((a, b) => b.pct - a.pct)[0];
  if (!top) return 'Quick scan of this video.';
  if (top.key === 'value') return `${top.pct}% looks like usable teaching. Skip the rest.`;
  if (top.key === 'ads') return `${top.pct}% reads as sponsor or pitch. Scan before you commit.`;
  if (top.key === 'story') return `${top.pct}% is personal story. Steal the tactic, skip the memoir.`;
  return `${top.pct}% looks like fluff or padding.`;
}
