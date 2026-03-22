import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-razorpay-signature') || '';
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Webhook] RAZORPAY_WEBHOOK_SECRET not set');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');

    if (expectedSig !== signature) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(body);
    const db = createServiceRoleClient();

    // Idempotency — skip if already processed
    const { data: existing } = await db.from('payment_events')
      .select('id').eq('event_id', event.id).single();
    if (existing) {
      return NextResponse.json({ status: 'already_processed' });
    }

    // Log the event
    await db.from('payment_events').insert({
      event_id: event.id,
      event_type: event.event,
      payload: event,
    });

    console.log(`[Webhook] Event: ${event.event}`);

    // Handle events
    switch (event.event) {
      case 'payment.captured': {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id) {
          const { data: sub } = await db.from('subscriptions')
            .select('user_id').eq('razorpay_order_id', payment.order_id).single();

          if (sub?.user_id) {
            const now = new Date();
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);

            await db.from('subscriptions').update({
              razorpay_payment_id: payment.id,
              status: 'active',
              current_period_start: now.toISOString(),
              current_period_end: nextMonth.toISOString(),
              updated_at: now.toISOString(),
            }).eq('razorpay_order_id', payment.order_id);

            await db.from('profiles').update({
              plan: 'pro',
              plan_updated_at: now.toISOString(),
              updated_at: now.toISOString(),
            }).eq('id', sub.user_id);

            console.log(`[Webhook] ✅ User ${sub.user_id} upgraded via webhook`);
          }
        }
        break;
      }

      case 'payment.failed': {
        const payment = event.payload?.payment?.entity;
        if (payment?.order_id) {
          await db.from('subscriptions').update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          }).eq('razorpay_order_id', payment.order_id);
        }
        break;
      }
    }

    return NextResponse.json({ status: 'ok' });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
