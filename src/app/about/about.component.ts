import { Component, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { DataService } from '../services/data.service';
import { marked } from 'marked';
import { RouterLink } from '@angular/router';
import { markedConfig } from '../services/markdown';
import { environment } from '../../environments/environment';
import { LucideAngularModule, LUCIDE_ICONS, LucideIconProvider, ArrowLeft } from 'lucide-angular';

@Component({
  selector: 'app-about',
  imports: [RouterLink, LucideAngularModule],
  providers: [{ provide: LUCIDE_ICONS, useValue: new LucideIconProvider({ ArrowLeft }), multi: true }],
  templateUrl: './about.component.html',
  encapsulation: ViewEncapsulation.None,
})
export class AboutComponent implements OnInit {
  public html = signal('');

  constructor(private dataService: DataService) {}

  ngOnInit(): void {
    this.dataService.getPage('about').subscribe((response: any) => {
      marked.use(markedConfig());
      const content = response.replace('{{githubUrl}}', environment.githubUrl);
      this.html.set(marked.parse(content).toString());
    });
  }
}
