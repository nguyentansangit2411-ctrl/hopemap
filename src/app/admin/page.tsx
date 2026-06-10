"use client";

import { useState, useEffect, useCallback } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Clock, MapPin, CheckCircle, XCircle, Eye, Loader2, RefreshCw } from 'lucide-react';
import PullToRefresh from 'react-simple-pull-to-refresh';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface Report {
  id: string;
  title: string;
  description: string;
  category: 'người vô gia cư' | 'cụ già bệnh' | 'trẻ em lang thang' | 'khác';
  status: string;
  lat: number;
  lng: number;
  image_url: string | null;
  created_at: string;
}

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

export default function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, community_verified, field_verified, helped
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      // If user selects 'verified', we can map it to 'field_verified' or 'community_verified'
      // Based on prompt: Filter by status: pending | verified | helped
      // The prompt asks to map Approve -> community_verified. 
      // Let's use exact DB statuses for the tabs to be safe and clear.
      let queryStatus = filter;
      if (filter === 'verified') queryStatus = 'community_verified';

      const res = await fetch(`/api/admin/reports?status=${queryStatus}`);
      const json = await res.json();
      if (json.data) {
        setReports(json.data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleAction = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) {
        // Remove the item from the current list since its status changed
        setReports(prev => prev.filter(r => r.id !== id));
        toast.success('Cập nhật trạng thái thành công!');
      } else {
        toast.error('Có lỗi xảy ra khi cập nhật.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Lỗi kết nối.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-black text-blue-600">HopeMap Admin</h1>
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-md">Internal Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={fetchReports}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Tải lại"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <UserButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <PullToRefresh onRefresh={fetchReports}>
          <div>
            {/* Filters */}
            <div className="flex gap-2 mb-6">
              {[
                { id: 'pending', label: 'Chờ duyệt (Pending)' },
                { id: 'verified', label: 'Đã duyệt (Verified)' },
                { id: 'helped', label: 'Đã giúp (Helped)' },
                { id: 'closed', label: 'Từ chối (Closed)' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === tab.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p>Đang tải dữ liệu...</p>
              </div>
            ) : reports.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
                <p className="text-lg">Không có báo cáo nào ở trạng thái này.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-wider text-gray-500">
                      <th className="p-4 font-bold">Hình ảnh</th>
                      <th className="p-4 font-bold">Thông tin báo cáo</th>
                      <th className="p-4 font-bold">Phân loại</th>
                      <th className="p-4 font-bold">Thời gian</th>
                      <th className="p-4 font-bold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reports.map(report => (
                      <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 align-top w-24">
                          {report.image_url ? (
                            <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                              <Image src={report.image_url} alt="thumbnail" fill className="object-cover" unoptimized />
                            </div>
                          ) : (
                            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 text-xs text-gray-400">
                              No Img
                            </div>
                          )}
                        </td>
                        <td className="p-4 align-top">
                          <h3 className="font-bold text-gray-900 text-base mb-1">{report.title}</h3>
                          <div className="flex items-center gap-1 text-sm text-gray-500 mb-2">
                            <MapPin className="w-3 h-3" />
                            <span>{report.lat.toFixed(4)}, {report.lng.toFixed(4)}</span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2">{report.description}</p>
                        </td>
                        <td className="p-4 align-top">
                          <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-md">
                            {report.category}
                          </span>
                        </td>
                        <td className="p-4 align-top">
                          <div className="flex items-center gap-1 text-sm text-gray-500">
                            <Clock className="w-3 h-3" />
                            <span>{timeAgo(report.created_at)}</span>
                          </div>
                        </td>
                        <td className="p-4 align-top text-right">
                          <div className="flex flex-col gap-2 items-end">
                            <button className="flex items-center gap-1 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors">
                              <Eye className="w-4 h-4" /> Chi tiết
                            </button>

                            {filter === 'pending' && (
                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => handleAction(report.id, 'closed')}
                                  disabled={actionLoading === report.id}
                                  className="flex items-center gap-1 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                >
                                  <XCircle className="w-4 h-4" /> Từ chối
                                </button>
                                <button
                                  onClick={() => handleAction(report.id, 'community_verified')}
                                  disabled={actionLoading === report.id}
                                  className="flex items-center gap-1 text-sm font-bold text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {actionLoading === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                  Duyệt (Cộng đồng)
                                </button>
                              </div>
                            )}

                            {filter === 'verified' && (
                              <button
                                onClick={() => handleAction(report.id, 'field_verified')}
                                disabled={actionLoading === report.id}
                                className="flex items-center gap-1 text-sm font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50 mt-2"
                              >
                                {actionLoading === report.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                Duyệt (Thực địa)
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PullToRefresh>
      </main>
    </div>
  );
}
