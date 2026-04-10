import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider, ChevronLeft, ChevronRight, Pause, Play, Pencil } from 'lucide-angular';
import { DataService } from '../services/data.service';
import { environment } from '../../environments/environment';

interface Quote {
  quote: string;
  from: string;
  original?: string;
  en?: string;
  sources?: string[];
}

@Component({
  selector: 'app-quotes',
  imports: [LucideAngularModule],
  providers: [{ provide: LUCIDE_ICONS, useValue: new LucideIconProvider({ ChevronLeft, ChevronRight, Pause, Play, Pencil }), multi: true }],
  templateUrl: './quotes.component.html',
  styleUrl: './quotes.component.css',
})
export class QuotesComponent implements OnInit, OnDestroy {
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly currentIndex = signal(0);
  protected readonly transitioning = signal(false);
  protected readonly current = computed(() => this.quotes()[this.currentIndex()]);
  protected readonly hasMultiple = computed(() => this.quotes().length > 1);
  protected readonly showTranslation = signal(false);
  protected readonly paused = signal(false);
  protected readonly editUrl = `${environment.githubUrl}/edit/main/public/data/quotes.json`;

  private autoPlayTimer: ReturnType<typeof setInterval> | null = null;
  private hovered = false;

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getData('quotes.json').subscribe((data: Quote[]) => {
      this.quotes.set(data);
      if (QuotesComponent.RANDOM_START && data.length > 1) {
        this.currentIndex.set(Math.floor(Math.random() * data.length));
      }
      if (data.length > 1) {
        this.startAutoPlay();
      }
    });
  }

  private static readonly AUTO_PLAY_INTERVAL = 15000;
  private static readonly RANDOM_START = true;

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  protected goTo(index: number): void {
    if (index === this.currentIndex()) return;
    this.crossfade(() => {
      this.currentIndex.set(index);
      this.showTranslation.set(false);
    });
    this.restartAutoPlay();
  }

  protected prev(): void {
    const len = this.quotes().length;
    this.crossfade(() => {
      this.currentIndex.set((this.currentIndex() - 1 + len) % len);
      this.showTranslation.set(false);
    });
    this.restartAutoPlay();
  }

  protected next(): void {
    const len = this.quotes().length;
    this.crossfade(() => {
      this.currentIndex.set((this.currentIndex() + 1) % len);
      this.showTranslation.set(false);
    });
    this.restartAutoPlay();
  }

  protected toggleTranslation(): void {
    this.showTranslation.update(v => !v);
    if (this.showTranslation()) {
      this.stopAutoPlay();
    } else {
      this.restartAutoPlay();
    }
  }

  protected togglePause(): void {
    this.paused.update(v => !v);
    if (this.paused()) {
      this.stopAutoPlay();
    } else {
      this.restartAutoPlay();
    }
  }

  protected onMouseEnter(): void {
    this.hovered = true;
    this.stopAutoPlay();
  }

  protected onMouseLeave(): void {
    this.hovered = false;
    this.restartAutoPlay();
  }

  private crossfade(change: () => void): void {
    this.transitioning.set(true);
    setTimeout(() => {
      change();
      this.transitioning.set(false);
    }, 350);
  }

  private autoAdvance(): void {
    const len = this.quotes().length;
    this.crossfade(() => {
      this.currentIndex.set((this.currentIndex() + 1) % len);
      this.showTranslation.set(false);
    });
  }

  private startAutoPlay(): void {
    this.stopAutoPlay();
    this.autoPlayTimer = setInterval(() => this.autoAdvance(), QuotesComponent.AUTO_PLAY_INTERVAL);
  }

  private stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  private restartAutoPlay(): void {
    this.stopAutoPlay();
    if (this.hasMultiple() && !this.paused() && !this.hovered) {
      this.startAutoPlay();
    }
  }
}
