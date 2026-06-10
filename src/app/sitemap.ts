import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://hopemap.vn';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Fetch all public reports
  const { data: reports } = await supabase
    .from('reports')
    .select('id, updated_at, status')
    .order('updated_at', { ascending: false });

  const reportUrls: MetadataRoute.Sitemap = (reports || []).map((report) => ({
    url: `${baseUrl}/reports/${report.id}`,
    lastModified: report.updated_at,
    changeFrequency: report.status === 'closed' ? 'yearly' : 'daily',
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/report`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.9,
    },
    ...reportUrls,
  ];
}
