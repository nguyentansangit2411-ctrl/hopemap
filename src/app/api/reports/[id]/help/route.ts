import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const reportId = params.id;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { note, image_url } = body;
    
    // Store as JSON in note column to bypass schema limits for now
    const notePayload = JSON.stringify({ text: note || 'Đã giúp đỡ hoàn cảnh này.', image_url: image_url || null });

    // Insert verification
    const { error: insertError } = await supabase
      .from('verifications')
      .insert({
        report_id: reportId,
        user_id: userId,
        type: 'field', // Used as "helped" indicator in MVP
        note: notePayload
      });

    if (insertError && insertError.code !== '23505') {
       return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Update the report status to helped and select user_id
    const { error, data: updatedReport } = await supabase
      .from('reports')
      .update({ 
        status: 'helped',
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select('user_id')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (updatedReport?.user_id) {
      await supabase.from('notifications').insert({
        user_id: updatedReport.user_id,
        content: 'Hoàn cảnh bạn báo cáo đã được giúp đỡ!',
        is_read: false
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
