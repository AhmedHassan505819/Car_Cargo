import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // In dev, avoid spamming console with heartbeats unless needed
    // console.log('Heartbeat:', body);
    
    // TODO: Verify auth session
    // TODO: Upsert into rider_presence table with new location and updated_at
    
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to record location' }, { status: 500 });
  }
}
