export interface ChartSource {
  name: string;
  url: string[];
  referenceMetadata?: string;
  quote?: string;
  quoteOriginal?: string;
  comment?: string;
}

export interface LocalizedText {
  bg: string;
  en: string;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  change: number;
  changePercent: number;
  status?: string;
}

export interface ChartMeta {
  convertMagnitude?: boolean;
  style?: Record<string, any>;
}

/**
 * Flattened chart: one per metric+country combination.
 * Built from ChartMetric[] at load time for consumption by the chart pipeline.
 */
export interface Chart {
  id: string;
  name: string;
  chart: string;
  country: string;
  countryCode: string;
  unit: string;
  sources: ChartSource[];
  data: ChartDataPoint[];
  group: string;
  title?: LocalizedText;
  description?: LocalizedText;
  shortName?: string;
  meta?: ChartMeta;
  magnitude?: number;
  knowledgeId?: string;
}
