import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Rider online request:', body);
    
    // TODO: Verify auth session
    // TODO: Upsert into rider_presence table setting status='online'
    
    return NextResponse.json({ success: true, status: 'online' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to go online' }, { status: 500 });
  }
}
