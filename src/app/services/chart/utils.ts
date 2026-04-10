import {
  buildGanttChart,
  buildLineChart,
  buildMarkArea,
  buildMarkLine,
  buildSingleDayEventLines,
  buildCurrentDateLine,
  buildCountryHighlightLine,
  buildEventsRow,
  buildEventsCategories,
  getRange,
} from './series';
import { Chart } from '../../models/chart';
import { TimelineAreaDataset, TimelineGantt, TimelineGanttDatasetMetadata, TimelineLine } from '../../models/timeline';
import { ganttYOffset } from './section-separators';

/**
 * Derive X-axis year range from gantt, event, and vertical-line data.
 * fromYear is padded 10 years before the earliest date; toYear 10 years after the latest line.
 */
export function computeXAxisRange(
  gantt: TimelineGantt[],
  eventDatasets: TimelineAreaDataset[],
  verticalLine: TimelineLine[],
): { fromYear: number; toYear: number | undefined } {
  let fromYear = Infinity;

  for (const group of gantt) {
    for (const item of group.periods) {
      const dateStr = getRange(item)[0];
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (year < fromYear) fromYear = year;
      }
    }
  }

  for (const event of eventDatasets.flatMap(d => d.data)) {
    for (const eventItem of event.periods) {
      const dateStr = (eventItem as any).date.range[0];
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (year < fromYear) fromYear = year;
      }
    }
  }

  for (const line of verticalLine) {
    if (line.date?.date) {
      const year = new Date(line.date.date).getFullYear();
      if (year < fromYear) fromYear = year;
    }
  }

  fromYear = (isFinite(fromYear) ? fromYear : new Date().getFullYear()) - 10;

  let latestYear = -Infinity;
  for (const line of verticalLine) {
    if (line.date?.date) {
      const year = new Date(line.date.date).getFullYear();
      if (year > latestYear) latestYear = year;
    }
  }
  for (const group of gantt) {
    for (const item of group.periods) {
      const endStr = getRange(item)[1];
      const year = endStr ? new Date(endStr).getFullYear() : new Date().getFullYear();
      if (year > latestYear) latestYear = year;
    }
  }

  return {
    fromYear,
    toYear: isFinite(latestYear) ? Math.max(latestYear, new Date().getFullYear()) + 10 : undefined,
  };
}

export function buildSeries(
  eventDatasets: TimelineAreaDataset[],
  gantt: TimelineGantt[],
  charts: Chart[],
  verticalLine: TimelineLine[],
  ganttMeta?: TimelineGanttDatasetMetadata,
  activeEvents?: Record<string, boolean>,
) {
  const series: any = [];

  series.push(buildCurrentDateLine());
  series.push(buildCountryHighlightLine(0));

  eventDatasets.forEach(d => {
    d.data.forEach((item: any) => {
      series.push(buildMarkArea(item, true, 0, item.style ?? item.meta?.style, d.content));
    });
  });

  series.push(...buildSingleDayEventLines(eventDatasets, 0));

  verticalLine.forEach((line) => {
    series.push(buildMarkLine(line, 0, 0));
  });

  charts.forEach((chart: any) => {
    series.push(buildLineChart(chart, null, 0, 0));
  });

  const eventCats = buildEventsCategories(eventDatasets);
  eventDatasets.forEach((dataset, idx) => {
    series.push(buildEventsRow(dataset.data, eventCats.datasetOffsets[idx], 0, idx, activeEvents, dataset.content));
  });
  series.push(buildGanttChart(gantt, 0, ganttYOffset(eventCats.totalLanes, gantt.length > 0), ganttMeta?.color, ganttMeta?.styles));

  return series;
}
