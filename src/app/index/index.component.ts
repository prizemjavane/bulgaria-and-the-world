import { afterNextRender, ChangeDetectorRef, Component, DestroyRef, ElementRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, CustomChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
import { ECharts } from 'echarts';
import { DataService } from '../services/data.service';
import { forkJoin, map, switchMap } from 'rxjs';
import { buildSeries, computeXAxisRange } from '../services/chart/utils';
import { buildGanttCategories, buildEventsCategories, getRange } from '../services/chart/series';
import { buildEventsStripActiveUpdates, buildTagDimmingUpdates } from '../services/chart/highlights';
import { buildBirthDateSeries, buildDurationDateSeries, buildAgeLabel, buildTodayLabel } from '../services/chart/birth-date';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDot, ClipboardCopy, PanelLeft, PanelRight, Pencil, X } from 'lucide-angular';
import { environment } from '../../environments/environment';
import { CanvasRenderer } from 'echarts/renderers';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { formatDate, formatDateDiff, formatSourceDate, formatTimelineDate, getCoarsestPrecision, getDatePrecision } from '../services/date';
import { ManifestEntry, TimelineArea, TimelineAreaDataset, TimelineGantt, TimelineGanttDataset, TimelineGanttDatasetMetadata, TimelineLine, TimelineLineDataset } from '../models/timeline';
import { ChartSource } from '../models/chart';
import Fuse from 'fuse.js';
echarts.use([
  BarChart,
  GridComponent,
  GraphicComponent,
  CanvasRenderer,
  LegendComponent,
  LineChart,
  CustomChart,
  ToolboxComponent,
  DataZoomComponent,
  TooltipComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TitleComponent,
]);
import moment from 'moment';
import { ActivatedRoute, Router } from '@angular/router';
import { marked } from 'marked';
import { markedConfig } from '../services/markdown';
import { bigTimeChart } from '../services/chart/chart';
import { captureZoom, restoreZoom, cacheAxisRange, syncXAxisStep, zoomToDateRange, panToDate, AxisRange } from '../services/chart/zoom';
import { createSelectionState, highlightGanttItem, clearGanttHighlight, highlightMarkLine, clearMarkLineHighlight, highlightEventMarkLines, clearEventMarkLineHighlight } from '../services/chart/selection';
import { rebuildEventGroups, rebuildLineItems, applyDefaults, isItemVisibleForDataset, getFileDatasets, getGanttDataForDataset, extractEmbeddedLines, EventGroup, LineItem } from '../services/chart/dataset-filter';
import { buildSectionCategories, buildSectionGraphic } from '../services/chart/section-separators';
import { PopoverCombinedComponent, CombinedPopoverTab } from './popover-combined/popover-combined.component';
import { DetailCardBodyComponent, DetailCardItem } from './detail-card-body/detail-card-body.component';

function buildDetailCard(c: any): {
  id?: string; name: string; group?: string; description?: string; comment?: string;
  from: string; to: string; dateRange: string; duration: string; birthDate?: DetailCardItem['birthDate']; sources?: ChartSource[];
} {
  return {
    id: c.id,
    name: c.name,
    group: c.group,
    description: c.description,
    comment: c.comment,
    from: c.from,
    to: c.to,
    dateRange: c.date
      ? formatTimelineDate(c.date)
      : c.to ? `${formatDate(c.from)} — ${formatDate(c.to)}` : `${formatDate(c.from)} — до днес`,
    duration: formatDateDiff(c.from, c.to, getCoarsestPrecision(c.date?.from, c.date?.to)),
    birthDate: c.contentType === 'persons' ? c.date?.from : undefined,
    sources: c.sources,
  };
}

@Component({
  selector: 'app-index',
  imports: [CommonModule, NgxEchartsDirective, FormsModule, ReactiveFormsModule, LucideAngularModule, PopoverCombinedComponent, DetailCardBodyComponent],
  templateUrl: './index.component.html',
  styleUrl: './index.component.css',
  providers: [
    provideEchartsCore({ echarts }),
    { provide: LUCIDE_ICONS, useValue: new LucideIconProvider({ BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, CircleDot, ClipboardCopy, PanelLeft, PanelRight, Pencil, X }), multi: true },
  ],
})
export class IndexComponent implements OnInit {
  public chart!: any;
  public chartInstance!: ECharts;
  public legends: string[] = [];
  public legendMap: Record<string, string> = {};
  public data: {
    timeline: TimelineGantt[];
    verticalLine: TimelineLine[];
    eventDatasets: TimelineAreaDataset[];
  } = {
    timeline: [],
    verticalLine: [],
    eventDatasets: [],
  };

  dateForm = new FormGroup({
    year: new FormControl<number | null>(null),
    month: new FormControl<number>(1),
    duration: new FormControl<number | null>(100),
  });

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private dataService: DataService,
    private cdr: ChangeDetectorRef,
  ) {
    marked.use(markedConfig());
    afterNextRender(() => this.initTabScroll());
  }

  public activeDataset = '';
  private manifest: ManifestEntry[] = [];
  private eventFileMap = new Map<TimelineAreaDataset, string>();
  private standaloneLines: TimelineLine[] = [];
  private datasetFileMap = new Map<string, string>();
  private idFileMap = new Map<string, string>();
  private allGanttDatasets = new Map<string, TimelineGanttDataset>();
  private defaults: Record<string, { events: string[]; lines: string[] }> = {};
  private fuzzySearchThreshold = 0.2;
  private sectionBoundaries: number[] = [];
  private totalCategories = 0;
  public eventGroups: EventGroup[] = [];
  public activeEvents: Record<string, boolean> = {};
  public activeTags: Record<string, boolean> = {};
  public lineItems: LineItem[] = [];
  public activeLines: Record<string, boolean> = {};
  public combinedPopoverOpen = false;
  public popoverSearch = '';
  public globalSearch = '';
  public selectedItem: (DetailCardItem & { from: string; to: string }) | null = null;
  public selectionPanelOpen = false;
  public selPanelSortField: 'name' | 'date' = 'name';
  public selPanelSortDir: 'asc' | 'desc' = 'asc';
  public idCopied = false;
  private selection = createSelectionState();
  private hoveredSeriesIndex: number | null = null;
  private hoveredDataIndex: number | null = null;
  private hasProgrammaticHighlight = false;
  private axisRange: AxisRange = { axisMinMs: 0, axisMaxMs: 0 };


  datasets: { id: string; label: string; description?: string; knowledge?: string }[] = [];
  knowledgeOpen = false;
  knowledgeHtml = signal('');
  private knowledgeLoadedSlug = '';
  infoPanelPosition = signal<'right' | 'bottom'>((localStorage.getItem('infoPanelPosition') as 'right' | 'bottom') ?? 'bottom');
  singleSelectionMode = signal<boolean>(false);

  readonly tabScrollEl = viewChild<ElementRef<HTMLElement>>('tabScroll');
  readonly canScrollLeft = signal(false);
  readonly canScrollRight = signal(false);
  private tabResizeObserver: ResizeObserver | null = null;
  private readonly destroyRef = inject(DestroyRef);

  activeDatasetDescription(): string | undefined {
    return this.datasets.find(d => d.id === this.activeDataset)?.description;
  }

  activeDatasetKnowledge(): string | undefined {
    return this.datasets.find(d => d.id === this.activeDataset)?.knowledge;
  }

  toggleInfoPanelPosition(): void {
    const next = this.infoPanelPosition() === 'right' ? 'bottom' : 'right';
    this.infoPanelPosition.set(next);
    localStorage.setItem('infoPanelPosition', next);
    setTimeout(() => {
      this.chartInstance?.resize();
      this.applySectionSeparators();
    }, 320);
  }

  knowledgeEditUrl(): string {
    return `${environment.githubUrl}/edit/main/public/knowledge-base/${this.knowledgeLoadedSlug}.md`;
  }

  datasetEditUrl(): string {
    return `${environment.githubUrl}/edit/main/public/data/${this.datasetFileMap.get(this.activeDataset)}`;
  }

  itemEditUrl(): string {
    return `${environment.githubUrl}/edit/main/public/data/${this.selectedItem?.file}`;
  }

  copyId(): void {
    if (!this.selectedItem?.id) return;
    navigator.clipboard.writeText(this.selectedItem.id);
    this.idCopied = true;
    setTimeout(() => this.idCopied = false, 1500);
  }

  toggleKnowledge(): void {
    const slug = this.activeDatasetKnowledge();
    if (!slug) return;
    if (this.knowledgeOpen) {
      this.knowledgeOpen = false;
      setTimeout(() => {
        this.chartInstance?.resize();
        this.applySectionSeparators();
      }, 320);
      return;
    }
    if (this.selectedItem) {
      this.selectedItem = null;
      clearGanttHighlight(this.chartInstance, this.selection);
      clearMarkLineHighlight(this.chartInstance, this.selection);
      clearEventMarkLineHighlight(this.chartInstance, this.selection);
    }
    this.knowledgeOpen = true;
    setTimeout(() => {
      this.chartInstance?.resize();
      this.applySectionSeparators();
    }, 320);
    if (this.knowledgeLoadedSlug === slug) return;
    this.knowledgeLoadedSlug = slug;
    this.knowledgeHtml.set('');
    this.dataService.getKnowledge(slug).subscribe({
      next: (md: string) => {
        this.knowledgeHtml.set(marked.parse(md).toString());
      },
      error: () => {
        this.knowledgeHtml.set('<p style="color:#94a3b8;padding:2rem">Съдържанието не може да бъде заредено.</p>');
      },
    });
  }

  ngOnInit(): void {
    this.dataService.getData('manifest.json').pipe(
      switchMap((manifest: ManifestEntry[]) => {
        this.manifest = manifest;
        return forkJoin(manifest.map(entry =>
          this.dataService.getData(entry.file).pipe(map(data => ({ file: entry.file, data })))
        ));
      }),
    ).subscribe({
      next: (results) => {
        const defaultsResult = results.find(r => r.file === 'defaults.json');
        if (defaultsResult) {
          const { fuzzySearchThreshold, infoPanelPosition, singleSelectionMode, ...datasetDefaults } = defaultsResult.data;
          if (fuzzySearchThreshold != null) this.fuzzySearchThreshold = fuzzySearchThreshold;
          if (infoPanelPosition != null && !localStorage.getItem('infoPanelPosition')) this.infoPanelPosition.set(infoPanelPosition);
          if (singleSelectionMode != null) this.singleSelectionMode.set(singleSelectionMode);
          this.defaults = datasetDefaults;
        }

        const ganttResults = results.filter(r => r.data.id && !r.data.type && r.file !== 'defaults.json');
        this.datasets = ganttResults.map(r => ({ id: r.data.id, label: r.data.name, description: r.data.description, knowledge: r.data.knowledge }));
        if (!this.activeDataset && this.datasets.length) {
          const dsParam = this.activatedRoute.snapshot.queryParamMap.get('dataset');
          this.activeDataset = (dsParam && this.datasets.some(d => d.id === dsParam)) ? dsParam : this.datasets[0].id;
        }

        const eventResults = results.filter(r => r.data.type === 'events');
        const eventDatasets = eventResults.map(r => r.data) as TimelineAreaDataset[];
        this.eventFileMap = new Map(eventResults.map(r => [r.data as TimelineAreaDataset, r.file]));
        this.datasetFileMap = new Map(ganttResults.map(r => [r.data.id, r.file]));
        ganttResults.forEach(r => {
          this.allGanttDatasets.set(r.data.id, r.data as TimelineGanttDataset);
          for (const group of r.data.data ?? []) {
            if (group.id) this.idFileMap.set(group.id, r.file);
          }
        });
        eventResults.forEach(r => {
          for (const area of r.data.data ?? []) {
            if (area.id) this.idFileMap.set(area.id, r.file);
          }
        });
        const dataset = results.find(r => r.data.id === this.activeDataset)!.data as TimelineGanttDataset;
        const lineResult = results.find(r => r.data.type === 'lines')!;
        const lineDataset = lineResult.data as TimelineLineDataset;
        this.standaloneLines = lineDataset.data;
        const verticalLine = [...this.standaloneLines, ...extractEmbeddedLines(this.allGanttDatasets)];
        for (const line of verticalLine) {
          if (line.id) this.idFileMap.set(line.id, lineResult.file);
        }

        const merged = getGanttDataForDataset(this.allGanttDatasets, this.activeDataset, dataset.data, dataset.metadata);
        this.data.timeline = merged.data;
        this.data.verticalLine = verticalLine;
        this.data.eventDatasets = eventDatasets;

        eventDatasets.flatMap(d => d.data).forEach((item: TimelineArea) => (this.activeEvents[item.id] = false));
        this.eventGroups = rebuildEventGroups(this.data.eventDatasets, this.eventFileMap, this.manifest, this.activeDataset);
        this.lineItems = rebuildLineItems(this.data.verticalLine, this.manifest, this.activeDataset);
        applyDefaults(this.defaults, this.activeDataset, this.activeEvents, this.lineItems, this.activeLines);

        this.loadChart(eventDatasets, merged.data, merged.metadata);
        this.cdr.detectChanges();
      },
    });

    this.dateForm.valueChanges.subscribe(({ year, month }) => {
      this.applyCustomMarkArea();
      if (year && this.chartInstance) {
        const from = new Date(year, Number(month ?? 1) - 1, 1);
        from.setFullYear(year);
        const dateMs = from.getTime();
        const zoom = captureZoom(this.chartInstance);
        if (!zoom || dateMs < zoom.startValue || dateMs > zoom.endValue) {
          panToDate(this.chartInstance, dateMs);
        }
      }
    });
  }

  loadChart(eventDatasets: TimelineAreaDataset[], gantt: TimelineGantt[], ganttMeta?: TimelineGanttDatasetMetadata): void {
    let legend: any = { data: [], map: {}, selected: {} };

    // Filter events and vertical lines by active dataset
    const filteredEventDatasets: TimelineAreaDataset[] = eventDatasets.map(d => {
      const fileDs = getFileDatasets(this.manifest, this.eventFileMap.get(d) ?? '');
      return { ...d, data: d.data.filter(item => isItemVisibleForDataset(item, fileDs, this.activeDataset)) };
    });

    const lineFileDs = getFileDatasets(this.manifest, 'dates.json');
    const filteredVerticalLine = this.data.verticalLine.filter(item =>
      isItemVisibleForDataset(item, lineFileDs, this.activeDataset),
    );

    filteredEventDatasets.flatMap(d => d.data).forEach((item) => {
      legend.selected[item.id] = this.activeEvents[item.id] ?? false;
    });

    filteredVerticalLine.forEach(line => {
      legend.selected[line.name] = this.activeLines[line.id] ?? false;
    });

    const series = buildSeries(filteredEventDatasets, gantt, [], filteredVerticalLine, ganttMeta, this.activeEvents);

    series.forEach((item: any) => {
      if (item.name && !this.legends.includes(item.name)) {
        this.legends.push(item.name);
      }
    });

    this.legendMap = legend.map;

    const { fromYear, toYear } = computeXAxisRange(gantt, filteredEventDatasets, filteredVerticalLine);

    const eventCats = buildEventsCategories(filteredEventDatasets);
    const ganttCats = buildGanttCategories(gantt);
    const cats = buildSectionCategories(eventCats, ganttCats, gantt);
    this.sectionBoundaries = cats.sectionBoundaries;
    this.totalCategories = cats.totalCategories;
    this.chart = bigTimeChart(
      series,
      { labels: cats.labels, isGroupStart: cats.isGroupStart },
      legend,
      fromYear,
      toYear,
    );
  }

  onChartInit(chart: any): void {
    this.chartInstance = chart;

    setTimeout(() => {
      this.axisRange = cacheAxisRange(this.chartInstance);
      this.applySectionSeparators();

      this.chartInstance.on('mouseover', (e: any) => {
        this.hoveredSeriesIndex = e.seriesIndex;
        this.hoveredDataIndex = e.dataIndex;
      });
      this.chartInstance.on('mouseout', () => {
        if (this.hasProgrammaticHighlight && this.hoveredSeriesIndex != null) {
          this.chartInstance.dispatchAction({
            type: 'downplay',
            seriesIndex: this.hoveredSeriesIndex,
            dataIndex: this.hoveredDataIndex,
          });
          this.hasProgrammaticHighlight = false;
        }
        this.hoveredSeriesIndex = null;
        this.hoveredDataIndex = null;
      });

      syncXAxisStep(this.chartInstance, this.axisRange);

      this.chartInstance.getZr().on('click', (event: any) => {
        if (!event.target && this.selectedItem) {
          this.closeDetailCard();
        }
      });

      const idParam = this.activatedRoute.snapshot.queryParamMap.get('id');
      if (idParam) this.highlightByUuid(idParam);
    }, 10);
  }

  private applySectionSeparators(): void {
    if (!this.chartInstance || this.sectionBoundaries.length === 0) return;
    const graphic = buildSectionGraphic(this.chartInstance, this.sectionBoundaries, this.totalCategories);
    (this.chartInstance as any).setOption({ graphic }, { replaceMerge: ['graphic'] });
  }

  onChartDataZoom(event: any): void {
    const dz = event.batch?.[0] ?? event;
    syncXAxisStep(this.chartInstance, this.axisRange, dz.start ?? 0, dz.end ?? 100);
    // Clear stale emphasis so renderItem re-evaluates text visibility,
    // then re-highlight the hovered item via programmatic highlight
    // (cleared explicitly on mouseout)
    this.chartInstance.dispatchAction({ type: 'hideTip' });
    this.chartInstance.dispatchAction({ type: 'downplay' });
    if (this.hoveredSeriesIndex != null && this.hoveredDataIndex != null) {
      this.chartInstance.dispatchAction({
        type: 'highlight',
        seriesIndex: this.hoveredSeriesIndex,
        dataIndex: this.hoveredDataIndex,
      });
      this.hasProgrammaticHighlight = true;
    }
  }

  onChartClick(event: any): void {
    if (!event.data) return;

    if (event.seriesId?.startsWith('events-strip') && event.data?.content?.eventId) {
      const eventId = event.data.content.eventId;
      clearEventMarkLineHighlight(this.chartInstance, this.selection);
      const multiKey = event.event?.ctrlKey || event.event?.metaKey;
      if (this.singleSelectionMode() && !this.activeEvents[eventId] && !multiKey) {
        this.deactivateAllEventsExcept(eventId);
      }
      this.toggleEvent(eventId);
      if (this.activeEvents[eventId]) {
        this.openDetailCard({ ...buildDetailCard(event.data.content), file: this.idFileMap.get(event.data.content.id) });
        highlightEventMarkLines(this.chartInstance, this.selection, eventId, event.data.content.name);
        this.updateIdParam(event.data.content.id);
      } else {
        this.closeDetailCard();
      }
      return;
    }

    const c = event.data?.content;
    if (event.componentType === 'markArea' && c?.type === 'gantt') {
      const periodName = event.data?.name;
      if (this.selection.selectedEventSeriesName === event.seriesName && this.selection.selectedEventPeriodName === periodName) {
        this.closeDetailCard();
        return;
      }
      this.openDetailCard({ ...buildDetailCard(c), file: this.idFileMap.get(c.id) });
      clearGanttHighlight(this.chartInstance, this.selection);
      clearMarkLineHighlight(this.chartInstance, this.selection);
      highlightEventMarkLines(this.chartInstance, this.selection, event.seriesName, periodName);
      this.updateIdParam(c.id);
      return;
    }

    if (c?.type === 'gantt') {
      if (this.selection.selectedSeriesId === event.seriesId && this.selection.selectedDataIndex === event.dataIndex) {
        this.closeDetailCard();
        return;
      }
      this.openDetailCard({ ...buildDetailCard(c), file: this.idFileMap.get(c.id) });
      clearMarkLineHighlight(this.chartInstance, this.selection);
      clearEventMarkLineHighlight(this.chartInstance, this.selection);
      highlightGanttItem(this.chartInstance, this.selection, event.seriesId, event.dataIndex);
      this.updateIdParam(c.id);
    }

    if (c?.type === 'line') {
      if (this.selection.selectedMarkLineName === c.name) {
        this.closeDetailCard();
        return;
      }
      const isPast = c.from && new Date(c.from) < new Date();
      const linePrecision = getDatePrecision(c.date);
      const diffText = c.from
        ? isPast
          ? `${formatDateDiff(c.from, new Date().getTime(), linePrecision)} до днес`
          : `след около ${formatDateDiff(new Date().getTime(), c.from, linePrecision)}`
        : '';
      this.openDetailCard({
        id: c.id,
        file: this.idFileMap.get(c.id),
        name: c.name,
        description: c.description,
        from: c.from,
        to: c.from,
        dateRange: c.date ? formatSourceDate(c.date) : '',
        duration: diffText,
        sources: c.sources,
      });
      clearEventMarkLineHighlight(this.chartInstance, this.selection);
      highlightMarkLine(this.chartInstance, this.selection, c.name);
      this.updateIdParam(c.id);
    }
  }

  private openDetailCard(item: NonNullable<typeof this.selectedItem>): void {
    if (this.knowledgeOpen) this.knowledgeOpen = false;
    this.selectedItem = item;
    setTimeout(() => {
      this.chartInstance?.resize();
      this.applySectionSeparators();
    }, 320);
  }

  closeDetailCard(): void {
    this.selectedItem = null;
    this.cdr.detectChanges();
    clearGanttHighlight(this.chartInstance, this.selection);
    clearMarkLineHighlight(this.chartInstance, this.selection);
    clearEventMarkLineHighlight(this.chartInstance, this.selection);
    this.clearIdParam();
    setTimeout(() => {
      this.chartInstance?.resize();
      this.applySectionSeparators();
    }, 320);
  }

  private initTabScroll(): void {
    const el = this.tabScrollEl()?.nativeElement;
    if (!el) return;
    this.tabResizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        this.checkTabOverflow();
        this.cdr.detectChanges();
      });
    });
    this.tabResizeObserver.observe(el);
    this.destroyRef.onDestroy(() => this.tabResizeObserver?.disconnect());
  }

  private checkTabOverflow(): void {
    const el = this.tabScrollEl()?.nativeElement;
    if (!el) return;
    this.canScrollLeft.set(el.scrollLeft > 0);
    this.canScrollRight.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  onTabScroll(): void {
    this.checkTabOverflow();
  }

  scrollTabs(direction: 'left' | 'right'): void {
    const el = this.tabScrollEl()?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction === 'left' ? -200 : 200, behavior: 'smooth' });
  }

  onTabWheel(e: WheelEvent): void {
    const el = this.tabScrollEl()?.nativeElement;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    e.preventDefault();
    el.scrollBy({ left: e.deltaY });
  }

  switchDataset(id: string): void {
    if (this.activeDataset === id) return;
    this.activeDataset = id;
    setTimeout(() => {
      this.tabScrollEl()?.nativeElement.querySelector('.nav-tab.active')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
    this.legends = [];
    this.closeDetailCard();
    this.updateDatasetParam();
    if (this.knowledgeOpen) {
      const slug = this.datasets.find(d => d.id === id)?.knowledge;
      if (slug) {
        this.knowledgeLoadedSlug = '';
        this.knowledgeHtml.set('');
        this.dataService.getKnowledge(slug).subscribe({
          next: (md: string) => {
            this.knowledgeHtml.set(marked.parse(md).toString());
            this.knowledgeLoadedSlug = slug;
          },
          error: () => {
            this.knowledgeHtml.set('<p style="color:#94a3b8;padding:2rem">Съдържанието не може да бъде заредено.</p>');
          },
        });
      } else {
        this.knowledgeOpen = false;
      }
    }

    const zoom = captureZoom(this.chartInstance);

    this.dataService.getData(this.datasetFileMap.get(id)!).subscribe((dataset: TimelineGanttDataset) => {
      this.allGanttDatasets.set(id, dataset);
      const resetZoom = dataset.metadata?.resetZoom;
      const merged = getGanttDataForDataset(this.allGanttDatasets, id, dataset.data, dataset.metadata);
      this.data.timeline = merged.data;
      this.data.verticalLine = [...this.standaloneLines, ...extractEmbeddedLines(this.allGanttDatasets)];
      this.eventGroups = rebuildEventGroups(this.data.eventDatasets, this.eventFileMap, this.manifest, this.activeDataset);
      this.lineItems = rebuildLineItems(this.data.verticalLine, this.manifest, this.activeDataset);
      applyDefaults(this.defaults, this.activeDataset, this.activeEvents, this.lineItems, this.activeLines);
      this.loadChart(this.data.eventDatasets, merged.data, merged.metadata);
      if (this.chartInstance) {
        if (zoom && !resetZoom) {
          this.chart.dataZoom[0] = { ...this.chart.dataZoom[0], startValue: zoom.startValue, endValue: zoom.endValue };
        }
        this.injectBirthDateSeries();
        // Reset hover state before notMerge setOption to avoid stale tooltip references
        this.hoveredSeriesIndex = null;
        this.hoveredDataIndex = null;
        // First setOption to recalculate grid layout, then compute graphic from actual grid rect
        this.chartInstance.setOption(this.chart, true);
        this.chart.graphic = buildSectionGraphic(this.chartInstance, this.sectionBoundaries, this.totalCategories);
        this.chartInstance.setOption({ graphic: this.chart.graphic });
        this.axisRange = cacheAxisRange(this.chartInstance);
        if (!resetZoom) restoreZoom(this.chartInstance, zoom);
      }
    });
  }

  popoverTags(group: { tags: string[] }): { name: string; active: boolean }[] {
    return group.tags.map(t => ({ name: t, active: !!this.activeTags[t] }));
  }

  activeCountForGroup(group: { events: { id: string }[] }): number {
    return group.events.filter(ev => this.activeEvents[ev.id]).length;
  }

  activeTagCountForGroup(group: { tags: string[] }): number {
    return group.tags.filter(t => this.activeTags[t]).length;
  }

  private startYearFromDate(d: { from?: { dateYear?: number; date?: string }; range?: [string, string | null] }): number {
    if (d.from?.dateYear != null) return d.from.dateYear;
    const dateStr = d.from?.date ?? d.range?.[0];
    if (!dateStr) return 0;
    const match = dateStr.match(/^(-?\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  combinedTabs(): CombinedPopoverTab[] {
    const dateMap = new Map<string, { text: string; startYear: number }>();
    for (const ds of this.data.eventDatasets) {
      for (const item of ds.data) {
        const d = item.periods[0]?.date;
        if (d) {
          dateMap.set(item.id, {
            text: formatTimelineDate(d),
            startYear: this.startYearFromDate(d),
          });
        }
      }
    }

    const tabs: CombinedPopoverTab[] = this.eventGroups.map(group => ({
      key: group.name,
      label: group.name,
      items: this.filteredEvents(group).map(ev => {
        const d = dateMap.get(ev.id);
        return { id: ev.id, name: ev.name, date: d?.text ?? '', startYear: d?.startYear ?? 0 };
      }),
      activeItems: this.activeEvents,
      activeCount: this.activeCountForGroup(group),
      tags: this.popoverTags(group),
      activeTagCount: this.activeTagCountForGroup(group),
    }));
    if (this.lineItems.length) {
      const lineDateMap = new Map<string, { text: string; startYear: number }>();
      for (const line of this.data.verticalLine) {
        if (line.date) lineDateMap.set(line.id, { text: formatSourceDate(line.date), startYear: line.date.dateYear ?? 0 });
      }
      const lineTags = [...new Set(this.lineItems.flatMap(l => l.tags))].sort();
      tabs.push({
        key: '__lines__',
        label: 'Дати',
        items: this.filteredLineItems().map(l => {
          const d = lineDateMap.get(l.id);
          return { id: l.id, name: l.name, date: d?.text ?? '', startYear: d?.startYear ?? 0 };
        }),
        activeItems: this.activeLines,
        activeCount: this.activeLineCount(),
        tags: lineTags.map(t => ({ name: t, active: !!this.activeTags[t] })),
        activeTagCount: lineTags.filter(t => this.activeTags[t]).length,
      });
    }
    return tabs;
  }

  combinedTotalActiveCount(): number {
    let count = this.activeLineCount();
    for (const group of this.eventGroups) {
      count += this.activeCountForGroup(group);
    }
    return count;
  }

  onCombinedItemToggle(event: { tabKey: string; itemId: string }): void {
    if (event.tabKey === '__lines__') {
      this.toggleLine(event.itemId);
    } else {
      this.toggleEvent(event.itemId);
    }
  }

  onCombinedItemFocus(event: { tabKey: string; itemId: string }): void {
    if (event.tabKey === '__lines__') {
      if (!this.activeLines[event.itemId]) this.toggleLine(event.itemId);
      this.highlightChipLine(event.itemId);
    } else {
      if (!this.activeEvents[event.itemId]) this.toggleEvent(event.itemId);
      this.highlightChipEvent(event.itemId);
    }
  }

  onCombinedClearTab(tabKey: string): void {
    if (tabKey === '__lines__') {
      this.turnOffAllLines();
    } else {
      const group = this.eventGroups.find(g => g.name === tabKey);
      if (group) this.turnOffGroupEvents(group);
    }
  }

  clearAllSelected(): void {
    for (const group of this.eventGroups) {
      this.turnOffGroupEvents(group);
    }
    this.turnOffAllLines();
    this.clearTags();
  }

  onCombinedSelectAllTab(event: { tabKey: string; itemIds: string[] }): void {
    if (event.tabKey === '__lines__') {
      this.turnOnLines(event.itemIds);
    } else {
      this.turnOnEvents(event.itemIds);
    }
  }

  toggleCombinedPopover(): void {
    this.combinedPopoverOpen = !this.combinedPopoverOpen;
    if (!this.combinedPopoverOpen) {
      this.popoverSearch = '';
    }
    this.globalSearch = '';
  }

  closePopovers(): void {
    this.combinedPopoverOpen = false;
    this.popoverSearch = '';
    this.globalSearch = '';
  }

  isAnyPopoverOpen(): boolean {
    return this.combinedPopoverOpen || !!this.globalSearch.trim();
  }

  onGlobalSearchChange(): void {
    if (this.globalSearch.trim()) {
      this.combinedPopoverOpen = false;
      this.popoverSearch = '';
    }
  }

  globalSearchResults(): { group: string; items: { id: string; name: string; type: 'event' | 'line' }[] }[] {
    const q = this.globalSearch.trim();
    if (!q) return [];
    const results: { group: string; items: { id: string; name: string; type: 'event' | 'line' }[] }[] = [];
    for (const group of this.eventGroups) {
      const fuse = new Fuse(group.events, { keys: ['name'], threshold: this.fuzzySearchThreshold });
      const matches = fuse.search(q).map(r => ({ id: r.item.id, name: r.item.name, type: 'event' as const }));
      if (matches.length) results.push({ group: group.name, items: matches });
    }
    const lineFuse = new Fuse(this.lineItems, { keys: ['name'], threshold: this.fuzzySearchThreshold });
    const lineMatches = lineFuse.search(q).map(r => ({ id: r.item.key, name: r.item.name, type: 'line' as const }));
    if (lineMatches.length) results.push({ group: 'Ключови дати', items: lineMatches });
    return results;
  }

  toggleSearchResult(item: { id: string; type: 'event' | 'line' }): void {
    if (item.type === 'event') this.toggleEvent(item.id);
    else this.toggleLine(item.id);
  }

  toggleLine(key: string): void {
    if (!this.chartInstance) return;
    const zoom = captureZoom(this.chartInstance);
    this.activeLines[key] = !this.activeLines[key];
    const legendName = this.lineItems.find(l => l.key === key)?.legendName ?? key;
    const currentSelected = (this.chartInstance.getOption() as any).legend[0].selected;
    this.chartInstance.setOption({ legend: { selected: { ...currentSelected, [legendName]: this.activeLines[key] } } });
    restoreZoom(this.chartInstance, zoom);
  }

  activeLineCount(): number {
    return this.lineItems.filter(l => this.activeLines[l.key]).length;
  }

  selectedEventChips(): { id: string; name: string; dateRange: string; group: string; startYear: number }[] {
    const dateMap = new Map<string, { text: string; startYear: number }>();
    for (const ds of this.data.eventDatasets) {
      for (const item of ds.data) {
        const d = item.periods[0]?.date;
        if (!d) continue;
        dateMap.set(item.id, { text: formatTimelineDate(d), startYear: this.startYearFromDate(d) });
      }
    }
    const result: { id: string; name: string; dateRange: string; group: string; startYear: number }[] = [];
    for (const group of this.eventGroups) {
      for (const ev of group.events) {
        if (this.activeEvents[ev.id]) {
          const d = dateMap.get(ev.id);
          result.push({ id: ev.id, name: ev.name, dateRange: d?.text ?? '', group: group.name, startYear: d?.startYear ?? 0 });
        }
      }
    }
    return result;
  }

  selectedLineChips(): { key: string; name: string; dateRange: string; startYear: number }[] {
    return this.lineItems.filter(l => this.activeLines[l.key]).map(l => {
      const line = this.data.verticalLine.find(v => v.id === l.key);
      return { key: l.key, name: l.name, dateRange: line?.date ? formatSourceDate(line.date) : '', startYear: line?.date?.dateYear ?? 0 };
    });
  }

  selectedTagChips(): { name: string }[] {
    return Object.entries(this.activeTags).filter(([, v]) => v).map(([name]) => ({ name }));
  }

  filterChipsByGroup(
    chips: { id: string; name: string; dateRange: string; group: string; startYear: number }[],
    groupName: string,
  ): { id: string; name: string; dateRange: string; group: string; startYear: number }[] {
    return chips.filter(c => c.group === groupName);
  }

  chipGroupClass(groupName: string): string {
    if (groupName === 'Личности') return 'persons';
    return 'events';
  }

  toggleSelPanelSort(field: 'name' | 'date'): void {
    if (this.selPanelSortField === field) {
      this.selPanelSortDir = this.selPanelSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.selPanelSortField = field;
      this.selPanelSortDir = 'asc';
    }
  }

  sortedEventChips(
    chips: { id: string; name: string; dateRange: string; group: string; startYear: number }[],
  ): { id: string; name: string; dateRange: string; group: string; startYear: number }[] {
    const dir = this.selPanelSortDir === 'asc' ? 1 : -1;
    return [...chips].sort((a, b) =>
      this.selPanelSortField === 'date' ? (a.startYear - b.startYear) * dir : a.name.localeCompare(b.name, 'bg') * dir,
    );
  }

  sortedLineChips(
    chips: { key: string; name: string; dateRange: string; startYear: number }[],
  ): { key: string; name: string; dateRange: string; startYear: number }[] {
    const dir = this.selPanelSortDir === 'asc' ? 1 : -1;
    return [...chips].sort((a, b) =>
      this.selPanelSortField === 'date' ? (a.startYear - b.startYear) * dir : a.name.localeCompare(b.name, 'bg') * dir,
    );
  }

  highlightChipEvent(id: string): void {
    let found: import('../models/timeline').TimelineArea | undefined;
    for (const ds of this.data.eventDatasets) {
      found = ds.data.find(item => item.id === id);
      if (found) break;
    }
    if (!found) return;
    const period = found.periods[0];
    if (!period) return;
    clearGanttHighlight(this.chartInstance, this.selection);
    clearMarkLineHighlight(this.chartInstance, this.selection);
    this.openDetailCard({
      ...buildDetailCard({ id: found.id, name: period.name, description: period.description, comment: period.comment, date: period.date, from: period.date.range[0], to: period.date.range[1], sources: period.sources }),
      file: this.idFileMap.get(found.id),
    });
    highlightEventMarkLines(this.chartInstance, this.selection, id, period.name);
    const fromMs = new Date(period.date.range[0]).getTime();
    const toMs = period.date.range[1] ? new Date(period.date.range[1]).getTime() : Date.now();
    if (isFinite(fromMs)) zoomToDateRange(this.chartInstance, fromMs, toMs);
    this.updateIdParam(id);
  }

  highlightChipLine(key: string): void {
    const line = this.data.verticalLine.find(v => v.id === key);
    if (!line) return;
    const from = line.date?.date ?? '';
    const isPast = from && new Date(from) < new Date();
    const linePrecision = getDatePrecision(line.date);
    const duration = from
      ? isPast ? `${formatDateDiff(from, new Date().getTime(), linePrecision)} до днес` : `след около ${formatDateDiff(new Date().getTime(), from, linePrecision)}`
      : '';
    clearGanttHighlight(this.chartInstance, this.selection);
    clearEventMarkLineHighlight(this.chartInstance, this.selection);
    this.openDetailCard({ id: line.id, file: this.idFileMap.get(line.id), name: line.name, description: line.description, from, to: from, dateRange: line.date ? formatSourceDate(line.date) : '', duration, sources: line.sources });
    highlightMarkLine(this.chartInstance, this.selection, line.name);
    const dateMs = from ? new Date(from).getTime() : NaN;
    if (isFinite(dateMs)) zoomToDateRange(this.chartInstance, dateMs, dateMs);
    this.updateIdParam(key);
  }

  turnOffAllLines(): void {
    if (!this.chartInstance) return;
    const zoom = captureZoom(this.chartInstance);
    const currentSelected = (this.chartInstance.getOption() as any).legend[0].selected;
    const selected = { ...currentSelected };
    this.lineItems.forEach(({ key, legendName }) => {
      this.activeLines[key] = false;
      selected[legendName] = false;
    });
    this.chartInstance.setOption({ legend: { selected } });
    restoreZoom(this.chartInstance, zoom);
  }

  turnOffGroupEvents(group: { events: { id: string }[] }): void {
    if (!this.chartInstance) return;
    const zoom = captureZoom(this.chartInstance);
    const currentSelected = (this.chartInstance.getOption() as any).legend[0].selected;
    const selected = { ...currentSelected };
    const allIds = new Set<string>();
    group.events.forEach(({ id }) => {
      this.activeEvents[id] = false;
      selected[id] = false;
      allIds.add(id);
      if (id === 'war-russia-ukraine') {
        selected['war-russia-ukraine2'] = false;
        allIds.add('war-russia-ukraine2');
      }
    });
    this.chartInstance.setOption({ legend: { selected } });
    this.updateEventsStripActiveState(allIds, false);
    restoreZoom(this.chartInstance, zoom);
  }

  turnOnLines(ids: string[]): void {
    if (!this.chartInstance) return;
    const zoom = captureZoom(this.chartInstance);
    const currentSelected = (this.chartInstance.getOption() as any).legend[0].selected;
    const selected = { ...currentSelected };
    for (const id of ids) {
      this.activeLines[id] = true;
      const legendName = this.lineItems.find(l => l.key === id)?.legendName ?? id;
      selected[legendName] = true;
    }
    this.chartInstance.setOption({ legend: { selected } });
    restoreZoom(this.chartInstance, zoom);
  }

  turnOnEvents(ids: string[]): void {
    if (!this.chartInstance) return;
    const zoom = captureZoom(this.chartInstance);
    const currentSelected = (this.chartInstance.getOption() as any).legend[0].selected;
    const selected = { ...currentSelected };
    const allIds = new Set<string>();
    for (const id of ids) {
      this.activeEvents[id] = true;
      selected[id] = true;
      allIds.add(id);
      if (id === 'war-russia-ukraine') {
        selected['war-russia-ukraine2'] = true;
        allIds.add('war-russia-ukraine2');
      }
    }
    this.chartInstance.setOption({ legend: { selected } });
    this.updateEventsStripActiveState(allIds, true);
    restoreZoom(this.chartInstance, zoom);
  }

  private deactivateAllEventsExcept(exceptId: string): void {
    if (!this.chartInstance) return;
    const zoom = captureZoom(this.chartInstance);
    const currentSelected = (this.chartInstance.getOption() as any).legend[0].selected;
    const selected = { ...currentSelected };
    const allIds = new Set<string>();
    Object.entries(this.activeEvents).forEach(([id, active]) => {
      if (active && id !== exceptId) {
        this.activeEvents[id] = false;
        selected[id] = false;
        allIds.add(id);
        if (id === 'war-russia-ukraine') {
          selected['war-russia-ukraine2'] = false;
          allIds.add('war-russia-ukraine2');
        }
      }
    });
    if (allIds.size > 0) {
      this.chartInstance.setOption({ legend: { selected } });
      this.updateEventsStripActiveState(allIds, false);
    }
    restoreZoom(this.chartInstance, zoom);
  }

  toggleTag(tag: string): void {
    this.activeTags[tag] = !this.activeTags[tag];
    this.applyTagDimming();
  }

  clearTags(): void {
    this.activeTags = {};
    this.applyTagDimming();
  }

  selectAllTags(tabKey: string): void {
    if (tabKey === '__lines__') {
      for (const tag of [...new Set(this.lineItems.flatMap(l => l.tags))]) {
        this.activeTags[tag] = true;
      }
    } else {
      const group = this.eventGroups.find(g => g.name === tabKey);
      if (group) {
        for (const tag of group.tags) {
          this.activeTags[tag] = true;
        }
      }
    }
    this.applyTagDimming();
  }

  filteredEvents(group: { tags: string[]; events: { id: string; name: string; tags: string[] }[] }): { id: string; name: string; tags: string[] }[] {
    const active = Object.entries(this.activeTags).filter(([, v]) => v).map(([k]) => k);
    // Only filter by tags that belong to this group
    const relevant = active.filter(t => group.tags.includes(t));
    let items = relevant.length ? group.events.filter(ev => ev.tags.some(t => relevant.includes(t))) : group.events;
    return this.fuzzyFilter(items, 'name');
  }

  filteredLines(): LineItem[] {
    return this.fuzzyFilter(this.lineItems, 'name');
  }

  filteredLineItems(): { id: string; name: string }[] {
    const lineTags = [...new Set(this.lineItems.flatMap(l => l.tags))];
    const active = Object.entries(this.activeTags).filter(([, v]) => v).map(([k]) => k);
    const relevant = active.filter(t => lineTags.includes(t));
    let items = this.filteredLines();
    if (relevant.length) {
      items = items.filter(l => l.tags.some(t => relevant.includes(t)));
    }
    return items.map(l => ({ id: l.key, name: l.name }));
  }

  private fuzzyFilter<T>(items: T[], key: string): T[] {
    if (!this.popoverSearch.trim()) return items;
    const fuse = new Fuse(items, { keys: [key], threshold: this.fuzzySearchThreshold });
    return fuse.search(this.popoverSearch).map(r => r.item);
  }

  toggleEvent(id: string): void {
    if (!this.chartInstance) return;
    const zoom = captureZoom(this.chartInstance);
    this.activeEvents[id] = !this.activeEvents[id];
    const currentSelected = (this.chartInstance.getOption() as any).legend[0].selected;
    const selected = { ...currentSelected, [id]: this.activeEvents[id] };
    const relatedIds = new Set([id]);
    if (id === 'war-russia-ukraine') {
      selected['war-russia-ukraine2'] = this.activeEvents[id];
      relatedIds.add('war-russia-ukraine2');
    }
    // Update both chartInstance and this.chart so ngx-echarts change detection doesn't revert
    this.chart.legend.selected = selected;
    this.chartInstance.setOption({ legend: { selected } });
    this.updateEventsStripActiveState(relatedIds, this.activeEvents[id]);
    restoreZoom(this.chartInstance, zoom);
  }

  private updateEventsStripActiveState(ids: Set<string>, active: boolean): void {
    const updates = buildEventsStripActiveUpdates((this.chartInstance.getOption() as any).series ?? [], ids, active);
    if (updates.length) {
      // Update this.chart.series to stay in sync with chartInstance
      for (const update of updates) {
        const chartSeries = this.chart.series.find((s: any) => s.id === update.id);
        if (chartSeries) chartSeries.data = update.data;
      }
      this.chartInstance.setOption({ series: updates });
    }
  }

  private applyTagDimming(): void {
    if (!this.chartInstance) return;
    const updates = buildTagDimmingUpdates((this.chartInstance.getOption() as any).series ?? [], this.activeTags);
    if (updates.length) this.chartInstance.setOption({ series: updates });
  }

  private injectBirthDateSeries(): void {
    const { year, month, duration } = this.dateForm.value;
    if (!year || !month) return;
    const from = new Date(year, Number(month) - 1, 1);
    from.setFullYear(year);
    this.chart.series.push(buildBirthDateSeries(from, duration ?? undefined));
    const currentDateSeries = this.chart.series.find((s: any) => s.id === 'current-date-line');
    if (currentDateSeries) {
      currentDateSeries.markLine.tooltip = { formatter: buildAgeLabel(moment(from), moment()) };
    }
    if (duration) {
      this.chart.series.push(buildDurationDateSeries(from, duration));
      const defaultMax = moment().add(1, 'years');
      const durationDate = moment(from).add(duration, 'years');
      if (durationDate.isAfter(defaultMax)) {
        this.chart.xAxis[0].max = durationDate.add(5, 'years').format('YYYY-MM-DD');
      }
    }
  }

  applyCustomMarkArea(): void {
    if (!this.chartInstance) return;
    const { year, month, duration } = this.dateForm.value;
    if (!year || !month) {
      this.chartInstance.setOption({
        xAxis: [{ max: moment().add(1, 'years').format('YYYY-MM-DD') }],
        series: [
          { id: 'custom-date-mark', markLine: { data: [] }, markArea: { data: [] } },
          { id: 'custom-duration-mark', markLine: { data: [] } },
          { id: 'current-date-line', markLine: { tooltip: { formatter: buildTodayLabel() } } },
        ],
      });
      return;
    }
    const from = new Date(year, Number(month) - 1, 1);
    from.setFullYear(year);
    const series: any[] = [
      buildBirthDateSeries(from, duration ?? undefined),
      { id: 'current-date-line', markLine: { tooltip: { formatter: buildAgeLabel(moment(from), moment()) } } },
    ];
    const defaultMax = moment().add(1, 'years').format('YYYY-MM-DD');
    let xMax = defaultMax;
    if (duration) {
      series.push(buildDurationDateSeries(from, duration));
      const durationDate = moment(from).add(duration, 'years');
      if (durationDate.isAfter(moment(defaultMax))) {
        xMax = durationDate.add(5, 'years').format('YYYY-MM-DD');
      }
    } else {
      series.push({ id: 'custom-duration-mark', markLine: { data: [] } });
    }
    this.chartInstance.setOption({ series, xAxis: [{ max: xMax }] });
  }

  private updateDatasetParam(): void {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { dataset: this.activeDataset },
      queryParamsHandling: 'merge',
    });
  }

  private updateIdParam(uuid: string): void {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { id: uuid },
      queryParamsHandling: 'merge',
    });
  }

  private clearIdParam(): void {
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { id: null },
      queryParamsHandling: 'merge',
    });
  }

  private findGanttInSeries(uuid: string): { seriesId: string; dataIndex: number } | null {
    if (!this.chartInstance) return null;
    const series = (this.chartInstance.getOption() as any).series;
    for (const s of series) {
      if (!s.id?.startsWith('gantt-')) continue;
      for (let i = 0; i < s.data.length; i++) {
        if (s.data[i].content?.id === uuid) {
          return { seriesId: s.id, dataIndex: i };
        }
      }
    }
    return null;
  }

  private highlightGanttByUuid(uuid: string): void {
    const gantt = this.data.timeline.find(g => g.id === uuid);
    if (!gantt) return;
    const period = gantt.periods[0];
    if (!period) return;
    const match = this.findGanttInSeries(uuid);
    if (!match) return;
    clearMarkLineHighlight(this.chartInstance, this.selection);
    clearEventMarkLineHighlight(this.chartInstance, this.selection);
    this.openDetailCard({
      ...buildDetailCard({
        id: gantt.id,
        group: gantt.name,
        name: period.name,
        description: period.description,
        comment: period.comment,
        date: period.date,
        from: period.date.range[0],
        to: period.date.range[1],
        sources: period.sources,
      }),
      file: this.idFileMap.get(gantt.id),
    });
    highlightGanttItem(this.chartInstance, this.selection, match.seriesId, match.dataIndex);
    const fromMs = new Date(period.date.range[0]).getTime();
    const toMs = period.date.range[1] ? new Date(period.date.range[1]).getTime() : Date.now();
    if (isFinite(fromMs)) zoomToDateRange(this.chartInstance, fromMs, toMs);
  }

  private highlightByUuid(uuid: string): void {
    for (const ds of this.data.eventDatasets) {
      if (ds.data.some(item => item.id === uuid)) {
        if (!this.activeEvents[uuid]) this.toggleEvent(uuid);
        this.highlightChipEvent(uuid);
        return;
      }
    }
    if (this.data.verticalLine.some(v => v.id === uuid)) {
      if (!this.activeLines[uuid]) this.toggleLine(uuid);
      this.highlightChipLine(uuid);
      return;
    }
    if (this.data.timeline.some(g => g.id === uuid)) {
      this.highlightGanttByUuid(uuid);
      this.updateIdParam(uuid);
      return;
    }
    this.clearIdParam();
  }
}
