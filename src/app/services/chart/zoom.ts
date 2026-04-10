import { ECharts } from 'echarts';
import { applyXAxisTier } from './chart';

export interface AxisRange {
  axisMinMs: number;
  axisMaxMs: number;
}

export interface ZoomState {
  startValue: number;
  endValue: number;
}

export function cacheAxisRange(chart: ECharts): AxisRange {
  const opt: any = chart.getOption();
  const xAxis = opt.xAxis?.[0];
  const toMs = (v: any) => (typeof v === 'string' ? +new Date(v) : Number(v));
  return {
    axisMinMs: toMs(xAxis?.min),
    axisMaxMs: toMs(xAxis?.max),
  };
}

export function syncXAxisStep(chart: ECharts, range: AxisRange, dzStart = 0, dzEnd = 100): void {
  if (!isFinite(range.axisMinMs) || !isFinite(range.axisMaxMs)) return;
  const visibleYears = (range.axisMaxMs - range.axisMinMs) * (dzEnd - dzStart) / 100 / (365.25 * 24 * 3600 * 1000);
  if (!isFinite(visibleYears)) return;
  applyXAxisTier(chart, visibleYears);
}

export function captureZoom(chart: ECharts | undefined): ZoomState | null {
  if (!chart) return null;
  const opt: any = chart.getOption();
  const dz = opt.dataZoom?.[0];
  const xa = opt.xAxis?.[0];
  if (!dz || !xa) return null;
  const toTs = (v: any) => (typeof v === 'number' ? v : new Date(v).getTime());
  const minTs = toTs(xa.min);
  const maxTs = toTs(xa.max);
  if (!isFinite(minTs) || !isFinite(maxTs)) return null;
  return {
    startValue: minTs + (maxTs - minTs) * dz.start / 100,
    endValue:   minTs + (maxTs - minTs) * dz.end   / 100,
  };
}

export function restoreZoom(chart: ECharts | undefined, zoom: ZoomState | null): void {
  if (!zoom || !chart) return;
  chart.dispatchAction({ type: 'dataZoom', startValue: zoom.startValue, endValue: zoom.endValue });
}

const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export function zoomToDateRange(chart: ECharts, fromMs: number, toMs: number): void {
  const duration = toMs - fromMs;
  const padding = Math.max(20 * YEAR_MS, duration * 0.15);
  chart.dispatchAction({ type: 'dataZoom', startValue: fromMs - padding, endValue: toMs + padding });
}

export function panToDate(chart: ECharts, dateMs: number): void {
  const zoom = captureZoom(chart);
  if (!zoom) return;
  const span = zoom.endValue - zoom.startValue;
  chart.dispatchAction({ type: 'dataZoom', startValue: dateMs - span / 2, endValue: dateMs + span / 2 });
}
