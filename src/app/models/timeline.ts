import { ChartSource } from './chart';

export interface SourceDate {
  dateYear?: number;
  dateMonth?: number;
  date?: string;
}

export interface TimelineSource extends ChartSource {
  date?: string;
  from?: SourceDate;
  to?: SourceDate;
}

export interface TimelineColorStop {
  offset: number;
  color: string;
}

export interface TimelineLinearGradient {
  type: 'linear';
  x: number;
  y: number;
  x2: number;
  y2: number;
  colorStops: TimelineColorStop[];
}

export type TimelineColor = string | TimelineLinearGradient;

export interface TimelineStyle {
  color?: TimelineColor;
}

export interface TimelineMeta {
  style?: TimelineStyle;
  visible?: boolean;
}

export interface TimelineGanttItem extends TimelineAreaItem {
  type?: string;
  flag?: string;
  style?: string;
  meta?: TimelineMeta;
}

export interface TimelineGantt {
  name: string;
  /** UUID v4 */
  id: string;
  code?: string;
  description?: string;
  datasets?: string[];
  periods: TimelineGanttItem[];
  knowledgeId?: string;
}

export interface TimelineGanttStyleDef {
  opacity?: number;
  color?: string;
}

export interface TimelineGanttDatasetMetadata {
  color?: string;
  styles?: Record<string, TimelineGanttStyleDef>;
  resetZoom?: boolean;
}

export interface TimelineGanttDataset {
  id: string;
  name: string;
  description?: string;
  knowledge?: string;
  metadata?: TimelineGanttDatasetMetadata;
  data: TimelineGantt[];
  lines?: TimelineLine[];
}

export interface TimelineAreaDate {
  range: [string, string | null];
  from?: SourceDate;
  to?: SourceDate;
}

export interface TimelineAreaItem {
  name: string;
  description?: string;
  comment?: string;
  date: TimelineAreaDate;
  sources?: TimelineSource[];
}

export interface TimelineArea {
  /** UUID v4 */
  id: string;
  datasets?: string[];
  tags?: string[];
  meta?: TimelineMeta;
  style?: TimelineStyle;
  periods: TimelineAreaItem[];
}

export interface TimelineAreaDataset {
  name: string;
  type: string;
  content?: string;
  data: TimelineArea[];
}

export interface ManifestEntry {
  file: string;
  datasets?: string[];
}

export interface TimelineLine {
  /** UUID v4 */
  id: string;
  name: string;
  description?: string;
  date?: SourceDate;
  datasets?: string[];
  tags?: string[];
  color?: string;
  lineStyle?: { color?: string; type?: string; width?: number };
  sources?: TimelineSource[];
}

export interface TimelineLineDataset {
  id: string;
  type: string;
  name: string;
  metadata?: Record<string, unknown>;
  data: TimelineLine[];
}

