import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PopoverItem {
  id: string;
  name: string;
}

export interface PopoverTag {
  name: string;
  active: boolean;
}

@Component({
  selector: 'app-popover-group',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './popover-group.component.html',
  styleUrl: './popover-group.component.css',
})
export class PopoverGroupComponent {
  @Input() label = '';
  @Input() items: PopoverItem[] = [];
  @Input() activeItems: Record<string, boolean> = {};
  @Input() expanded = false;
  @Input() tags: PopoverTag[] = [];
  @Input() activeCount = 0;
  @Input() activeTagCount = 0;
  @Input() search = '';

  @Output() toggle = new EventEmitter<void>();
  @Output() itemToggle = new EventEmitter<string>();
  @Output() tagToggle = new EventEmitter<string>();
  @Output() tagsClear = new EventEmitter<void>();
  @Output() clearAll = new EventEmitter<void>();
  @Output() searchChange = new EventEmitter<string>();

  get hasAnyActive(): boolean {
    return this.items.some(item => this.activeItems[item.id]);
  }

  get hasAnyActiveTag(): boolean {
    return this.tags.some(t => t.active);
  }
}
