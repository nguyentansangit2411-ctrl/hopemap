import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: report } = await supabase
    .from('reports')
    .select('title, description, category')
    .eq('id', params.id)
    .single();

  if (!report) {
    return { title: 'Không tìm thấy báo cáo' };
  }

  return {
    title: `${report.title} - HopeMap`,
    description: report.description,
    openGraph: {
      title: `${report.title} | HopeMap`,
      description: report.description,
      type: 'article',
    },
  };
}

export default function ReportDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
