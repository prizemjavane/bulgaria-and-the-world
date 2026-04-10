/**
 * Pure functions that compute ECharts series updates for highlight/dim operations.
 * Each returns an array suitable for `chartInstance.setOption({ series: updates })`.
 */

/**
 * Build series updates to highlight a specific gantt item and dim all others.
 * value[9]: 0 = normal, 1 = selected, 2 = dimmed
 */
export function buildGanttHighlightUpdates(
  series: any[],
  targetSeriesId: string,
  targetDataIndex: number,
): any[] {
  const updates: any[] = [];
  for (const s of series) {
    if (!s.id?.startsWith('gantt-')) continue;
    const updatedData = s.data.map((item: any, idx: number) => {
      const v = item.value;
      const sel = s.id === targetSeriesId && idx === targetDataIndex ? 1 : 2;
      if (v[9] === sel) return item;
      return { ...item, value: [...v.slice(0, 9), sel, v[10]] };
    });
    updates.push({ id: s.id, data: updatedData });
  }
  return updates;
}

/**
 * Build series updates to reset all gantt items to normal state (value[9] = 0).
 */
export function buildGanttResetUpdates(series: any[]): any[] {
  const updates: any[] = [];
  for (const s of series) {
    if (!s.id?.startsWith('gantt-')) continue;
    const needsReset = s.data.some((item: any) => item.value[9] !== 0);
    if (!needsReset) continue;
    const updatedData = s.data.map((item: any) => {
      if (item.value[9] === 0) return item;
      return { ...item, value: [...item.value.slice(0, 9), 0, item.value[10]] };
    });
    updates.push({ id: s.id, data: updatedData });
  }
  return updates;
}

/**
 * Build a series update to visually highlight a mark line by name.
 * Returns the update payload and the original style to save, or null if not found.
 */
export function buildMarkLineHighlight(
  series: any[],
  name: string,
  savedStyles: Map<string, any>,
  visualColor?: string,
): { seriesId: string; originalStyle: any; update: any } | null {
  for (const s of series) {
    if (!s.id?.startsWith('markline-') || !s.markLine?.data?.length) continue;
    if (s.name !== name) continue;
    const md = s.markLine.data[0];
    const orig = savedStyles.get(s.id) ?? { ...(md.lineStyle || {}) };
    return {
      seriesId: s.id,
      originalStyle: orig,
      update: {
        id: s.id,
        markLine: {
          data: [{
            ...md,
            lineStyle: {
              ...orig,
              width: (orig.width || 2) + 1,
              shadowBlur: 8,
              shadowColor: s.color || orig.color || md.lineStyle?.color || visualColor || '#000',
            },
          }],
        },
      },
    };
  }
  return null;
}

/**
 * Build series updates to restore all mark lines to their original styles.
 */
export function buildMarkLineResets(
  series: any[],
  originalStyles: Map<string, any>,
): any[] {
  const updates: any[] = [];
  for (const [id, orig] of originalStyles) {
    const s = series.find((ser: any) => ser.id === id);
    if (!s?.markLine?.data?.length) continue;
    const md = s.markLine.data[0];
    updates.push({
      id,
      markLine: {
        data: [{ ...md, lineStyle: { ...orig } }],
      },
    });
  }
  return updates;
}

/**
 * Build a series update to add glow to mark lines of an event mark-area series.
 * Matches mark lines by period name within the series identified by seriesName.
 */
export function buildEventMarkLineGlow(
  series: any[],
  seriesName: string,
  periodName: string,
  savedStyles: Map<string, any[]>,
): { seriesId: string; originalStyles: any[]; update: any } | null {
  const expectedId = `event-area-${seriesName}`;
  for (const s of series) {
    if (s.id !== expectedId || !s.markLine?.data?.length) continue;
    if (savedStyles.has(s.id)) continue;
    const originalStyles = s.markLine.data.map((d: any) => ({ ...(d.lineStyle || {}) }));
    const updatedData = s.markLine.data.map((d: any) => {
      if (d.name !== periodName) return d;
      const style = d.lineStyle || {};
      return {
        ...d,
        lineStyle: {
          ...style,
          width: (style.width || 1) + 1,
          shadowBlur: 8,
          shadowColor: style.color || '#000',
        },
      };
    });
    return {
      seriesId: s.id,
      originalStyles,
      update: { id: s.id, markLine: { data: updatedData } },
    };
  }
  return null;
}

/**
 * Build series updates to restore event mark lines to their original styles.
 */
export function buildEventMarkLineResets(
  series: any[],
  originalStyles: Map<string, any[]>,
): any[] {
  const updates: any[] = [];
  for (const [id, styles] of originalStyles) {
    const s = series.find((ser: any) => ser.id === id);
    if (!s?.markLine?.data?.length) continue;
    const updatedData = s.markLine.data.map((d: any, i: number) => ({
      ...d,
      lineStyle: { ...styles[i] },
    }));
    updates.push({ id, markLine: { data: updatedData } });
  }
  return updates;
}

/**
 * Build series updates to toggle active state on events strip items.
 * value[4]: 1 = active, 0 = inactive
 */
export function buildEventsStripActiveUpdates(
  series: any[],
  ids: Set<string>,
  active: boolean,
): any[] {
  return series
    .filter((s: any) => s.id?.startsWith('events-strip'))
    .map((strip: any) => ({
      id: strip.id,
      data: strip.data.map((item: any) => {
        if (!ids.has(item.content?.eventId)) return item;
        const v = item.value;
        return { ...item, value: [v[0], v[1], v[2], v[3], active ? 1 : 0] };
      }),
    }));
}

/**
 * Build series updates to dim/undim events strip items based on active tags.
 * value[5]: 1 = dimmed, 0 = normal
 */
export function buildTagDimmingUpdates(
  series: any[],
  activeTags: Record<string, boolean>,
): any[] {
  const active = Object.entries(activeTags).filter(([, v]) => v).map(([k]) => k);
  const hasFilter = active.length > 0;
  const strips = series.filter((s: any) => s.id?.startsWith('events-strip'));

  const updates = strips
    .filter((strip: any) => {
      if (!hasFilter) return true;
      return strip.data.some((item: any) =>
        (item.content?.tags ?? []).some((t: string) => active.includes(t)),
      );
    })
    .map((strip: any) => ({
      id: strip.id,
      data: strip.data.map((item: any) => {
        const tags: string[] = item.content?.tags ?? [];
        const dimmed = hasFilter && !tags.some((t: string) => active.includes(t));
        const v = item.value;
        return { ...item, value: [v[0], v[1], v[2], v[3], v[4], dimmed ? 1 : 0] };
      }),
    }));

  const updatedIds = new Set(updates.map((u: any) => u.id));
  const resets = strips
    .filter((strip: any) => !updatedIds.has(strip.id))
    .map((strip: any) => ({
      id: strip.id,
      data: strip.data.map((item: any) => {
        const v = item.value;
        return { ...item, value: [v[0], v[1], v[2], v[3], v[4], 0] };
      }),
    }));

  return [...updates, ...resets];
}
