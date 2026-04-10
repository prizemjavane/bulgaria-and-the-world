import * as echarts from 'echarts/core';
import { DatePrecision, formatDate, formatDateDiff, formatSourceDate, formatTimelineDate, getCoarsestPrecision, getDatePrecision } from '../date';
import { getStarSign } from '../../pipes/star-sign.pipe';
import moment from 'moment/moment';
import Decimal from 'decimal.js';
import { Chart } from '../../models/chart';
import { TimelineArea, TimelineAreaDataset, TimelineGantt, TimelineGanttStyleDef, TimelineLine } from '../../models/timeline';
import { MIN_LANE_HEIGHT_FOR_LABEL } from './section-separators';
import {
  localDate,
  adjustSingleDayEnd,
  resolveBaseColor,
  toLineColor,
  ganttContent,
  getRange,
  assignLanes,
  generateGanttColor,
  needsDarkText,
  codeToFlag,
} from './series-helpers';

export { localDate, adjustSingleDayEnd, getRange } from './series-helpers';

const textWidthCache = new Map<string, number>();

const TT_FONT = "'Sofia Sans', sans-serif";
const TT_TEXT = '#1e293b';
const TT_MUTED = '#64748b';
const TT_BORDER = '#e2e8f0';
const TT_POS = '#16a34a';
const TT_NEG = '#dc2626';

function colorDot(color: string): string {
  return `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;flex-shrink:0;vertical-align:middle;"></span>`;
}

export function buildLineChart(
  chart: Chart,
  style: any = null,
  xAxisIndex: number,
  yAxisIndex: number,
) {
  const result: any = {
    ...{
      name: chart.id,
      type: 'line',
      tooltip: {
        formatter: (params: any) => {
          const x = formatDate(params.data.value[0]);

          let change = '';
          if (params.data.content.change) {
            change =
              params.data.content.change > 0
                ? '+' + params.data.content.change.toLocaleString('en-US')
                : params.data.content.change.toLocaleString('en-US');
          }

          const changePercent =
            params.data.content.changePercent != null
              ? params.data.content.changePercent > 0
                ? '+' + params.data.content.changePercent
                : String(params.data.content.changePercent)
              : null;

          const value = params.data.value[1].toLocaleString('en-US');
          const suffix = '';

          const isPositive = params.data.content.change > 0;
          const changeColor = isPositive ? TT_POS : TT_NEG;
          const changeBg = isPositive ? '#f0fdf4' : '#fef2f2';

          const changeHtml = change
            ? `<div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid ${TT_BORDER};">
                <span style="font-size:14px;color:${TT_MUTED};">промяна</span>
                <span style="font-weight:700;color:${changeColor};">${change}${suffix}</span>
                ${changePercent != null ? `<span style="font-size:14px;color:${changeColor};background:${changeBg};padding:1px 6px;border-radius:4px;">${changePercent}%</span>` : ''}
              </div>`
            : '';

          return `<div style="font-family:${TT_FONT};min-width:200px;max-width:380px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:8px;">
              <div style="font-weight:700;color:${TT_TEXT};display:flex;align-items:center;">${params.marker}<span style="margin-left:4px;">${chart.name}</span></div>
              <div style="font-size:14px;color:${TT_MUTED};white-space:nowrap;">${x}</div>
            </div>
            <div style="font-size:20px;font-weight:700;color:${TT_TEXT};letter-spacing:-0.3px;">${value}</div>
            ${changeHtml}
          </div>`;
        },
      },
      symbolSize: 5,
      emphasis: {
        focus: 'series',
        label: {
          show: true,
        },
      },
      data: [],
      xAxisIndex: xAxisIndex,
      yAxisIndex: yAxisIndex,
      label: {
        show: false,
        position: 'top',
        formatter: (params: any) => {
          return new Decimal(params.data.value[1])
            .toDecimalPlaces(1)
            .toNumber()
            .toLocaleString('en-US');
        },
      },
    },
    ...style,
    ...chart?.meta?.style,
  };

  chart.data.forEach((item: any) => {
    result.data.push({
      content: {
        knowledgeId: chart.knowledgeId,
        unit: chart.unit,
        magnitude: chart.magnitude ?? 1,
        change: item?.change,
        changePercent: item?.changePercent,
        date: item.date,
        value: item.value,
      },
      value: [item.date, item.value],
    });
  });

  return result;
}

/**
 * Build Y-axis categories for gantt groups.
 * Groups with overlapping items get multiple category slots (one per lane)
 * so bars keep full height. Returns parallel arrays:
 *   labels  – category strings (name on first row, '\0'+name on continuation rows)
 *   isGroupStart – true for the first category of each group
 */
export function buildGanttCategories(groups: TimelineGantt[]): { labels: string[]; isGroupStart: boolean[] } {
  const labels: string[] = [];
  const isGroupStart: boolean[] = [];
  groups.forEach((group) => {
    const lanes = assignLanes(group.periods);
    const totalLanes = Math.max(...lanes, 0) + 1;
    const label = (group.code ? codeToFlag(group.code) + ' ' : '') + group.name;
    for (let l = 0; l < totalLanes; l++) {
      labels.push(l === 0 ? label : '\0' + label);
      isGroupStart.push(l === 0);
    }
  });
  return { labels, isGroupStart };
}

export function buildGanttChart(groups: TimelineGantt[], index = 0, yOffset = 0, color?: string, styles?: Record<string, TimelineGanttStyleDef>) {
  const data: any[] = [];

  let i = yOffset;
  groups.forEach((group: any) => {
    const lanes = assignLanes(group.periods);
    const totalLanes = Math.max(...lanes, 0) + 1;

    let itemIndex = 0;
    group.periods.forEach((item: any, idx: number) => {
      const range = getRange(item);
      const from = localDate(range[0]);
      const to = range[1] === null ? +new Date() : localDate(range[1]);
      const isOngoing = range[1] === null;

      const resolvedStyle = item.style && styles?.[item.style];
      const baseOpacity = resolvedStyle?.opacity ?? 1;
      const style = { color: resolvedStyle?.color ?? color ?? generateGanttColor(group.name || group.id || '', idx) };

      data.push({
        content: {
          type: 'gantt',
          id: group.id,
          itemType: item.type,
          knowledgeId: group.knowledgeId,
          group: group.name,
          name: item.name,
          description: item?.description,
          comment: item?.comment,
          sources: item.sources,
          period: [range[0], to],
          from: range[0],
          to: to,
          date: item.date,
        },
        name: item.name,
        value: [i + lanes[idx], from, to, item.name, item.flag ? codeToFlag(item.flag) : '', isOngoing ? 1 : 0, itemIndex, 0, 1, 0, baseOpacity],
        itemStyle: style,
      });

      itemIndex++;
    });

    i = i + totalLanes;
  });

  return {
    id: `gantt-${index}`,
    type: 'custom',
    tooltip: {
      formatter: timeRangeLabel,
    },
    renderItem: function (params: any, api: any) {
      const categoryIndex = api.value(0);
      const start = api.coord([api.value(1), categoryIndex]);
      const end = api.coord([api.value(2), categoryIndex]);
      const flag = api.value(4);
      const ongoing = api.value(5) === 1;
      // 0 = normal, 1 = selected, 2 = dimmed (another item is selected)
      const selState = api.value(9);
      const baseOpacity: number = api.value(10) ?? 1;

      const laneHeight = api.size([0, 1])[1] * 0.9;
      const laneY = start[1] - laneHeight / 2;

      const coordSys = {
        x: params.coordSys.x,
        y: params.coordSys.y,
        width: params.coordSys.width,
        height: params.coordSys.height,
      };

      // Narrow dark overlay on the left edge — marks where each item starts
      const accentW = Math.min(4, end[0] - start[0]);
      // Use visible bar start so text always clears the accent even when bar is scrolled in from the left
      const visibleStartX = Math.max(start[0], coordSys.x);

      const label = (flag ? flag + ' ' : '') + api.value(3);
      let labelWidth = textWidthCache.get(label);
      if (labelWidth === undefined) {
        labelWidth = echarts.format.getTextRect(label).width;
        textWidthCache.set(label, labelWidth);
      }
      const fontSize = 14;
      const text =
        end[0] - visibleStartX > labelWidth + accentW + 16 && end[0] >= 180 && laneHeight >= MIN_LANE_HEIGHT_FOR_LABEL
          ? label
          : '';

      // Split bar at current date: past portion = normal style, future portion = low opacity
      const nowX = api.coord([Date.now(), categoryIndex])[0];
      const splitX = Math.min(Math.max(nowX, start[0]), end[0]);
      const hasPast = splitX > start[0];
      const hasFuture = splitX < end[0];

      const mainColor = api.visual('color');

      const pastShape = hasPast
        ? echarts.graphic.clipRectByRect(
            { x: start[0], y: laneY, width: splitX - start[0], height: laneHeight },
            coordSys,
          )
        : null;

      const futureShape = hasFuture
        ? echarts.graphic.clipRectByRect(
            { x: splitX, y: laneY, width: end[0] - splitX, height: laneHeight },
            coordSys,
          )
        : null;

      const accentShape = echarts.graphic.clipRectByRect(
        {
          x: start[0],
          y: laneY,
          width: accentW,
          height: laneHeight,
        },
        coordSys,
      );

      const textX = visibleStartX + accentW + 6;
      const textY = laneY + laneHeight / 2;

      const pastR: any = hasFuture ? [3, 0, 0, 3] : (ongoing ? [3, 0, 0, 3] : [3, 3, 3, 3]);
      const futureR: any = hasPast ? [0, 3, 3, 0] : [3, 3, 3, 3];

      const pastOpacity = selState === 1 ? 0.92 : selState === 2 ? 0.18 * baseOpacity : 0.8 * baseOpacity;
      const futureOpacity = selState === 1 ? 0.5 : selState === 2 ? 0.06 * baseOpacity : 0.22 * baseOpacity;
      const pastStroke = selState === 1 ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.22)';
      const futureStroke = selState === 1 ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)';
      const darkText = needsDarkText(mainColor, pastOpacity);
      const hoverPastOpacity = Math.min(pastOpacity + 0.15, 1);
      const hoverFutureOpacity = Math.min(futureOpacity + 0.15, 1);
      const hoverDarkText = needsDarkText(mainColor, hoverPastOpacity);

      return (pastShape || futureShape) && {
        type: 'group',
        children: [
          // Past portion (normal color)
          pastShape && {
            type: 'rect',

            shape: { ...pastShape, r: pastR },
            style: {
              fill: mainColor,
              stroke: pastStroke,
              lineWidth: 1,
              opacity: pastOpacity,
            },
            emphasis: {
              style: {
                opacity: hoverPastOpacity,
                stroke: 'rgba(0,0,0,0.5)',
                lineWidth: 1,
              },
            },
          },
          // Future portion (low opacity to indicate it hasn't happened yet)
          futureShape && {
            type: 'rect',

            shape: { ...futureShape, r: futureR },
            style: {
              fill: mainColor,
              stroke: futureStroke,
              lineWidth: 1,
              opacity: futureOpacity,
            },
            emphasis: {
              style: {
                opacity: hoverFutureOpacity,
                stroke: 'rgba(0,0,0,0.3)',
                lineWidth: 1,
              },
            },
          },
          // Left-edge accent: dark overlay that clearly marks each item's start
          accentShape && {
            type: 'rect',
            shape: { ...accentShape, r: [3, 0, 0, 3] },
            style: {
              fill: selState === 2 ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.25)',
            },
            emphasis: {
              style: {
                fill: 'rgba(0,0,0,0.4)',
              },
            },
          },
          text
            ? {
                type: 'text',
                style: {
                  text: text,
                  x: textX,
                  y: textY,
                  fill: selState === 2
                    ? (darkText ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.4)')
                    : (darkText ? '#1e293b' : '#FFF'),
                  fontFamily: 'Sofia Sans',
                  fontSize: fontSize,
                  textAlign: 'left',
                  textVerticalAlign: 'middle',
                  width: Math.max(0, end[0] - textX - 6),
                  overflow: 'truncate',
                },
                emphasis: {
                  style: {
                    fill: hoverDarkText ? '#1e293b' : '#FFF',
                  },
                },
              }
            : null,
        ].filter(Boolean),
      };
    },
    itemStyle: {
      opacity: 0.85,
    },
    encode: {
      x: [1, 2],
      y: 0,
    },
    data: data,
    xAxisIndex: index,
    yAxisIndex: index,
  };
}

export function buildMarkArea(areas: TimelineArea, showLabels: boolean, axisIndex = 0, style: any, contentType?: string) {
  const data: any = [];
  const markLineData: any = [];
  const baseColor = resolveBaseColor(style);
  const lineColor = toLineColor(baseColor);

  areas.periods.forEach((item: any) => {
    const [rangeFrom, rangeTo] = getRange(item);
    const from = localDate(rangeFrom);
    const to = rangeTo === null ? +new Date() : localDate(rangeTo);
    const displayTo = adjustSingleDayEnd(from, to);

    data.push([
      {
        ...{
          content: ganttContent(areas.id, item, rangeFrom, to, rangeTo, contentType),
          name: item.name,
          description: item.description,
          xAxis: from,
        },
        ...(style?.color != null ? { itemStyle: { color: style.color } } : {}),
      },
      {
        xAxis: displayTo,
      },
    ]);

    markLineData.push({
      xAxis: from,
      name: item.name,
      label: { show: false },
      lineStyle: { color: lineColor, type: 'solid', width: 1 },
    });

    if (rangeTo !== null) {
      markLineData.push({
        xAxis: displayTo,
        name: item.name,
        label: { show: false },
        lineStyle: { color: lineColor, type: 'solid', width: 1 },
      });
    }
  });

  const result: any = {
    id: `event-area-${areas.id}`,
    type: 'line',
    name: areas.id,
    z: 4,
    emphasis: {
      focus: 'none',
    },
    markArea: {
      silent: false,
      label: {
        show: false,
      },
      tooltip: {
        formatter: timeRangeLabel,
      },
      data: data,
      emphasis: {
        disabled: false,
      },
    },
    markLine: {
      data: markLineData,
      animation: false,
      symbol: 'none',
      silent: true,
      emphasis: { disabled: true },
    },
    xAxisIndex: axisIndex,
    yAxisIndex: axisIndex,
  };

  return result;
}

/**
 * For single-day events whose mark area is too narrow to click at far zoom,
 * generate a clickable vertical line (like dates.json lines) at the start date.
 */
export function buildSingleDayEventLines(eventDatasets: TimelineAreaDataset[], axisIndex = 0): any[] {
  const series: any[] = [];
  for (const dataset of eventDatasets) {
    for (const area of dataset.data) {
      const lineColor = toLineColor(resolveBaseColor(area.style ?? area.meta?.style));

      for (const item of area.periods) {
        const [rangeFrom, rangeTo] = getRange(item);
        const from = localDate(rangeFrom);
        const to = rangeTo === null ? +new Date() : localDate(rangeTo);
        if (from !== to) continue;

        series.push({
          id: `markline-${area.id}`,
          type: 'line',
          name: area.id,
          data: [],
          markLine: {
            data: [{
              name: item.name,
              xAxis: from,
              label: { show: false },
              content: ganttContent(area.id, item, rangeFrom, to, rangeTo, dataset.content),
              lineStyle: { color: lineColor, type: 'solid', width: 2 },
            }],
            tooltip: { formatter: timeRangeLabel },
            silent: false,
            animation: false,
            symbol: 'none',
          },
          xAxisIndex: axisIndex,
          yAxisIndex: axisIndex,
        });
      }
    }
  }
  return series;
}

export function buildMarkLine(
  line: TimelineLine,
  xAxisIndex = 0,
  yAxisIndex = 0,
) {
  let axis: any = {};

  if (line.date) {
    // Pass numeric timestamp so ECharts skips its parseDate string path,
    // which mishandles years < 100 (new Date(1,0,1) → 1901).
    axis.xAxis = line.date.dateYear != null && line.date.dateYear < 100 && line.date.date
      ? localDate(line.date.date)
      : line.date.date;
  }

  const markData = {
    name: line.name,
    label: { show: false },
    content: {
      type: 'line',
      id: line.id,
      name: line.name,
      sources: line.sources,
      description: line.description,
      date: line.date,
      from: line.date?.date,
    },
    ...axis,
    lineStyle: { type: 'solid', width: 2, ...line.lineStyle, ...(line.color ? { color: line.color } : {}) },
  };

  const seriesColor = line.color ?? line.lineStyle?.color;
  return {
    id: `markline-${line.id}`,
    type: 'line',
    name: line.name,
    data: [],
    visible: false,
    markLine: {
      data: [markData],
      visible: false,
      tooltip: { formatter: timeRangeLabel },
      silent: false,
      animation: false,
      symbol: 'none',
      emphasis: { disabled: true },
    },
    xAxisIndex,
    yAxisIndex,
    ...(seriesColor ? { color: seriesColor } : {}),
  };
}

export function buildCountryHighlightLine(axisIndex = 0) {
  return {
    id: `country-highlight-${axisIndex}`,
    type: 'line',
    name: `country-highlight-${axisIndex}`,
    data: [[new Date('1995-01-01').getTime()]],
    symbol: 'none',
    lineStyle: { width: 0 },
    label: { show: false },
    markLine: {
      data: [],
      silent: false,
      animation: false,
      symbol: 'none',
      blur: { lineStyle: { opacity: 1 } },
    },
    xAxisIndex: axisIndex,
    yAxisIndex: axisIndex,
  };
}

export function buildCurrentDateLine(axisIndex = 0) {
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const m = moment();
  const BG_MONTHS = ['януари','февруари','март','април','май','юни','юли','август','септември','октомври','ноември','декември'];
  const today = `📅 днес, ${m.date()} ${BG_MONTHS[m.month()]} ${m.year()}`;

  const result: any = {
    id: 'current-date-line',
    type: 'line',
    data: [[currentDate.getTime()]],
    markLine: {
      data: [
        {
          xAxis: currentDate.getTime(),
          lineStyle: {
            color: '#00e633',
            type: 'solid',
            width: 3,
          },
          label: {
            show: false,
          },
        },
      ],
      tooltip: {
        formatter: today,
      },
      silent: false,
      animation: false,
      symbol: 'none',
    },
    xAxisIndex: axisIndex,
    yAxisIndex: axisIndex,
  };

  return result;
}

export function buildEventsCategories(datasets: TimelineAreaDataset[]): { labels: string[]; isGroupStart: boolean[]; totalLanes: number; datasetOffsets: number[]; sectionBoundaries: number[] } {
  const labels: string[] = [];
  const isGroupStart: boolean[] = [];
  const datasetOffsets: number[] = [];
  const sectionBoundaries: number[] = [];
  let datasetCount = 0;

  datasets.forEach(dataset => {
    const items = dataset.data.filter(a => a.meta?.visible !== false).flatMap(a => a.periods);
    if (items.length === 0) {
      datasetOffsets.push(labels.length);
      return;
    }
    const hasSpacer = datasetCount > 0;
    if (hasSpacer) {
      sectionBoundaries.push(labels.length);
      labels.push(' ');
      isGroupStart.push(false);
    }
    datasetOffsets.push(labels.length);
    datasetCount++;
    const lanes = assignLanes(items);
    const totalLanes = Math.max(...lanes, 0) + 1;
    for (let l = 0; l < totalLanes; l++) {
      labels.push(l === 0 ? dataset.name : '\0' + dataset.name);
      isGroupStart.push(l === 0);
    }
  });

  return { labels, isGroupStart, totalLanes: labels.length, datasetOffsets, sectionBoundaries };
}

export function buildEventsRow(areas: TimelineArea[], yRow = 0, axisIndex = 0, index = 0, activeEvents?: Record<string, boolean>, contentType?: string) {
  const data: any[] = [];

  const flatItems: { item: any; area: TimelineArea }[] = [];
  areas.filter((a) => a.meta?.visible !== false).forEach((area: TimelineArea) => {
    area.periods.forEach((item: any) => {
      flatItems.push({ item, area });
    });
  });

  const lanes = assignLanes(flatItems.map(fi => fi.item));

  flatItems.forEach(({ item, area }, idx) => {
    const baseColor = resolveBaseColor(area.style ?? area.meta?.style, 'rgba(128,128,128,0.3)');
    const fillColor = baseColor.replace(/,\s*[\d.]+\)$/, ', 0.75)');

    const [rangeFrom, rangeTo] = getRange(item);
    const from = localDate(rangeFrom);
    const rawTo = rangeTo === null ? +new Date() : localDate(rangeTo);
    const to = adjustSingleDayEnd(from, rawTo);

    data.push({
      name: item.name,
      value: [yRow + lanes[idx], from, to, item.name, activeEvents?.[area.id] ? 1 : 0, 0],
      itemStyle: { color: fillColor },
      content: {
        type: 'gantt',
        id: area.id,
        eventId: area.id,
        tags: area.tags ?? [],
        name: item.name,
        description: item.description,
        comment: item.comment,
        from: rangeFrom,
        to: to,
        date: item.date,
        sources: item.sources ?? [],
        contentType,
      },
    });
  });

  return {
    id: `events-strip-${index}`,
    type: 'custom',
    tooltip: { formatter: timeRangeLabel },
    renderItem: function (params: any, api: any) {
      const categoryIndex = api.value(0);
      const start = api.coord([api.value(1), categoryIndex]);
      const end = api.coord([api.value(2), categoryIndex]);
      const rowHeight = api.size([0, 1])[1];
      const height = rowHeight * 0.9;
      const centerY = start[1];
      const label = api.value(3);
      const isActive = api.value(4) === 1;
      const isDimmed = api.value(5) === 1;

      const coordSys = {
        x: params.coordSys.x,
        y: params.coordSys.y,
        width: params.coordSys.width,
        height: params.coordSys.height,
      };

      const MIN_BAR_WIDTH = 5;
      const barWidth = Math.max(end[0] - start[0], MIN_BAR_WIDTH);
      const rectShape = echarts.graphic.clipRectByRect(
        { x: start[0], y: centerY - height / 2, width: barWidth, height },
        coordSys,
      );

      if (!rectShape) return null;

      let labelWidth = textWidthCache.get(label);
      if (labelWidth === undefined) {
        labelWidth = echarts.format.getTextRect(label).width;
        textWidthCache.set(label, labelWidth);
      }

      const dimOpacity = isDimmed ? 0.1 : 1;

      return {
        type: 'group',
        children: [
          {
            type: 'rect',
            shape: { ...rectShape, r: isActive || barWidth <= MIN_BAR_WIDTH ? 0 : [3, 3, 3, 3] },
            style: { fill: api.visual('color'), stroke: 'rgba(0,0,0,0.2)', lineWidth: 1, opacity: dimOpacity },
            emphasis: isDimmed ? { style: { opacity: 0.7 } } : undefined,
          },
          rectShape.width > labelWidth + 16
            ? {
                type: 'text',
                style: {
                  text: label,
                  x: rectShape.x + rectShape.width / 2,
                  y: centerY,
                  textAlign: 'center',
                  textVerticalAlign: 'middle',
                  fill: '#fff',
                  fontSize: 14,
                  fontFamily: 'Sofia Sans',
                  fontWeight: 'normal',
                  opacity: dimOpacity,
                },
                emphasis: isDimmed ? { style: { opacity: 0.7 } } : undefined,
              }
            : null,
          isActive
            ? {
                type: 'rect',
                shape: { x: rectShape.x, y: rectShape.y, width: Math.min(10, rectShape.width / 2), height: rectShape.height },
                style: {
                  fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: 'rgba(0,0,0,1)' },
                    { offset: 1, color: 'rgba(0,0,0,0)' },
                  ]),
                },
                silent: true,
                z2: 10,
              }
            : null,
          isActive
            ? {
                type: 'rect',
                shape: { x: rectShape.x + rectShape.width - Math.min(10, rectShape.width / 2), y: rectShape.y, width: Math.min(10, rectShape.width / 2), height: rectShape.height },
                style: {
                  fill: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                    { offset: 0, color: 'rgba(0,0,0,0)' },
                    { offset: 1, color: 'rgba(0,0,0,1)' },
                  ]),
                },
                silent: true,
                z2: 10,
              }
            : null,
        ].filter(Boolean),
      };
    },
    encode: { x: [1, 2], y: 0 },
    data,
    xAxisIndex: axisIndex,
    yAxisIndex: axisIndex,
  };
}

function tooltipCard(opts: {
  fill: string;
  name: string;
  dateLabel: string;
  description?: string;
  comment?: string;
  tags?: string[];
  sources?: any[];
  footerHtml: string;
}): string {
  const descHtml = opts.description
    ? `<div style="color:${TT_TEXT};font-size:14px;margin-top:12px;">${opts.description}</div>`
    : '';

  const tagsHtml = opts.tags?.length
    ? `<div style="border-top:1px solid ${TT_BORDER};margin-top:8px;padding-top:8px;">${opts.tags.map(t => `<span style="display:inline-block;padding:2px 10px;margin:2px 4px 2px 0;font-size:14px;border-radius:10px;background:${TT_BORDER};color:${TT_TEXT};">${t}</span>`).join('')}</div>`
    : '';

  const commentHtml = opts.comment
    ? `<div style="color:${TT_MUTED};font-size:14px;font-style:italic;margin-top:8px;">${opts.comment}</div>`
    : '';

  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max) + '…' : s;
  const source = opts.sources?.[0];
  let sourceHtml = '';
  if (source) {
    const quoteHtml = source.quote
      ? `<div style="font-size:16px;color:${TT_TEXT};font-style:italic;margin-top:6px;">"${truncate(source.quote, 200)}"</div>`
      : '';
    const quoteOriginalHtml = source.quoteOriginal
      ? `<div style="font-size:14px;color:${TT_MUTED};font-style:italic;margin-top:2px;">"${truncate(source.quoteOriginal, 200)}"</div>`
      : '';
    const sourceNameHtml = source.name
      ? `<div style="font-size:14px;color:${TT_MUTED};margin-top:4px;">— ${source.name}</div>`
      : '';
    const sourceCommentHtml = source.comment
      ? `<div style="font-size:14px;color:#d97706;font-style:italic;margin-top:2px;">${source.comment}</div>`
      : '';
    sourceHtml = `<div style="border-top:1px solid ${TT_BORDER};margin-top:8px;padding-top:8px;">${quoteHtml}${quoteOriginalHtml}${sourceCommentHtml}${sourceNameHtml}</div>`;
  }

  return `<div style="font-family:${TT_FONT};max-width:480px;white-space:normal;word-wrap:break-word;">
    <div style="display:flex;align-items:center;font-weight:700;color:${TT_TEXT};margin-bottom:6px;">
      ${colorDot(opts.fill)}<span>${opts.name}</span>
    </div>
    <div style="font-weight:600;color:${TT_TEXT};">${opts.dateLabel}</div>
    ${descHtml}${commentHtml}
    ${sourceHtml}
    <div style="border-top:1px solid ${TT_BORDER};margin-top:8px;padding-top:8px;">
      ${opts.footerHtml}
    </div>
    ${tagsHtml}
  </div>`;
}

export function timeRangeLabel(params: any) {
  if (params.data.content?.type === 'gantt') {
    const c = params.data.content;
    const precision = getCoarsestPrecision(c.date?.from, c.date?.to);
    const diff = formatDateDiff(c.from, c.to, precision);

    let fill = '#3b82f6';
    if (params.data.itemStyle?.color) fill = params.data.itemStyle.color;
    else if (params.color) fill = params.color;

    const dateLabel = c.date
      ? formatTimelineDate(c.date)
      : c.to
        ? `${formatDate(c.from)} — ${formatDate(c.to)}`
        : `${formatDate(c.from)} — до днес`;

    const sign = c.contentType === 'persons' ? getStarSign(c.date?.from) : '';
    const signHtml = sign
      ? ` <span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:14px;background:#f5f3ff;color:#7c3aed;border:1px solid #ede9fe;margin-left:6px;">${sign}</span>`
      : '';

    return tooltipCard({
      fill,
      name: params.name,
      dateLabel: dateLabel + signHtml,
      description: c.description,
      comment: c.comment,
      tags: c.tags,
      sources: c.sources,
      footerHtml: `<div style="font-size:14px;color:${TT_MUTED};margin-top:2px;">${diff}</div>${toNow(c.from, c.to, getDatePrecision(c.date?.from), getDatePrecision(c.date?.to))}`,
    });
  }

  if (params.data.content?.type === 'line') {
    const c = params.data.content;
    const fill = params.data?.lineStyle?.color ?? params.color ?? '#64748b';

    const isPast = c.from && new Date(c.from) < new Date();
    const dateLabel = c.date
      ? (isPast ? '' : 'около ') + formatSourceDate(c.date)
      : '';
    const linePrecision = getDatePrecision(c.date);
    const diffText = c.from
      ? isPast
        ? `${formatDateDiff(c.from, new Date().getTime(), linePrecision)} до днес`
        : `след около ${formatDateDiff(new Date().getTime(), c.from, linePrecision)}`
      : '';

    return tooltipCard({
      fill,
      name: c.name,
      dateLabel,
      description: c.description,
      sources: c.sources,
      footerHtml: `<div style="font-size:14px;color:${TT_MUTED};margin-top:2px;">${diffText}</div>`,
    });
  }

  if (params?.data?.description !== undefined) {
    const diffToNow = formatDateDiff(params.data.value?.[0], new Date().getTime());
    return `<div style="font-family:${TT_FONT};max-width:300px;white-space:normal;">
      <div style="color:${TT_TEXT};">${params.data.description}</div>
      <div style="color:${TT_MUTED};font-size:14px;margin-top:6px;">${diffToNow} до днес</div>
    </div>`;
  }

  if (params.value === undefined) {
    return '';
  }

  const date = formatDate(params.data.value[0]);
  const value = params.value[1].toLocaleString('en-US');
  const diffToNow = formatDateDiff(params.data.value[0], new Date().getTime());
  const color = params.color ?? '#3b82f6';

  let seriesDisplay = `${colorDot(color)}<span style="font-weight:700;">${params.seriesName}</span>`;
  if (params.data.content.name && params.data.content.name !== params.seriesName) {
    seriesDisplay += ` <span style="color:${TT_MUTED};">(${params.data.content.name})</span>`;
  }

  let diffText = '';
  if (params.data.content?.diff && params.data.content.diff !== params.value[1]) {
    const sign = params.data.content.diff > 0 ? '+' : '';
    diffText = ` <span style="color:${TT_MUTED};font-size:14px;">(${sign}${params.data.content.diff.toLocaleString('en-US')})</span>`;
  }

  return `<div style="font-family:${TT_FONT};max-width:300px;">
    <div style="display:flex;align-items:center;margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid ${TT_BORDER};">
      ${seriesDisplay}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
      <div style="font-weight:600;color:${TT_TEXT};">${date}</div>
      <div style="font-size:18px;font-weight:700;color:${TT_TEXT};">${value}${diffText}</div>
    </div>
    <div style="font-size:14px;color:${TT_MUTED};margin-top:6px;">${diffToNow} до днес</div>
  </div>`;
}

function toNow(from: string, to: string, fromPrecision: DatePrecision = 'day', toPrecision: DatePrecision = 'day'): string {
  const diffStartToNow = formatDateDiff(from, new Date().getTime(), fromPrecision);
  const diffEndToNow = formatDateDiff(to, new Date().getTime(), toPrecision);

  if (diffEndToNow.length > 0) {
    return `<div style="color:${TT_MUTED};font-size:14px;margin-top:4px;">${diffStartToNow} от началото до днес</div>
    <div style="color:${TT_MUTED};font-size:14px;margin-top:2px;">${diffEndToNow} от края до днес</div>`;
  }

  return '';
}
