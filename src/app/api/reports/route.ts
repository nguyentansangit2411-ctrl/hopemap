import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Khởi tạo Supabase client BÊN TRONG function để tránh lỗi khi build trên Vercel
  // do lúc build tĩnh (static generation), Vercel chưa load các biến môi trường này
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Thiếu cấu hình Supabase trên Server' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);
  try {
    const body = await req.json();
    const { title, description, category, lat, lng, image_url, force } = body;

    // Validate required fields
    if (!title || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: title, lat, and lng are required.' },
        { status: 400 }
      );
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    // Duplicate detection
    if (!force) {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: nearby } = await supabase.rpc('find_nearby_reports', {
        input_lat: parsedLat,
        input_lng: parsedLng,
        radius_meters: 20,
        since: twoDaysAgo
      });

      if (nearby && nearby.length > 0) {
        return NextResponse.json({
          isDuplicate: true,
          duplicateId: nearby[0].id,
          message: 'Có vẻ hoàn cảnh này đã được báo cáo'
        }, { status: 409 });
      }
    }

    // Tự động upsert user profile để tránh lỗi khóa ngoại (MVP: thay cho Webhook)
    await supabase.from('user_profiles').upsert([
      { id: userId, display_name: 'Người dùng' }
    ], { onConflict: 'id' });

    // Insert into Supabase
    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          user_id: userId,
          title,
          description: description || null,
          category: category || 'Khác',
          lat: parsedLat,
          lng: parsedLng,
          image_url: image_url || null,
          status: 'pending',
        },
      ])
      .select('id')
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to create report.', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Report created successfully', id: data.id },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Error in POST /api/reports:', err);
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}
