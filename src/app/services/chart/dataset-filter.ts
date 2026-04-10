import { ManifestEntry, TimelineArea, TimelineAreaDataset, TimelineGantt, TimelineGanttDataset, TimelineGanttDatasetMetadata, TimelineLine } from '../../models/timeline';

export interface EventGroup {
  name: string;
  tags: string[];
  events: { id: string; name: string; tags: string[] }[];
}

export interface LineItem {
  key: string;
  name: string;
  legendName: string;
  tags: string[];
}

export function isItemVisibleForDataset(
  item: { datasets?: string[] },
  fileDatasets: string[] | undefined,
  activeDataset: string,
): boolean {
  const ds = item.datasets ?? fileDatasets;
  return !ds || ds.includes(activeDataset);
}

export function getFileDatasets(manifest: ManifestEntry[], file: string): string[] | undefined {
  return manifest.find(e => e.file === file)?.datasets;
}

export function getGanttDataForDataset(
  allGanttDatasets: Map<string, TimelineGanttDataset>,
  datasetId: string,
  primary: TimelineGantt[],
  primaryMeta?: TimelineGanttDatasetMetadata,
): { data: TimelineGantt[]; metadata?: TimelineGanttDatasetMetadata } {
  const extra: TimelineGantt[] = [];
  const mergedStyles: Record<string, any> = { ...primaryMeta?.styles };
  allGanttDatasets.forEach((ds, id) => {
    if (id === datasetId) return;
    const items = ds.data.filter(item => item.datasets?.includes(datasetId));
    if (items.length) {
      extra.push(...items);
      Object.assign(mergedStyles, ds.metadata?.styles);
    }
  });
  if (!extra.length) return { data: primary, metadata: primaryMeta };
  return {
    data: [...extra, ...primary],
    metadata: { ...primaryMeta, styles: mergedStyles },
  };
}

export function extractEmbeddedLines(
  ganttDatasets: Map<string, TimelineGanttDataset>,
): TimelineLine[] {
  const result: TimelineLine[] = [];
  ganttDatasets.forEach((ds, id) => {
    if (ds.lines?.length) {
      for (const line of ds.lines) {
        result.push(line.datasets ? line : { ...line, datasets: [id] });
      }
    }
  });
  return result;
}

export function rebuildEventGroups(
  eventDatasets: TimelineAreaDataset[],
  eventFileMap: Map<TimelineAreaDataset, string>,
  manifest: ManifestEntry[],
  activeDataset: string,
): EventGroup[] {
  return eventDatasets.map(d => {
    const fileDs = getFileDatasets(manifest, eventFileMap.get(d) ?? '');
    const visible = d.data.filter(item => isItemVisibleForDataset(item, fileDs, activeDataset));
    const events = visible.map((item: TimelineArea) => ({
      id: item.id,
      name: item.periods[0]?.name ?? item.id,
      tags: item.tags ?? [],
    })).sort((a, b) => a.name.localeCompare(b.name, 'bg'));
    const tags = [...new Set(events.flatMap(e => e.tags))].sort();
    return { name: d.name, tags, events };
  }).filter(g => g.events.length > 0);
}

export function rebuildLineItems(
  verticalLine: TimelineLine[],
  manifest: ManifestEntry[],
  activeDataset: string,
): LineItem[] {
  const lineFileDs = getFileDatasets(manifest, 'dates.json');
  return verticalLine
    .filter(item => isItemVisibleForDataset(item, lineFileDs, activeDataset))
    .map(line => ({ key: line.id, name: line.name, legendName: line.name, tags: line.tags ?? [] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'bg'));
}

export function applyDefaults(
  defaults: Record<string, { events: string[]; lines: string[] }>,
  activeDataset: string,
  activeEvents: Record<string, boolean>,
  lineItems: LineItem[],
  activeLines: Record<string, boolean>,
): void {
  const global = defaults['_global'];
  const perDataset = defaults[activeDataset];
  const eventIds = new Set([...(global?.events ?? []), ...(perDataset?.events ?? [])]);
  const lineKeys = new Set([...(global?.lines ?? []), ...(perDataset?.lines ?? [])]);
  Object.keys(activeEvents).forEach(id => {
    activeEvents[id] = eventIds.has(id);
  });
  lineItems.forEach(({ key }) => {
    activeLines[key] = lineKeys.has(key);
  });
}
