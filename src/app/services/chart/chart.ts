import moment from 'moment';

export interface XAxisTier {
  maxRange: number;  // upper bound of visible range (years); last entry should be Infinity
  step: number;      // target tick interval in years — must be an ECharts "nice" value
  format: 'AUTO' | 'YYYY' | 'YY' | 'YYYY_SUFFIX';
  // 'AUTO'        — ECharts default time axis labels   (auto day/month/year granularity)
  // 'YYYY'        — 4-digit year, no suffix            e.g. "1985"
  // 'YY'          — 2-digit year, no suffix            e.g. "85"  (best within a single century)
  // 'YYYY_SUFFIX' — full year + " г." / " пр.н.е."    e.g. "500 г.", "330 пр.н.е."
}

// Configurable tier table — edit steps/formats to tune axis label density.
// Each tier applies when the visible range is < maxRange years.
//
// IMPORTANT: `step` values must align with ECharts' internal "nice interval"
// set for time axes (1, 2, 3, 5, 10, 20, 50, 100, 200, 500, …).
// We use `splitNumber = visibleYears / step` so that ECharts' nice-rounding
// lands on exactly our desired step. Avoid steps like 25 or 8 — ECharts will
// round them to something else.
//
// Why not `customValues`:
//   - `axisTick.customValues`  works for ticks & splitLine, BUT
//   - `axisLabel.customValues` is BROKEN on `type:'time'` in ECharts 6:
//     `createAxisLabels()` creates `{ value }` without the `level` property
//     that `TimeScale.getLabel()` → `leveledFormat()` requires (TypeError).
//   - `minInterval`/`maxInterval` also fail — ECharts picks from an internal
//     table that includes non-round values (e.g. 8-year month-based steps).
//
// Using `splitNumber` alone lets ECharts manage ticks, labels, and splitLines
// from the same internal positions, guaranteeing alignment.
export const X_AXIS_TIERS: XAxisTier[] = [
  { maxRange: 0.16,     step: 0.01, format: 'AUTO' },
  { maxRange: 40,       step: 1,    format: 'YYYY' },
  { maxRange: 150,      step: 5,    format: 'YYYY' },
  { maxRange: 500,      step: 20,   format: 'YYYY' },
  { maxRange: 2000,     step: 100,  format: 'YYYY' },
  { maxRange: 7000,     step: 500,  format: 'YYYY_SUFFIX' },
  { maxRange: Infinity, step: 1000, format: 'YYYY_SUFFIX' },
];

export function getTierForRange(visibleYears: number): XAxisTier {
  return X_AXIS_TIERS.find(t => visibleYears < t.maxRange) ?? X_AXIS_TIERS[X_AXIS_TIERS.length - 1];
}

const BG_MONTHS_SHORT = ['яну', 'фев', 'мар', 'апр', 'май', 'юни', 'юли', 'авг', 'сеп', 'окт', 'ное', 'дек'];

export function buildXAxisFormatter(format: XAxisTier['format']): (value: any) => string {
  return (value: any) => {
    const d = new Date(value);
    const y = d.getFullYear();
    if (y < 0) return `${Math.abs(y)} пр.н.е.`;
    if (format === 'AUTO') return `${d.getDate()} ${BG_MONTHS_SHORT[d.getMonth()]} ${y}`;
    if (format === 'YYYY_SUFFIX') return `${y} г.`;
    if (format === 'YY') return String(y).slice(-2);
    return String(y);
  };
}

// ECharts' time-scale tick generator iterates ≈ 2·R·(1 + 1/N) times at the
// month sub-level (R = visible range in years, N = splitNumber). A prepended
// boundary tick adds one extra segment, so the true count can reach
// 2·(R + R/N). Keep this under 9800 to stay safely below the 10 000 hard limit.
//
// The splitNumber is set ONCE at chart creation (in buildXAxis) and never
// changed during zoom. Changing it reactively in the dataZoom handler is too
// late — ECharts renders with the OLD value first, triggering the warning
// before our handler runs. A fixed safe splitNumber avoids this entirely.
function safeSplitNumber(rangeYears: number, step: number): number {
  const base = Math.round(rangeYears / step);
  const n = Math.max(1, base);
  if (2 * rangeYears * (1 + 1 / n) <= 9800) return Math.min(40, Math.max(2, base));
  const denom = 9800 - 2 * rangeYears;
  const minN = denom > 0 ? Math.ceil(2 * rangeYears / denom) + 1 : 40;
  return Math.min(40, Math.max(2, minN));
}

let _lastFormat = '';
let _safeSplit = -1;

export function applyXAxisTier(chartInstance: any, visibleYears: number): void {
  const tier = getTierForRange(visibleYears);
  if (tier.format === _lastFormat) return;
  _lastFormat = tier.format;

  const formatter = buildXAxisFormatter(tier.format);
  chartInstance.setOption({
    xAxis: [{
      splitNumber: _safeSplit,
      axisLabel: { formatter: formatter },
    }],
  });
}

export function buildXAxis(fromYear: number, toYearOverride?: number): any[] {
  const toYear = toYearOverride ? moment(`${toYearOverride}-01-01`) : moment().add(6, 'years');
  const toYearNum = parseInt(toYear.format('YYYY'));
  const max = toYear.format('YYYY-MM-DD');

  const min = fromYear < 0
    ? +new Date(`-${String(Math.abs(fromYear)).padStart(6, '0')}-01-01`)
    : `${String(fromYear).padStart(4, '0')}-01-01`;

  const rangeYears = toYearNum - fromYear;
  const tier = getTierForRange(rangeYears);
  _safeSplit = safeSplitNumber(rangeYears, tier.step);
  _lastFormat = tier.format;

  return [
    {
      show: true,
      type: 'time',
      splitLine: { show: true, lineStyle: { color: '#e2e8f0', type: 'solid' } },
      axisTick: { show: true },
      axisLabel: { show: true, hideOverlap: true, formatter: buildXAxisFormatter(tier.format) },
      splitNumber: _safeSplit,
      axisLine: { show: true },
      axisPointer: { show: true },
      gridIndex: 0,
      min,
      max,
    },
  ];
}

export function bigTimeChart(
  series: any,
  yAxisGantt: { labels: string[]; isGroupStart: boolean[] },
  legend: { data: string[]; map: any; selected: {} },
  fromYear = 1944,
  toYear?: number,
) {
  const BG_MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември'];

  return {
    axisPointer: {
      label: {
        formatter: (params: any) => {
          if (params.axisDimension !== 'x') return String(params.value);
          const d = new Date(params.value);
          return `${d.getDate()} ${BG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        },
      },
    },
    tooltip: {
      confine: true,
      backgroundColor: 'rgba(255,255,255,0.97)',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: [10, 14],
      extraCssText: 'box-shadow:0 8px 24px rgba(0,0,0,0.12);border-radius:10px;',
      axisPointer: {
        type: 'cross',
        lineStyle: { color: '#94a3b8', type: 'dashed' },
        crossStyle: { color: '#94a3b8' },
      },
      textStyle: {
        fontFamily: "'Sofia Sans', sans-serif",
        fontSize: 14,
        color: '#1e293b',
      },
    },
    grid: [
      {
        top: 0,
        bottom: 0,
        right: 0,
        left: 0,
        containLabel: false,
      },
    ],
    legend: {
      inactiveColor: '#999',
      type: 'scroll',
      orient: 'vertical',
      left: '80%',
      top: 0,
      data: legend.data,
      formatter: function (name: any) {
        let text = legend.map[name] || name;
        if (text.length > 50) {
          return text.slice(0, 50) + '...';
        }
        return text;
      },
      selected: legend.selected,
    },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: [0],
        filterMode: 'weakFilter',
      },
    ],
    xAxis: buildXAxis(fromYear, toYear),
    yAxis: [
      {
        gridIndex: 0,
        data: yAxisGantt.labels,
        inverse: true,
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: {
          show: true,
          interval: (_index: number) => yAxisGantt.isGroupStart[_index],
        },
        axisLabel: {
          fontSize: 14,
          interval: 0,
          formatter: (value: string) => value.startsWith('\0') ? '' : value,
        },
        axisPointer: {
          show: true,
          triggerEmphasis: false,
          type: 'none',
          label: {
            show: true,
            formatter: (params: any) => {
              const v = String(params.value);
              return v.startsWith('\0') ? v.slice(1) : v;
            },
          },
        },
      },
    ],
    animation: false,
    series: series,
    textStyle: {
      fontFamily: 'Sofia Sans',
      fontSize: 14,
    },
  };
}
