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
    // 0. Ensure user profile exists (upsert)
    await supabase.from('user_profiles').upsert([
      { id: userId, display_name: 'Người dùng' }
    ], { onConflict: 'id' });

    // 0.5. Check if user already upvoted
    const { data: existing } = await supabase
      .from('verifications')
      .select('id')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .eq('type', 'community')
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Bạn đã xác minh báo cáo này rồi' }, { status: 400 });
    }

    // 1. Insert verification (community type)
    const { error: insertError } = await supabase
      .from('verifications')
      .insert({
        report_id: reportId,
        user_id: userId,
        type: 'community'
      });

    // Ignore duplicate key error (user already upvoted)
    if (insertError && insertError.code !== '23505') {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // 2. Count total community verifications
    const { count, error: countError } = await supabase
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .eq('report_id', reportId)
      .eq('type', 'community');

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // 3. If >= 3 upvotes, update status to community_verified (if it's still pending)
    if (count && count >= 3) {
      // Fetch current status to ensure we don't downgrade a field_verified report
      const { data: report } = await supabase
        .from('reports')
        .select('status')
        .eq('id', reportId)
        .single();

      if (report && report.status === 'pending') {
        await supabase
          .from('reports')
          .update({ 
            status: 'community_verified',
            updated_at: new Date().toISOString()
          })
          .eq('id', reportId);
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
