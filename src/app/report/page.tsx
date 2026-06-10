"use client";

import { useState } from 'react';
import { Camera, MapPin, Send, Loader2 } from 'lucide-react';
import { UserButton, useAuth } from '@clerk/nextjs';

const CATEGORIES = [
  'Người vô gia cư',
  'Cụ già bệnh',
  'Trẻ em lang thang',
  'Khác'
];

export default function ReportPage() {
  const { userId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    lat: '',
    lng: '',
    manualAddress: '',
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleLocation = () => {
    setLocationLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData({
            ...formData,
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString(),
          });
          setLocationLoading(false);
        },
        () => {
          alert('Không thể lấy vị trí. Vui lòng bật GPS hoặc nhập thủ công.');
          setLocationLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      alert('Trình duyệt của bạn không hỗ trợ GPS.');
      setLocationLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      alert('Vui lòng chọn phân loại');
      return;
    }
    setLoading(true);
    
    // TODO: Upload image to Cloudinary (Tạm thời bỏ qua)
    
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description + (formData.manualAddress ? `\nĐịa chỉ: ${formData.manualAddress}` : ''),
          category: formData.category,
          lat: formData.lat,
          lng: formData.lng,
          image_url: null, // Chưa upload ảnh
          user_id: userId, // Dùng ID thật từ Clerk
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Lỗi hệ thống');
      }

      setLoading(false);
      alert('Báo cáo thành công! Cảm ơn bạn.');
      // reset form
      setFormData({
        title: '',
        description: '',
        category: '',
        lat: '',
        lng: '',
        manualAddress: '',
      });
      setImage(null);
      setPreviewUrl(null);
    } catch (error: any) {
      setLoading(false);
      alert('Lỗi: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white px-4 py-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Báo cáo hoàn cảnh</h1>
          <p className="text-sm text-gray-500 mt-1">Giúp đỡ những người quanh bạn</p>
        </div>
        <UserButton />
      </header>

      <main className="p-4 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Image Upload */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">Hình ảnh (Tuỳ chọn)</label>
            <div className="relative">
              {previewUrl ? (
                <div className="relative w-full h-48 rounded-xl overflow-hidden shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  <button 
                    type="button" 
                    onClick={() => { setImage(null); setPreviewUrl(null); }}
                    className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full backdrop-blur-sm"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-xl bg-white cursor-pointer active:bg-gray-50 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500 font-medium">Chụp ảnh hoặc tải lên</p>
                  </div>
                  <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </section>

          {/* Title */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tiêu đề ngắn <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              required
              placeholder="VD: Cụ già bán vé số góc ngã tư..."
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </section>

          {/* Category */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phân loại <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFormData({...formData, category: cat})}
                  className={`p-4 rounded-xl border text-sm font-semibold transition-all ${
                    formData.category === cat 
                      ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                      : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </section>

          {/* Location */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vị trí <span className="text-red-500">*</span></label>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLocation}
                disabled={locationLoading}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-100 text-blue-700 font-semibold active:bg-blue-200 transition-colors"
              >
                {locationLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                {locationLoading ? 'Đang định vị...' : 'Lấy vị trí tự động GPS'}
              </button>
              
              <div className="flex gap-3">
                <input 
                  type="text" 
                  placeholder="Vĩ độ (Lat)"
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none"
                  value={formData.lat}
                  onChange={(e) => setFormData({...formData, lat: e.target.value})}
                  required
                />
                <input 
                  type="text" 
                  placeholder="Kinh độ (Lng)"
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none"
                  value={formData.lng}
                  onChange={(e) => setFormData({...formData, lng: e.target.value})}
                  required
                />
              </div>

              <input 
                type="text" 
                placeholder="Nhập địa chỉ chi tiết (nếu có)"
                className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base"
                value={formData.manualAddress}
                onChange={(e) => setFormData({...formData, manualAddress: e.target.value})}
              />
            </div>
          </section>

          {/* Description */}
          <section>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả chi tiết</label>
            <textarea 
              rows={3}
              placeholder="Nhập thông tin nhận dạng, tình trạng sức khoẻ..."
              className="w-full p-4 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base resize-none"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </section>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !formData.lat || !formData.category}
            className="w-full flex items-center justify-center gap-2 p-4 rounded-xl bg-blue-600 text-white font-bold text-lg active:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 mt-8"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
            {loading ? 'Đang gửi...' : 'Gửi báo cáo'}
          </button>
          
        </form>
      </main>
    </div>
  );
}
