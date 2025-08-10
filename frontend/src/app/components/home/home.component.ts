import { Component } from '@angular/core';
import { ApiService } from '../../services/api.service';
import { loadStripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';
import { lastValueFrom } from 'rxjs';

@Component({ selector: 'app-home', templateUrl: './home.component.html' })
export class HomeComponent {
  address = '';
  loading = false;
  error: string | null = null;

  constructor(private api: ApiService) {}

  async generate() {
    this.loading = true;
    this.error = null;
    try {
      const stripe = await loadStripe(environment.stripePublicKey);
      if (!stripe) throw new Error('Stripe failed to load. Check publishable key.');

      const resp = await lastValueFrom(this.api.createCheckoutSession(this.address));
      if (!resp?.id) throw new Error('No session id from server');
      const { error } = await stripe.redirectToCheckout({ sessionId: resp.id });
      if (error) throw error;
    } catch (e: any) {
      console.error(e);
      this.error = e?.message || 'Failed to redirect to Stripe';
    } finally {
      this.loading = false;
    }
  }
}
