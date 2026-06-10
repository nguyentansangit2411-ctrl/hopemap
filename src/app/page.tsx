import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

// Leaflet uses window/document, so it must be dynamically imported with ssr: false
const MapComponent = dynamic(() => import('@/components/Map'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[100dvh] flex flex-col items-center justify-center bg-gray-50 text-blue-600 gap-3">
      <Loader2 className="w-8 h-8 animate-spin" />
      <p className="font-medium animate-pulse">Đang tải bản đồ...</p>
    </div>
  )
});

export default function Home() {
  return (
    <main>
      <MapComponent />
    </main>
  );
}
