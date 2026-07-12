import { NextRequest, NextResponse } from 'next/server';
import { acceptTwentyWebhook } from '@/lib/integrations/twenty/inbound';

export async function POST(request: NextRequest) {
  const timestamp = request.headers.get('x-twenty-webhook-timestamp') || '';
  const signature = request.headers.get('x-twenty-webhook-signature') || '';
  if (!timestamp || !signature) {
    return NextResponse.json({ error: 'Missing Twenty webhook signature headers.' }, { status: 401 });
  }
  try {
    const rawBody = await request.text();
    const result = await acceptTwentyWebhook({ rawBody, timestamp, signature });
    if (!result.accepted) {
      return NextResponse.json({ error: 'Invalid Twenty webhook.', reason: result.reason }, { status: 401 });
    }
    return NextResponse.json({ accepted: true, duplicate: result.duplicate, eventId: result.eventId }, { status: 202 });
  } catch (error) {
    console.error('Twenty webhook acceptance failed:', error);
    return NextResponse.json({ error: 'Unable to accept Twenty webhook.' }, { status: 500 });
  }
}

