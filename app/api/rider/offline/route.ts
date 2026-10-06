import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    console.log('Rider offline request received');
    
    // TODO: Verify auth session
    // TODO: Update rider_presence table setting status='busy' or remove row
    
    return NextResponse.json({ success: true, status: 'offline' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to go offline' }, { status: 500 });
  }
}
