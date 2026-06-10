"use client";

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';
import { Plus, Navigation, Clock, Tag, Loader2 } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/nextjs';
import NotificationBell from './NotificationBell';

// Default HCM City coordinates
const DEFAULT_CENTER: [number, number] = [10.762622, 106.660172];

// Supabase client (Anon key is safe for public reading based on our RLS)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Custom Icons for categories using Leaflet DivIcon
const createCustomIcon = (color: string, emoji: string, isPending: boolean = false) => {
  return new L.DivIcon({
    html: `
      <div style="background-color: ${isPending ? '#f3f4f6' : color}; width: 36px; height: 36px; border-radius: 50%; border: 3px solid ${isPending ? color : 'white'}; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.2); opacity: ${isPending ? '0.8' : '1'};">
        <span style="font-size: 18px; ${isPending ? 'filter: grayscale(50%);' : ''}">${emoji}</span>
      </div>
      <div style="width: 0; height: 0; border-left: 8px solid transparent; border-right: 8px solid transparent; border-top: 10px solid ${isPending ? color : color}; position: absolute; bottom: -8px; left: 10px; opacity: ${isPending ? '0.8' : '1'};"></div>
    `,
    className: 'custom-leaflet-icon',
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -46],
  });
};

const getCategoryIcon = (category: string, isPending: boolean) => {
  const map: Record<string, { color: string, emoji: string }> = {
    'Người vô gia cư': { color: '#3b82f6', emoji: '🏠' },
    'Cụ già bệnh': { color: '#ef4444', emoji: '❤️' },
    'Trẻ em lang thang': { color: '#f59e0b', emoji: '🧸' },
    'Khác': { color: '#6b7280', emoji: '📌' },
  };
  const config = map[category] || map['Khác'];
  return createCustomIcon(config.color, config.emoji, isPending);
};

const USER_ICON = new L.DivIcon({
  html: `
    <div style="background-color: #22c55e; width: 24px; height: 24px; border-radius: 50%; border: 4px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>
  `,
  className: 'user-leaflet-icon',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

// Calculate distance in km between two lat/lng points using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);  
  const dLon = (lon2 - lon1) * (Math.PI / 180); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

// Time ago formatter
function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Vừa xong';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} phút trước`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} giờ trước`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} ngày trước`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string, color: string }> = {
    'pending': { label: 'Chờ duyệt', color: 'bg-orange-100 text-orange-700' },
    'community_verified': { label: 'Cộng đồng XN', color: 'bg-blue-100 text-blue-700' },
    'field_verified': { label: 'Đã khảo sát', color: 'bg-indigo-100 text-indigo-700' },
    'helped': { label: 'Đã được giúp', color: 'bg-green-100 text-green-700' },
    'closed': { label: 'Đã đóng', color: 'bg-gray-100 text-gray-700' },
  };
  const config = map[status] || map['pending'];
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${config.color} shrink-0`}>
      {config.label}
    </span>
  );
}

// Map center controller component
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, { animate: true, duration: 1.5 });
  }, [center, map]);
  return null;
}

interface Report {
  id: string;
  lat: number;
  lng: number;
  category: 'người vô gia cư' | 'cụ già bệnh' | 'trẻ em lang thang' | 'khác';
  status: string;
  title: string;
  description: string;
  created_at: string;
  verifications?: [{ count: number }];
}

export default function Map() {
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  // 1. Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation([position.coords.latitude, position.coords.longitude]);
          setLoadingLocation(false);
        },
        () => {
          // If denied/failed, stick to default
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setLoadingLocation(false);
    }
  }, []);

  // 2. Fetch reports from Supabase (filter within 5km if user location exists)
  useEffect(() => {
    async function fetchReports() {
      // Fetch pending, community_verified, field_verified, and helped reports
      const { data, error } = await supabase
        .from('reports')
        .select('*, verifications(count)')
        .in('status', ['pending', 'community_verified', 'field_verified', 'helped'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reports:', error);
        setLoadingReports(false);
        return;
      }

      if (data) {
        if (userLocation) {
          // Filter within 5km
          const nearbyReports = data.filter(report => {
            const dist = getDistanceFromLatLonInKm(userLocation[0], userLocation[1], report.lat, report.lng);
            return dist <= 5; // 5km radius
          });
          setReports(nearbyReports);
        } else {
          // If no GPS, just show top 50 recent verified reports globally
          setReports(data.slice(0, 50));
        }
        setLoadingReports(false);
      }
    }

    if (!loadingLocation) {
      fetchReports();
    }
  }, [userLocation, loadingLocation]);

  const mapCenter = userLocation || DEFAULT_CENTER;

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-gray-100">
      <MapContainer 
        center={mapCenter} 
        zoom={14} 
        zoomControl={false}
        className="w-full h-full z-0"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        
        {/* Dynamic map center updater */}
        <MapController center={mapCenter} />

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={USER_ICON}>
            <Popup className="font-sans">
              <p className="font-bold text-center m-0">Vị trí của bạn</p>
            </Popup>
          </Marker>
        )}

        {/* Report Markers */}
        {reports.map((report) => {
          const isPending = report.status === 'pending';
          const icon = getCategoryIcon(report.category, isPending);
          const upvotes = report.verifications?.[0]?.count || 0;
          return (
            <Marker key={report.id} position={[report.lat, report.lng]} icon={icon}>
              <Popup className="font-sans min-w-[200px] !p-0 overflow-hidden rounded-xl">
                <div className="p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <StatusBadge status={report.status} />
                    {upvotes > 0 && (
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full shrink-0 flex items-center gap-1">
                        👍 {upvotes}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 flex items-center gap-1 ml-auto shrink-0">
                      <Clock className="w-3 h-3" />
                      {timeAgo(report.created_at)}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-base mb-1 mt-1 leading-tight line-clamp-1">{report.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-relaxed">
                    {report.description || 'Không có mô tả chi tiết'}
                  </p>
                  
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                      <Tag className="w-3 h-3" />
                      {report.category}
                    </div>
                    <Link href={`/reports/${report.id}`} className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
                      Xem & Giúp
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Overlays / UI Elements */}
      
      {/* Search / Top Bar (Optional UI placeholder) */}
      <div className="absolute top-4 left-4 right-4 z-[1000] pointer-events-none">
        <div className="bg-white/90 backdrop-blur-md shadow-lg rounded-2xl p-4 flex items-center justify-between pointer-events-auto border border-white/50">
          <div>
            <h1 className="font-black text-xl text-blue-600 tracking-tight">HopeMap</h1>
            <p className="text-xs text-gray-500 font-medium">Bản đồ từ thiện TP.HCM</p>
          </div>
          <div className="flex items-center gap-3">
            {userLocation && (
               <div className="bg-green-100 text-green-700 p-2 rounded-full">
                 <Navigation className="w-4 h-4" />
               </div>
            )}
            <SignedIn>
              <NotificationBell />
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal" fallbackRedirectUrl="/report">
                <button className="text-sm font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                  Đăng nhập
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loadingReports && (
        <div className="absolute inset-0 z-[500] bg-white/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <p className="text-gray-600 font-medium">Đang tải dữ liệu bản đồ...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loadingReports && reports.length === 0 && (
        <div className="absolute inset-0 z-[500] flex items-center justify-center pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl max-w-[80%] text-center border border-gray-100 flex flex-col items-center gap-2">
            <div className="text-4xl mb-2">🌍</div>
            <h2 className="font-bold text-gray-900">Chưa có hoàn cảnh nào gần đây</h2>
            <p className="text-sm text-gray-500">Bạn có thể là người đầu tiên báo cáo và giúp đỡ mọi người xung quanh!</p>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-[1000] pointer-events-none">
        <Link 
          href="/report"
          className="pointer-events-auto bg-blue-600 text-white font-bold text-lg px-8 py-4 rounded-full shadow-2xl shadow-blue-500/40 flex items-center gap-2 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
          Báo cáo hoàn cảnh
        </Link>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .leaflet-popup-content-wrapper { border-radius: 12px; padding: 0; overflow: hidden; }
        .leaflet-popup-content { margin: 0; width: 100% !important; }
        .leaflet-container { font-family: inherit; }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}} />
    </div>
  );
}
