import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createServiceRoleClient } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const user = await getAuthUser(request, response);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    // ============================================
    // SIGNATURE VERIFICATION — critical security step
    // Razorpay signs: order_id + "|" + payment_id
    // with your key_secret using HMAC-SHA256
    // ============================================
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) return NextResponse.json({ error: 'Server config error' }, { status: 500 });

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      console.error('[Payment] Signature mismatch!');
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    // Signature valid — upgrade user to Pro
    const db = createServiceRoleClient();
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    // Update subscription record
    await db.from('subscriptions').update({
      razorpay_payment_id,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: nextMonth.toISOString(),
      updated_at: now.toISOString(),
    }).eq('razorpay_order_id', razorpay_order_id).eq('user_id', user.id);

    // Upgrade user profile to Pro
    await db.from('profiles').update({
      plan: 'pro',
      plan_updated_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq('id', user.id);

    console.log(`[Payment] ✅ User ${user.id} upgraded to Pro`);

    return NextResponse.json({ success: true, plan: 'pro' });

  } catch (error) {
    console.error('[Payment] Verify error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}
