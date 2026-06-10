"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Image from 'next/image';
import { MapPin, Clock, ArrowLeft, Camera, Send, Loader2, CheckCircle, Navigation } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/nextjs';
import toast from 'react-hot-toast';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

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

interface Verification {
  id: string;
  type: string;
  note: string | null;
  created_at: string;
  user_id: string;
  user_profiles: { display_name: string };
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string, color: string }> = {
    'pending': { label: 'Chờ xác minh', color: 'bg-orange-100 text-orange-700' },
    'community_verified': { label: 'Cộng đồng xác minh', color: 'bg-blue-100 text-blue-700' },
    'field_verified': { label: 'Đã khảo sát', color: 'bg-indigo-100 text-indigo-700' },
    'helped': { label: 'Đã được giúp', color: 'bg-green-100 text-green-700' },
    'closed': { label: 'Đã đóng', color: 'bg-gray-100 text-gray-700' },
  };
  const config = map[status] || map['pending'];
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${config.color}`}>
      {config.label}
    </span>
  );
}

export default function ReportDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { userId } = useAuth();
  
  const [report, setReport] = useState<Report | null>(null);
  const [timeline, setTimeline] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | File | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: rData } = await supabase
        .from('reports')
        .select('*')
        .eq('id', params.id)
        .single();
        
      if (rData) setReport(rData);

      const { data: vData } = await supabase
        .from('verifications')
        .select('*, user_profiles(display_name), user_id')
        .eq('report_id', params.id)
        .order('created_at', { ascending: true });

      if (vData) setTimeline(vData);
      setLoading(false);
    }
    fetchData();
  }, [params.id]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const { processAndBlurFaces } = await import('@/lib/imageUtils');
        const blurredBlob = await processAndBlurFaces(file);
        setImageBlob(blurredBlob);
        setPreviewUrl(URL.createObjectURL(blurredBlob));
      } catch (err) {
        console.error("Face blur failed:", err);
        setImageBlob(file);
        setPreviewUrl(URL.createObjectURL(file));
      }
    }
  };

  const handleHelped = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) {
      toast.error('Vui lòng nhập mô tả bạn đã giúp như thế nào.');
      return;
    }
    setIsSubmitting(true);
    
    let uploadedImageUrl = null;
    if (imageBlob) {
      try {
        const cloudinaryData = new FormData();
        cloudinaryData.append('file', imageBlob);
        cloudinaryData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: 'POST', body: cloudinaryData }
        );
        const data = await uploadRes.json();
        uploadedImageUrl = data.secure_url;
      } catch (err) {
        console.error('Image upload failed:', err);
        toast.error('Không thể tải ảnh lên. Vui lòng thử lại.');
        setIsSubmitting(false);
        return;
      }
    }
    
    try {
      const res = await fetch(`/api/reports/${params.id}/help`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          note, 
          image_url: uploadedImageUrl
        })
      });
      
      if (res.ok) {
        toast.success('Đã gửi xác nhận giúp đỡ!');
        window.location.reload();
      } else {
        toast.error('Có lỗi xảy ra.');
      }
    } catch {
      toast.error('Lỗi mạng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpvote = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/reports/${params.id}/upvote`, { method: 'POST' });
      if (res.ok) {
        toast.success('Cảm ơn bạn đã xác minh thông tin!');
        window.location.reload();
      } else {
        toast.error('Bạn đã xác minh rồi hoặc có lỗi xảy ra.');
      }
    } catch {
      toast.error('Lỗi mạng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-500 font-medium animate-pulse">Đang tải thông tin...</p>
      </div>
    );
  }

  if (!report) return <div className="p-8 text-center text-gray-500">Không tìm thấy báo cáo.</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      <header className="bg-white px-4 py-4 shadow-sm sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 line-clamp-1 flex-1">Chi tiết</h1>
      </header>

      <main className="max-w-xl mx-auto">
        {/* Report Info */}
        <section className="bg-white p-5 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={report.status} />
              {timeline.filter(v => v.type === 'community').length > 0 && (
                <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1">
                  👍 {timeline.filter(v => v.type === 'community').length} Xác minh
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {timeAgo(report.created_at)}
            </span>
          </div>
          
          <h2 className="text-2xl font-black text-gray-900 mb-2 leading-tight">{report.title}</h2>
          
          <div className="flex items-center gap-2 text-blue-600 bg-blue-50 w-fit px-3 py-1.5 rounded-lg text-sm font-semibold mb-4">
            <Navigation className="w-4 h-4" />
            <span>{report.category}</span>
          </div>

          <p className="text-gray-700 text-base leading-relaxed mb-6 whitespace-pre-wrap">
            {report.description}
          </p>

          <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-100">
            <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
            <span>Tọa độ: {report.lat.toFixed(5)}, {report.lng.toFixed(5)}</span>
            <a 
              href={`https://www.google.com/maps/dir/?api=1&destination=${report.lat},${report.lng}`} 
              target="_blank"
              className="ml-auto text-blue-600 font-bold bg-white px-3 py-1 rounded-lg border border-blue-200 shadow-sm"
            >
              Chỉ đường
            </a>
          </div>
        </section>

        {/* Timeline */}
        <section className="p-5">
          <h3 className="font-bold text-lg text-gray-900 mb-6">Dòng thời gian</h3>
          
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            {/* Initial Report Node */}
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-blue-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
                <Clock className="w-4 h-4" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-slate-900 text-sm">Đã tạo báo cáo</div>
                  <time className="text-xs text-slate-500">{timeAgo(report.created_at)}</time>
                </div>
              </div>
            </div>

            {/* Verifications/Helps Nodes */}
            {timeline.map(v => {
              let parsedNote = { text: v.note, image_url: null };
              try {
                if (v.note && v.note.startsWith('{')) {
                  parsedNote = JSON.parse(v.note);
                }
              } catch {}

              const isHelped = v.type === 'field';
              
              return (
                <div key={v.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${isHelped ? 'bg-green-500' : 'bg-indigo-500'}`}>
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-bold text-slate-900 text-sm">
                        {v.user_profiles?.display_name || 'Người dùng'} 
                        <span className="font-normal text-slate-500 ml-1">
                          {isHelped ? 'đã giúp đỡ' : 'đã xác minh'}
                        </span>
                      </div>
                      <time className="text-xs text-slate-500">{timeAgo(v.created_at)}</time>
                    </div>
                    {parsedNote.text && (
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">&quot;{parsedNote.text}&quot;</p>
                    )}
                    {parsedNote.image_url && (
                      <div className="relative mt-3 w-full h-32 rounded-lg border border-gray-200 overflow-hidden">
                        <Image src={parsedNote.image_url} alt="After" fill className="object-cover" unoptimized />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Call to Action (Upvote / Help) */}
        {report.status !== 'helped' && report.status !== 'closed' && (
          <section className="bg-white p-5 border-t border-gray-200 mt-4 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
            <h3 className="font-black text-lg text-gray-900 mb-4">Bạn muốn hỗ trợ?</h3>
            
            <SignedIn>
              {report.status === 'pending' && (
                timeline.some(v => v.type === 'community' && v.user_id === userId) ? (
                  <div className="w-full bg-indigo-100 text-indigo-700 font-bold p-4 rounded-xl mb-4 border border-indigo-200 text-center opacity-75">
                    <CheckCircle className="w-5 h-5 inline-block mr-2" />
                    Bạn đã xác minh
                  </div>
                ) : (
                  <button 
                    onClick={handleUpvote}
                    disabled={isSubmitting}
                    className="w-full bg-indigo-50 text-indigo-700 font-bold p-4 rounded-xl mb-4 border border-indigo-100 hover:bg-indigo-100 transition-colors flex justify-center items-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" /> 
                    Xác minh có thật (Cộng đồng)
                  </button>
                )
              )}

              <form onSubmit={handleHelped} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Tôi đã giúp người này</label>
                  <textarea 
                    placeholder="Mô tả bạn đã tặng gì, giúp như thế nào..."
                    required
                    rows={3}
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>
                
                <div>
                  <label className="flex items-center justify-center gap-2 w-full p-4 border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 text-gray-600 font-medium active:bg-gray-100">
                    <Camera className="w-5 h-5" />
                    {previewUrl ? 'Đổi ảnh khác' : 'Chụp ảnh minh chứng (tùy chọn)'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                  {previewUrl && (
                    <img src={previewUrl} className="mt-3 w-full h-40 object-cover rounded-xl shadow-sm border border-gray-200" alt="Preview" />
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting || !note}
                  className="w-full bg-green-600 text-white font-bold p-4 rounded-xl shadow-lg shadow-green-600/30 active:scale-95 transition-transform flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                >
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  Đăng cập nhật & Đóng ca này
                </button>
              </form>
            </SignedIn>
            <SignedOut>
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-center">
                <p className="text-gray-600 mb-4 text-sm font-medium">Bạn cần đăng nhập để xác minh hoặc cập nhật trạng thái đã giúp đỡ.</p>
                <SignInButton mode="modal">
                  <button className="bg-blue-600 text-white font-bold px-8 py-3 rounded-full shadow-lg hover:bg-blue-700 transition-colors">
                    Đăng nhập ngay
                  </button>
                </SignInButton>
              </div>
            </SignedOut>
          </section>
        )}
      </main>
    </div>
  );
}
