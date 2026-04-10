import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider, ChevronRight, ChevronDown } from 'lucide-angular';

export interface CombinedPopoverItem {
  id: string;
  name: string;
  date: string;
  startYear: number;
}

export interface CombinedPopoverTab {
  key: string;
  label: string;
  items: CombinedPopoverItem[];
  activeItems: Record<string, boolean>;
  activeCount: number;
  tags: { name: string; active: boolean }[];
  activeTagCount: number;
}

export type SortField = 'name' | 'date';
export type SortDir = 'asc' | 'desc';

@Component({
  selector: 'app-popover-combined',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  providers: [{ provide: LUCIDE_ICONS, useValue: new LucideIconProvider({ ChevronRight, ChevronDown }), multi: true }],
  templateUrl: './popover-combined.component.html',
  styleUrl: './popover-combined.component.css',
})
export class PopoverCombinedComponent {
  @Input() tabs: CombinedPopoverTab[] = [];
  @Input() expanded = false;
  @Input() search = '';
  @Input() totalActiveCount = 0;
  @Input() @HostBinding('class.grouped') grouped = false;

  @Output() toggle = new EventEmitter<void>();
  @Output() itemToggle = new EventEmitter<{ tabKey: string; itemId: string }>();
  @Output() tagToggle = new EventEmitter<string>();
  @Output() tagsClear = new EventEmitter<void>();
  @Output() tagsSelectAll = new EventEmitter<string>();
  @Output() clearTab = new EventEmitter<string>();
  @Output() selectAllTab = new EventEmitter<{ tabKey: string; itemIds: string[] }>();
  @Output() itemFocus = new EventEmitter<{ tabKey: string; itemId: string }>();
  @Output() searchChange = new EventEmitter<string>();
  @Output() clearAll = new EventEmitter<void>();

  activeTabKey = '';
  sortField: SortField = 'name';
  sortDir: SortDir = 'asc';
  showSelectedOnly = false;

  get currentTab(): CombinedPopoverTab | undefined {
    if (!this.activeTabKey && this.tabs.length) this.activeTabKey = this.tabs[0].key;
    return this.tabs.find(t => t.key === this.activeTabKey) ?? this.tabs[0];
  }

  displayedItems(tab: CombinedPopoverTab): CombinedPopoverItem[] {
    return this.sortedItems(tab.items);
  }

  allSelectedGroups(): { tab: CombinedPopoverTab; items: CombinedPopoverItem[] }[] {
    return this.tabs
      .map((tab) => ({ tab, items: this.sortedItems(tab.items.filter((item) => tab.activeItems[item.id])) }))
      .filter((g) => g.items.length);
  }

  allSelectedTags(): string[] {
    const seen = new Set<string>();
    for (const tab of this.tabs) {
      for (const tag of tab.tags) {
        if (tag.active) seen.add(tag.name);
      }
    }
    return [...seen];
  }

  sortedItems(items: CombinedPopoverItem[]): CombinedPopoverItem[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    return [...items].sort((a, b) => {
      if (this.sortField === 'date') {
        return (a.startYear - b.startYear) * dir;
      }
      return a.name.localeCompare(b.name, 'bg') * dir;
    });
  }

  toggleSort(field: SortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDir = 'asc';
    }
  }

  hasUnselectedItems(tab: CombinedPopoverTab): boolean {
    return tab.items.some(i => !tab.activeItems[i.id]);
  }

  emitSelectAll(tab: CombinedPopoverTab): void {
    this.selectAllTab.emit({ tabKey: tab.key, itemIds: tab.items.map(i => i.id) });
  }

  selectTab(key: string): void {
    this.activeTabKey = key;
    this.showSelectedOnly = false;
    this.searchChange.emit('');
  }
}
