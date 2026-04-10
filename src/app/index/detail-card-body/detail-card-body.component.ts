import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider } from 'lucide-angular';
import { BookOpen, Check, ClipboardCopy, ExternalLink, Pencil, Play } from 'lucide-angular';
import { ChartSource } from '../../models/chart';
import { SourceDate } from '../../models/timeline';
import { StarSignPipe } from '../../pipes/star-sign.pipe';

export interface DetailCardItem {
  id?: string;
  file?: string;
  name: string;
  group?: string;
  description?: string;
  comment?: string;
  dateRange: string;
  duration: string;
  birthDate?: SourceDate;
  sources?: ChartSource[];
}

@Component({
  selector: 'app-detail-card-body',
  imports: [LucideAngularModule, StarSignPipe],
  templateUrl: './detail-card-body.component.html',
  styleUrl: './detail-card-body.component.css',
  providers: [
    { provide: LUCIDE_ICONS, useValue: new LucideIconProvider({ BookOpen, Check, ClipboardCopy, ExternalLink, Pencil, Play }), multi: true },
  ],
})
export class DetailCardBodyComponent {
  @Input({ required: true }) item!: DetailCardItem;
  @Input({ required: true }) idCopied!: boolean;
  @Input({ required: true }) editUrl!: string;
  @Input() compact = false;
  @Output() copyId = new EventEmitter<void>();

  isYoutube(src: ChartSource): boolean {
    const url = src.url[0] ?? '';
    return url.includes('youtube.com') || url.includes('youtu.be');
  }
}
