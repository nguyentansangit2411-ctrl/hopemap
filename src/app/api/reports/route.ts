import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
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
    const { title, description, category, lat, lng, image_url, user_id, force } = body;

    // Validate required fields
    if (!title || lat === undefined || lng === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: title, lat, and lng are required.' },
        { status: 400 }
      );
    }

    if (!user_id) {
      return NextResponse.json(
        { error: 'Missing required field: user_id is required.' },
        { status: 400 }
      );
    }

    // Duplicate detection
    if (!force) {
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: recentReports } = await supabase
        .from('reports')
        .select('id, lat, lng')
        .gte('created_at', twoDaysAgo);

      if (recentReports && recentReports.length > 0) {
        const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const R = 6371e3; // metres
          const phi1 = (lat1 * Math.PI) / 180;
          const phi2 = (lat2 * Math.PI) / 180;
          const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
          const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

          const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                    Math.cos(phi1) * Math.cos(phi2) *
                    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return R * c;
        };

        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        const duplicate = recentReports.find(r => getDistance(parsedLat, parsedLng, r.lat, r.lng) <= 20);

        if (duplicate) {
          return NextResponse.json({
            isDuplicate: true,
            duplicateId: duplicate.id,
            message: 'Có vẻ hoàn cảnh này đã được báo cáo'
          }, { status: 409 });
        }
      }
    }

    // Tự động upsert user profile để tránh lỗi khóa ngoại (MVP: thay cho Webhook)
    await supabase.from('user_profiles').upsert([
      { id: user_id, display_name: 'Người dùng' }
    ], { onConflict: 'id' });

    // Insert into Supabase
    const { data, error } = await supabase
      .from('reports')
      .insert([
        {
          user_id,
          title,
          description: description || null,
          category: category || 'Khác',
          lat: parseFloat(lat),
          lng: parseFloat(lng),
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
