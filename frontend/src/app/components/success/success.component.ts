import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({ selector: 'app-success', templateUrl: './success.component.html' })
export class SuccessComponent implements OnInit {
  loading = true;
  analysis: string | null = null;
  fileUrl: string | null = null;
  error: string | null = null;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  ngOnInit() {
    const session_id = this.route.snapshot.queryParamMap.get('session_id');
    if (!session_id) { this.error = 'Missing session_id'; this.loading = false; return; }
    this.api.analyze(session_id).subscribe({
      next: (res: any) => { this.analysis = res.analysis; this.fileUrl = res.fileBase64 || res.fileUrl; this.loading = false; },
      error: (err) => { this.error = err?.error?.error || 'Failed to generate analysis'; this.loading = false; }
    });
  }
}
