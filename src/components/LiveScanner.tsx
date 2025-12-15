import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, RefreshCw, X, User, Sun, Check, AlertCircle,
  SlidersHorizontal, Layers, Activity, Droplets, Sparkles
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Adım Konfigürasyonu
const SCAN_STEPS = [
  { 
    id: 'front', 
    label: 'Ön Görünüm', 
    instruction: 'Doğrudan kameraya bakın', 
    target: { yaw: 0, pitch: 10, roll: 0, yawTolerance: 15, pitchTolerance: 20 }, 
    guideType: 'face'
  },
  { 
    id: 'left', 
    label: 'Sağ Profil', 
    instruction: 'Başınızı yavaşça SOLA çevirin', 
    target: { yaw: -85, pitch: 10, roll: 0, yawTolerance: 15, pitchTolerance: 40 }, 
    guideType: 'face'
  },
  { 
    id: 'right', 
    label: 'Sol Profil', 
    instruction: 'Başınızı yavaşça SAĞA çevirin', 
    target: { yaw: 85, pitch: 10, roll: 0, yawTolerance: 15, pitchTolerance: 40 }, 
    guideType: 'face'
  },
  {
    id: 'top',
    label: 'Tepe Görünümü',
    instruction: 'Telefonu başınızın üstüne tutun ve tepeyi çekin',
    target: null,
    guideType: 'manual'
  },
  { 
    id: 'back', 
    label: 'Donör Bölge (Ense)', 
    instruction: 'Arkanızı dönün', 
    target: null, 
    guideType: 'manual'
  },
];

// Helper: Harici Script Yükleyici
const loadScript = (src: string) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(true);
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

// Basit Slider Bileşeni
const RangeControl = ({ icon: Icon, label, value, onChange, min = 0, max = 200 }: any) => (
  <div className="flex items-center gap-3 w-full bg-black/40 p-2 rounded-lg backdrop-blur-sm">
    <Icon className="w-4 h-4 text-white/70" />
    <div className="flex-1 flex flex-col">
      <div className="flex justify-between text-[10px] text-white/50 uppercase font-medium tracking-wider mb-1">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
      />
    </div>
  </div>
);

interface LiveScannerProps {
  onComplete: (photos: any[]) => void;
  onCancel: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Durum Yönetimi
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<any[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  // Kamera Ayarları
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [activeOverlay, setActiveOverlay] = useState('hairline'); 
  const [showSettings, setShowSettings] = useState(false);

  // Takip Durumu
  const [pose, setPose] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [quality, setQuality] = useState({ lighting: 'good', stability: 'stable', faceDetected: false });
  const [status, setStatus] = useState<'searching' | 'aligning' | 'locked' | 'capturing'>('searching'); 
  const [scanProgress, setScanProgress] = useState(0);
  
  // Referanslar
  const requestRef = useRef<number>();
  const faceMeshRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const currentStep = SCAN_STEPS[currentStepIndex];

  // Temizlik
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();

    return () => {
      isMountedRef.current = false;
      stopCamera();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (faceMeshRef.current) {
        try { faceMeshRef.current.close(); } catch(e) {}
      }
    };
  }, []);

  // Kamerayı Başlat (Native)
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user"
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          // Video başladığında AI'yı tetikle
          initializeAI(); 
        };
      }
    } catch (err) {
      console.error("Kamera hatası:", err);
      setCameraError("Kameraya erişilemedi. Lütfen izin verin.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // AI Başlatma
  const initializeAI = async () => {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js');
      
      if (!(window as any).FaceMesh) throw new Error("FaceMesh yüklenemedi");

      const faceMesh = new (window as any).FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      faceMesh.onResults(onResults);
      faceMeshRef.current = faceMesh;
      
      // AI Döngüsü
      processVideoFrame();
      
    } catch (error) {
      console.error("AI Başlatma Hatası:", error);
      // AI yüklenmese bile manuel modda çalışmaya devam et
      setIsModelLoaded(true); 
    }
  };

  const processVideoFrame = async () => {
    if (!isMountedRef.current) return;
    
    if (videoRef.current && faceMeshRef.current && videoRef.current.readyState >= 2) {
      try {
        await faceMeshRef.current.send({ image: videoRef.current });
      } catch (e) {
        // Hata olursa bir sonraki kareyi dene
      }
    }
    
    // Döngüye devam et (Sadece model yüklendiyse)
    // requestRef.current = requestAnimationFrame(processVideoFrame);
    // NOT: FaceMesh send işlemi async olduğu için requestAnimationFrame yerine
    // send bittiğinde tekrar çağırmak veya belirli aralıklarla çağırmak daha güvenli olabilir.
    // Ancak onResults callback'i çalıştığı sürece akış devam eder.
    
    // Basit bir timeout ile döngü kuralım, çok hızlı çalışıp CPU yormasın
    setTimeout(processVideoFrame, 100);
  };

  // Kafa Pozisyonu Hesaplama
  const calculatePose = (landmarks: any) => {
    if (!landmarks) return null;
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const midEyes = { 
      x: (landmarks[33].x + landmarks[263].x) / 2, 
      y: (landmarks[33].y + landmarks[263].y) / 2 
    };

    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    const noseRelativeX = nose.x - midEyes.x; 
    const yaw = -(noseRelativeX / faceWidth) * 200; // Hassasiyet ayarı

    const faceHeight = Math.abs(landmarks[14].y - midEyes.y);
    const noseRelativeY = nose.y - midEyes.y;
    const pitch = ((noseRelativeY / faceHeight) - 0.4) * 150; 

    return { yaw, pitch, roll: 0 };
  };

  const onResults = useCallback((results: any) => {
    if (!isMountedRef.current || status === 'capturing') return;
    setIsModelLoaded(true);

    const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    // 1. Manuel Mod (Tepe ve Arka)
    if (currentStep.guideType === 'manual') {
      setStatus('locked');
      setQuality(prev => ({ ...prev, faceDetected: hasFace, stability: 'stable' }));
      
      // Işık Kontrolü (Basit)
      if (results.image) {
         // Canvas analizi burada yapılabilir ama performansı düşürebilir
         // Şimdilik varsayılan olarak 'iyi' kabul ediyoruz
         setQuality(q => ({ ...q, lighting: 'good' }));
      }

      if (currentStep.id === 'back' && hasFace) {
        setStatus('aligning'); // Yüz varsa uyar
      } else {
        setScanProgress(prev => Math.min(prev + 2, 100)); // Manuel modda daha yavaş ilerle
      }
      return;
    }

    // 2. Yüz Takip Modu
    if (!hasFace) {
      setQuality(prev => ({ ...prev, faceDetected: false }));
      setStatus('searching');
      setScanProgress(0);
      return;
    }

    setQuality(prev => ({ ...prev, faceDetected: true }));
    const landmarks = results.multiFaceLandmarks[0];
    const headPose = calculatePose(landmarks);
    
    if (headPose) setPose(headPose);

    const { target } = currentStep;
    if (!target) return;

    const yawTol = target.yawTolerance || 15;
    const pitchTol = target.pitchTolerance || 15;

    // Basit Kontrol
    const isYawGood = Math.abs((headPose?.yaw || 0) - target.yaw) < yawTol;
    const isPitchGood = Math.abs((headPose?.pitch || 0) - target.pitch) < pitchTol;

    if (isYawGood && isPitchGood) {
      setStatus('locked');
      setScanProgress(prev => Math.min(prev + 5, 100));
    } else {
      setStatus('aligning');
      setScanProgress(prev => Math.max(0, prev - 5));
    }

  }, [currentStep, status]);

  // Fotoğraf Çekimi
  useEffect(() => {
    if (scanProgress >= 100 && status !== 'capturing') {
      handleCapture();
    }
  }, [scanProgress, status]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;

    setStatus('capturing');

    // Canvas oluştur ve çiz
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Filtreleri uygula
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
      // Aynalama
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Listeye ekle
      const newPhoto = {
        id: Date.now(),
        preview: dataUrl,
        type: currentStep.id
      };
      
      setCapturedImages(prev => [...prev, newPhoto]);
      
      toast({
        title: "Başarılı",
        description: `${currentStep.label} kaydedildi.`,
        duration: 2000
      });

      // Efekt
      const flash = document.createElement('div');
      flash.className = 'fixed inset-0 bg-white z-[100] animate-out fade-out duration-300 pointer-events-none';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 300);

      // Sonraki adıma geç
      setTimeout(() => {
        if (currentStepIndex < SCAN_STEPS.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
          setScanProgress(0);
          setStatus('searching');
        } else {
          // Bitti
          setCapturedImages(currentImages => {
             // State güncellemesi async olduğu için callback içinde son halini alıp gönderiyoruz
             const finalImages = [...currentImages, newPhoto];
             onComplete(finalImages);
             return finalImages;
          });
        }
      }, 1000);
    }

  }, [brightness, contrast, currentStep, currentStepIndex, onComplete, toast]);

  // Arayüz Render
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col text-white overflow-hidden">
      
      {/* 1. Kamera Katmanı (En Altta) */}
      <div className="absolute inset-0 z-0">
        <video 
          ref={videoRef}
          className="w-full h-full object-cover transform scale-x-[-1]"
          playsInline
          muted
          style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
        />
      </div>

      {/* 2. Overlay & Rehber Katmanı */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Kılavuz Çerçevesi */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={{
              borderColor: status === 'locked' ? '#4ade80' : status === 'aligning' ? '#fbbf24' : 'rgba(255,255,255,0.3)',
              scale: status === 'locked' ? 1.02 : 1
            }}
            transition={{ duration: 0.3 }}
            className="w-[85vw] h-[60vh] max-w-[400px] max-h-[550px] border-[3px] rounded-[3rem] relative shadow-2xl"
          >
            {/* Tarama Çizgisi */}
            {(status === 'locked' || status === 'capturing') && (
               <motion.div
                 initial={{ top: "0%" }}
                 animate={{ top: "100%" }}
                 transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                 className="absolute left-0 right-0 h-1 bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.8)]"
               />
            )}
            
            {/* Orta Rehber İkonu */}
            {status === 'searching' && !isModelLoaded && (
               <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="w-12 h-12 animate-spin text-white/50" />
               </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* 3. UI Kontrol Katmanı (En Üstte) */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
        
        {/* Üst Bar */}
        <div className="p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start pointer-events-auto">
          <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
                 ADIM {currentStepIndex + 1}/{SCAN_STEPS.length}
               </span>
               {status === 'locked' && (
                 <span className="text-green-400 text-xs font-bold animate-pulse">HAZIR</span>
               )}
            </div>
            <h2 className="text-2xl font-bold">{currentStep.label}</h2>
          </div>
          <button 
            onClick={onCancel}
            className="p-3 bg-black/40 hover:bg-red-500/80 rounded-full transition-colors backdrop-blur-md"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Hata Mesajı */}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
             <div className="text-center p-6">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Kamera Hatası</h3>
                <p className="text-gray-400">{cameraError}</p>
                <button onClick={onCancel} className="mt-6 bg-white text-black px-6 py-2 rounded-full font-bold">
                  Kapat
                </button>
             </div>
          </div>
        )}

        {/* Alt Bar ve Talimatlar */}
        <div className="p-8 pb-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col items-center pointer-events-auto">
          
          <div className="mb-8 text-center bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
            <h3 className="text-xl font-bold">{currentStep.instruction}</h3>
            {status === 'aligning' && (
               <p className="text-amber-400 text-sm mt-1">Konumunuzu ayarlayın</p>
            )}
          </div>

          {/* İlerleme Halkası ve Buton */}
          <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#374151" strokeWidth="4" />
              <circle 
                cx="40" cy="40" r="36" 
                fill="none" 
                stroke={status === 'locked' ? '#4ade80' : '#6366f1'} 
                strokeWidth="4"
                strokeDasharray={226}
                strokeDashoffset={226 - (226 * scanProgress) / 100}
                strokeLinecap="round"
                className="transition-all duration-200"
              />
            </svg>
            <button
               onClick={handleCapture}
               disabled={status === 'capturing'}
               className="w-14 h-14 bg-white rounded-full flex items-center justify-center active:scale-90 transition-transform"
            >
               {status === 'capturing' ? (
                 <div className="w-3 h-3 bg-black rounded-sm" />
               ) : (
                 <div className="w-10 h-10 border-2 border-black rounded-full" />
               )}
            </button>
          </div>

          {/* Ayarlar Toggle */}
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="absolute right-8 bottom-12 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <SlidersHorizontal className="w-6 h-6" />
          </button>

          {/* Ayarlar Paneli */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-28 left-8 right-8 bg-black/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4"
              >
                <div className="space-y-4">
                  <RangeControl 
                    icon={Sun} 
                    label="Parlaklık" 
                    value={brightness} 
                    onChange={setBrightness} 
                  />
                  <RangeControl 
                    icon={Sparkles} 
                    label="Kontrast" 
                    value={contrast} 
                    onChange={setContrast} 
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
};

export default LiveScanner;