/**
 * Section separator lines with padding between event/gantt sections.
 *
 * This module adds:
 *  - Spacer rows (empty Y-axis categories) between sections for visual padding
 *  - Horizontal separator lines drawn as ECharts graphic elements
 *
 * To remove this feature entirely:
 *  1. Delete this file
 *  2. Remove all imports of this file
 *  3. In series.ts buildEventsCategories: remove `sectionBoundaries` from the return type
 *  4. In utils.ts buildSeries: revert ganttYOffset to `eventCats.totalLanes`
 *  5. In index.component.ts loadChart: revert to simple label concat:
 *       { labels: [...eventCats.labels, ...ganttCats.labels],
 *         isGroupStart: [...eventCats.isGroupStart, ...ganttCats.isGroupStart] }
 *  6. In index.component.ts: remove sectionBoundaries/totalCategories properties,
 *     applySectionSeparators(), and all calls to it / buildSectionGraphic
 */

import { TimelineAreaDataset, TimelineGantt } from '../../models/timeline';
import { buildEventsCategories, buildGanttCategories } from './series';

/** Minimum lane height (px) for showing bar text labels — lowered from 14 to
 *  accommodate the extra spacer rows that reduce each band's height. */
export const MIN_LANE_HEIGHT_FOR_LABEL = 12;

// ── Category assembly ───────────────────────────────────────────────

export interface SectionCategoryResult {
  labels: string[];
  isGroupStart: boolean[];
  sectionBoundaries: number[];
  totalCategories: number;
}

/**
 * Merge event + gantt categories, inserting spacer rows between sections.
 * Returns the combined labels/isGroupStart arrays and the boundary indices
 * where separator lines should be drawn.
 */
export function buildSectionCategories(
  eventCats: ReturnType<typeof buildEventsCategories>,
  ganttCats: ReturnType<typeof buildGanttCategories>,
  gantt: TimelineGantt[],
): SectionCategoryResult {
  const sectionBoundaries = [...eventCats.sectionBoundaries];
  const labels = [...eventCats.labels];
  const isGroupStart = [...eventCats.isGroupStart];

  if (eventCats.totalLanes > 0 && gantt.length > 0) {
    sectionBoundaries.push(labels.length);
    labels.push(' ');
    isGroupStart.push(false);
  }

  labels.push(...ganttCats.labels);
  isGroupStart.push(...ganttCats.isGroupStart);

  return { labels, isGroupStart, sectionBoundaries, totalCategories: labels.length };
}

/**
 * Compute the gantt Y-offset, accounting for the spacer row between
 * events and gantt sections.
 */
export function ganttYOffset(eventTotalLanes: number, hasGantt: boolean): number {
  return eventTotalLanes + (eventTotalLanes > 0 && hasGantt ? 1 : 0);
}

// ── Graphic elements ────────────────────────────────────────────────

/**
 * Build ECharts `graphic` elements (horizontal separator lines) positioned
 * using the chart instance's actual grid pixel bounds.
 */
export function buildSectionGraphic(
  chartInstance: any,
  sectionBoundaries: number[],
  totalCategories: number,
): any[] {
  if (sectionBoundaries.length === 0 || totalCategories === 0) return [];

  const gridModel = chartInstance.getModel().getComponent('grid', 0);
  const gridRect = gridModel.coordinateSystem.getRect();
  const bandH = gridRect.height / totalCategories;

  return sectionBoundaries.map(catIdx => ({
    type: 'rect',
    shape: {
      x: gridRect.x,
      y: gridRect.y + (catIdx + 0.5) * bandH - 1,
      width: gridRect.width,
      height: 2,
    },
    z: 100,
    style: { fill: '#94a3b8' },
    silent: true,
  }));
}
