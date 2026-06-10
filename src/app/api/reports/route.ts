import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// Use the service role key to bypass RLS in the server-side API,
// as the user_id is provided in the request body.
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { title, description, category, lat, lng, image_url, user_id } = body;

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
