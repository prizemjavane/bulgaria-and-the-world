import { ECharts } from 'echarts';
import {
  buildGanttHighlightUpdates,
  buildGanttResetUpdates,
  buildMarkLineHighlight,
  buildMarkLineResets,
  buildEventMarkLineGlow,
  buildEventMarkLineResets,
} from './highlights';

export interface SelectionState {
  selectedSeriesId: string | null;
  selectedDataIndex: number | null;
  selectedMarkLineName: string | null;
  originalMarkLineStyles: Map<string, any>;
  selectedEventSeriesName: string | null;
  selectedEventPeriodName: string | null;
  originalEventMarkLineStyles: Map<string, any[]>;
}

export function createSelectionState(): SelectionState {
  return {
    selectedSeriesId: null,
    selectedDataIndex: null,
    selectedMarkLineName: null,
    originalMarkLineStyles: new Map(),
    selectedEventSeriesName: null,
    selectedEventPeriodName: null,
    originalEventMarkLineStyles: new Map(),
  };
}

export function highlightGanttItem(chart: ECharts, state: SelectionState, seriesId: string, dataIndex: number): void {
  state.selectedSeriesId = seriesId;
  state.selectedDataIndex = dataIndex;
  const updates = buildGanttHighlightUpdates((chart.getOption() as any).series, seriesId, dataIndex);
  if (updates.length) chart.setOption({ series: updates });
}

export function clearGanttHighlight(chart: ECharts | undefined, state: SelectionState): void {
  state.selectedSeriesId = null;
  state.selectedDataIndex = null;
  if (!chart) return;
  const updates = buildGanttResetUpdates((chart.getOption() as any).series);
  if (updates.length) chart.setOption({ series: updates });
}

export function highlightMarkLine(chart: ECharts, state: SelectionState, name: string): void {
  clearMarkLineHighlight(chart, state);
  state.selectedMarkLineName = name;
  const series = (chart.getOption() as any).series;
  const visualColor = resolveMarkLineVisualColor(chart, name);
  const result = buildMarkLineHighlight(series, name, state.originalMarkLineStyles, visualColor);
  if (!result) return;
  state.originalMarkLineStyles.set(result.seriesId, result.originalStyle);
  chart.setOption({ series: [result.update] });
}

function resolveMarkLineVisualColor(chart: ECharts, name: string): string | undefined {
  try {
    let color: string | undefined;
    (chart as any).getModel().eachSeries((sm: any) => {
      if (color) return;
      const id = sm.id ?? sm.option?.id ?? '';
      if (id.startsWith?.('markline-') && sm.name === name) {
        color = sm.getData?.()?.getVisual?.('color');
      }
    });
    return color;
  } catch {
    return undefined;
  }
}

export function clearMarkLineHighlight(chart: ECharts | undefined, state: SelectionState): void {
  if (!state.selectedMarkLineName) return;
  state.selectedMarkLineName = null;
  if (!chart) return;
  const updates = buildMarkLineResets((chart.getOption() as any).series, state.originalMarkLineStyles);
  state.originalMarkLineStyles.clear();
  if (updates.length) chart.setOption({ series: updates });
}

export function highlightEventMarkLines(chart: ECharts, state: SelectionState, seriesName: string, periodName: string): void {
  clearEventMarkLineHighlight(chart, state);
  state.selectedEventSeriesName = seriesName;
  state.selectedEventPeriodName = periodName;
  const result = buildEventMarkLineGlow((chart.getOption() as any).series, seriesName, periodName, state.originalEventMarkLineStyles);
  if (!result) return;
  state.originalEventMarkLineStyles.set(result.seriesId, result.originalStyles);
  chart.setOption({ series: [result.update] });
}

export function clearEventMarkLineHighlight(chart: ECharts | undefined, state: SelectionState): void {
  if (!state.selectedEventSeriesName) return;
  state.selectedEventSeriesName = null;
  state.selectedEventPeriodName = null;
  if (!chart) return;
  const updates = buildEventMarkLineResets((chart.getOption() as any).series, state.originalEventMarkLineStyles);
  state.originalEventMarkLineStyles.clear();
  if (updates.length) chart.setOption({ series: updates });
}
