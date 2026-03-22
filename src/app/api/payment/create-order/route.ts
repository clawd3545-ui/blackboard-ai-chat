import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, createServiceRoleClient } from '@/lib/supabase';
import Razorpay from 'razorpay';

const PLAN_PRICE_PAISE = 900; // ₹9/month = 900 paise

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  try {
    const user = await getAuthUser(request, response);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
    }

    // Check if already pro
    const db = createServiceRoleClient();
    const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).single();
    if (profile?.plan === 'pro') {
      return NextResponse.json({ error: 'Already on Pro plan' }, { status: 400 });
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const order = await (razorpay.orders.create as any)({
      amount: PLAN_PRICE_PAISE,
      currency: 'INR',
      receipt: `rcpt_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: { user_id: user.id, plan: 'pro', email: user.email || '' },
    });

    // Save pending subscription record
    await db.from('subscriptions').upsert({
      user_id: user.id,
      razorpay_order_id: order.id,
      status: 'pending',
      plan: 'pro',
      amount: PLAN_PRICE_PAISE,
      currency: 'INR',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'razorpay_order_id' });

    return NextResponse.json({
      orderId: order.id,
      amount: PLAN_PRICE_PAISE,
      currency: 'INR',
      keyId,
      prefill: { email: user.email || '' },
    });

  } catch (error) {
    console.error('[Payment] Create order error:', error);
    return NextResponse.json({ error: 'Failed to create payment order' }, { status: 500 });
  }
}
