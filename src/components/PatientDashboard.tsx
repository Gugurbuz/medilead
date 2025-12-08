import React, { useState, useRef } from 'react';
import { Camera, Loader2, FileText, X, Activity, User } from 'lucide-react';
// DÜZELTME: Dosya yolu projenizdeki mevcut yapıya (src/lib) göre güncellendi.
import { processHairImage, type HairAnalysisResult } from '../lib/visionModel';

interface PatientData {
  name: string;
  age: string;
  gender: string;
  complaint: string;
}

export default function PatientDashboard() {
  const [patientData, setPatientData] = useState<PatientData>({
    name: '',
    age: '',
    gender: 'female',
    complaint: ''
  });
  
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<HairAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setPatientData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    // Dosya boyutu kontrolü (Örn: 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Dosya boyutu çok yüksek. Lütfen 5MB altı bir resim yükleyin.");
      return;
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  };

  const handlePatientFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedImage) {
      setError("Lütfen analiz için bir saç fotoğrafı yükleyin.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // processHairImage fonksiyonu src/lib/visionModel.ts içinden çağrılıyor
      const result = await processHairImage(selectedImage, patientData.complaint);
      setAnalysisResult(result);
    } catch (err) {
      console.error("Analiz hatası:", err);
      setError("Analiz başarısız oldu. Lütfen tekrar deneyin veya API anahtarınızı kontrol edin.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="text-blue-600" />
            AI Saç Analiz Paneli
          </h1>
          <p className="text-gray-500 mt-1">Hasta verilerini girin ve AI destekli teşhis alın.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Sol Kolon: Form */}
          <div className="space-y-6">
            <form onSubmit={handlePatientFormSubmit} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Hasta Bilgileri</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    required
                    value={patientData.name}
                    onChange={handleInputChange}
                    className="pl-10 w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Hasta Adı"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Yaş</label>
                  <input
                    type="number"
                    name="age"
                    required
                    value={patientData.age}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cinsiyet</label>
                  <select
                    name="gender"
                    value={patientData.gender}
                    onChange={handleInputChange}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="female">Kadın</option>
                    <option value="male">Erkek</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şikayet / Notlar</label>
                <textarea
                  name="complaint"
                  value={patientData.complaint}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Saç dökülmesi, kaşıntı vb..."
                />
              </div>

              {/* Upload Area */}
              <div 
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                  imagePreview ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageSelect}
                />
                
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="Preview" className="h-48 rounded-lg object-cover" />
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedImage(null);
                        setImagePreview(null);
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full hover:bg-red-600"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="text-sm text-gray-600">Fotoğraf yüklemek için tıklayın veya sürükleyin</p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isAnalyzing || !selectedImage}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Analiz Ediliyor...
                  </>
                ) : (
                  <>
                    <FileText />
                    Analizi Başlat
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Sağ Kolon: Sonuçlar */}
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-start gap-2">
                <div className="mt-1 flex-shrink-0">⚠️</div>
                <p>{error}</p>
              </div>
            )}

            {analysisResult && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Analiz Raporu</h3>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-blue-600">Tespit Edilen Durum</h4>
                    <p className="text-gray-700 mt-1">{analysisResult.condition}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-green-600">Önerilen Tedavi</h4>
                    <p className="text-gray-700 mt-1">{analysisResult.treatment}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-purple-600">Ürün Tavsiyeleri</h4>
                    <ul className="list-disc pl-5 mt-1 text-gray-700 space-y-1">
                      {analysisResult.products.map((product, idx) => (
                        <li key={idx} className="text-sm">
                          {product}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Bakım Rutini</h4>
                    <p className="text-sm text-blue-900">{analysisResult.routine}</p>
                  </div>

                  <div className="text-sm text-gray-500 italic mt-4 border-t pt-4">
                    Note: {analysisResult.notes}
                  </div>
                </div>
              </div>
            )}

            {!analysisResult && !isAnalyzing && !error && (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl p-12">
                <Activity className="h-16 w-16 mb-4 opacity-20" />
                <p>Sonuçlar burada görüntülenecek</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}