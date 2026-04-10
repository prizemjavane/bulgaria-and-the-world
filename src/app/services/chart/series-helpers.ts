/** Pure helper functions used by series builders — no ECharts dependency. */

/** Parse a date string as local time (not UTC) so it aligns with ECharts' local-timezone axis. */
export function localDate(s: string): number {
  return s.includes('T') ? +new Date(s) : +new Date(s + 'T00:00:00');
}

/** For single-day events (from === to), extend end to 23:59:59 so bars and mark areas are visible. */
export function adjustSingleDayEnd(from: number, to: number): number {
  return from === to ? from + 86_399_000 : to;
}

/** Extract a solid CSS color string from a style color (which may be a linear gradient). */
export function resolveBaseColor(style: any, fallback = 'rgba(128,128,128,0.5)'): string {
  const raw = style?.color ?? fallback;
  return typeof raw === 'string' ? raw : raw.colorStops?.[0]?.color ?? fallback;
}

/** Derive a line color from a base color by raising its alpha to 0.85. */
export function toLineColor(baseColor: string): string {
  return baseColor.replace(/,\s*[\d.]+\)$/, ', 0.85)');
}

/** Build the shared content payload attached to gantt mark areas and event lines. */
export function ganttContent(areaId: string, item: any, from: string, to: number, rangeTo: string | null, contentType?: string) {
  return {
    type: 'gantt' as const,
    id: areaId,
    name: item.name,
    comment: item?.comment,
    description: item?.description,
    sources: item.sources,
    period: [from, rangeTo],
    from,
    to,
    date: item.date,
    contentType,
  };
}

export type Rangeable = { date: { range: [string, string | null] } };

export function getRange(item: Rangeable): [string, string | null] {
  return item.date.range;
}

/**
 * Assign each item in a group to a sub-lane so overlapping periods
 * don't render on top of each other. Uses a greedy algorithm:
 * place each item in the first lane whose last item ends before this one starts.
 */
export function assignLanes(items: Rangeable[]): number[] {
  const lanes: number[] = new Array(items.length).fill(0);
  const laneEnds: number[] = [];

  // Sort indices by start date so the greedy algorithm packs lanes optimally
  const sorted = items
    .map((item, idx) => ({ idx, from: localDate(getRange(item)[0]) }))
    .sort((a, b) => a.from - b.from);

  sorted.forEach(({ idx }) => {
    const range = getRange(items[idx]);
    const from = localDate(range[0]);

    let assignedLane = -1;
    for (let l = 0; l < laneEnds.length; l++) {
      if (from >= laneEnds[l]) {
        assignedLane = l;
        break;
      }
    }

    const to = range[1] === null ? +new Date() : localDate(range[1]);
    if (assignedLane === -1) {
      assignedLane = laneEnds.length;
      laneEnds.push(to);
    } else {
      laneEnds[assignedLane] = to;
    }

    lanes[idx] = assignedLane;
  });

  return lanes;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Deterministic color from group name + item position.
 * Golden-angle (137.508°) spacing maximises hue distinction between adjacent items.
 * HSL(h, 65%, 28%) keeps every colour dark enough for white text at 0.85 opacity.
 */
export function generateGanttColor(groupName: string, itemIndex: number): string {
  let hash = 0;
  for (let i = 0; i < groupName.length; i++) {
    hash = ((hash << 5) - hash + groupName.charCodeAt(i)) | 0;
  }
  const hue = (((hash & 0x7fffffff) % 360) + itemIndex * 137.508) % 360;
  return hslToHex(hue, 65, 28);
}

/** Whether dark text is needed on a bar with the given colour at the given opacity on a white background. */
export function needsDarkText(hex: string, opacity: number): boolean {
  if (!hex || hex[0] !== '#' || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const br = r * opacity + 255 * (1 - opacity);
  const bg = g * opacity + 255 * (1 - opacity);
  const bb = b * opacity + 255 * (1 - opacity);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(br) + 0.7152 * lin(bg) + 0.0722 * lin(bb);
  // 3:1 threshold — all generated colours pass this, so dark text is a rare fallback
  return 1.05 / (L + 0.05) < 3.0;
}

export function codeToFlag(code: string): string {
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}
