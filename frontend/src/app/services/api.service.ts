import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}
  createCheckoutSession(address: string): Observable<any> {
    return this.http.post(`${environment.apiBase}/create-checkout-session`, { address });
  }
  analyze(session_id: string): Observable<any> {
    return this.http.post(`${environment.apiBase}/analyze`, { session_id });
  }
}
