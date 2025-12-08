import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, RefreshCw, X, Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';


// --- TİP VE SABİTLER ---

interface ScanStep {
  id: string;
  label: string;
  instruction: string;
  subInstruction?: string;
  target: { yaw: number; pitch: number; roll: number; tolerance: number } | null;
  guideType: 'face' | 'manual';
  guideShape: 'oval' | 'circle' | 'rect';
}

interface CapturedPhoto {
  id: number;
  preview: string;
  type: string;
  hairAnalysis?: {
    hairCoverageRatio: number; // 0-1
    hairCoveragePercent: number; // 0-100
  };
}

const SCAN_STEPS: ScanStep[] = [
  { 
    id: 'front', 
    label: 'Ön Görünüm', 
    instruction: 'Kameraya Düz Bakın', 
    subInstruction: 'Yüzünüzü çerçevenin ortasına yerleştirin',
    target: { yaw: 0, pitch: 10, roll: 0, tolerance: 12 }, 
    guideType: 'face',
    guideShape: 'oval'
  },
  { 
    id: 'left', 
    label: 'Sağ Profil', 
    instruction: 'Başınızı SOLA Çevirin', 
    subInstruction: 'Kulağınızı görene kadar yavaşça dönün',
    target: { yaw: -50, pitch: 5, roll: 0, tolerance: 20 }, 
    guideType: 'face',
    guideShape: 'oval'
  },
  { 
    id: 'right', 
    label: 'Sol Profil', 
    instruction: 'Başınızı SAĞA Çevirin', 
    subInstruction: 'Kulağınızı görene kadar yavaşça dönün',
    target: { yaw: 50, pitch: 5, roll: 0, tolerance: 20 }, 
    guideType: 'face',
    guideShape: 'oval'
  },
  {
    id: 'top',
    label: 'Tepe Görünümü',
    instruction: 'Başınızı Öne Eğerek Tepeyi Gösterin',
    subInstruction: 'Saç dipleriniz net görünecek şekilde',
    target: null,
    guideType: 'manual',
    guideShape: 'circle'
  },
  { 
    id: 'back', 
    label: 'Donör Bölge (Ense)', 
    instruction: 'Arkanızı Dönün', 
    subInstruction: 'Ense köklerinizi kameraya tutun',
    target: null, 
    guideType: 'manual',
    guideShape: 'rect'
  },
];

// Helper: Script Yükleyici (MediaPipe için)
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

// --- GÖRSEL REHBER BİLEŞENİ (UX) ---
const GuideOverlay = ({ shape, status }: { shape: string, status: string }) => {
  const getColor = () => {
    if (status === 'locked') return '#4ade80'; // Yeşil
    if (status === 'countdown') return '#4ade80'; // Yeşil
    if (status === 'aligning') return '#fbbf24'; // Sarı
    return 'rgba(255, 255, 255, 0.3)'; // Beyaz/Şeffaf
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300">
      <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id="guide-mask">
            <rect width="100%" height="100%" fill="white" />
            {shape === 'oval' && (
              <ellipse cx="200" cy="280" rx="130" ry="170" fill="black" />
            )}
            {shape === 'circle' && (
              <circle cx="200" cy="300" r="140" fill="black" />
            )}
            {shape === 'rect' && (
               <rect x="50" y="150" width="300" height="300" rx="40" fill="black" />
            )}
          </mask>
        </defs>
        
        {/* Karartılmış Arka Plan (Focus Effect) */}
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#guide-mask)" />
        
        {/* Çerçeve Çizgisi */}
        {shape === 'oval' && (
          <ellipse cx="200" cy="280" rx="130" ry="170" fill="none" stroke={getColor()} strokeWidth="3" strokeDasharray="10 5" />
        )}
        {shape === 'circle' && (
           <circle cx="200" cy="300" r="140" fill="none" stroke={getColor()} strokeWidth="3" strokeDasharray="10 5" />
        )}
        {shape === 'rect' && (
            <rect x="50" y="150" width="300" height="300" rx="40" fill="none" stroke={getColor()} strokeWidth="3" strokeDasharray="10 5" />
        )}
      </svg>
    </div>
  );
};

interface LiveScannerProps {
  onComplete: (photos: CapturedPhoto[]) => void;
  onCancel: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  // State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedPhoto[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false); // FaceMesh için

  // Hair segmentation modeli için state
  const [isHairModelReady, setIsHairModelReady] = useState(false);
  const hairSessionRef = useRef<ort.InferenceSession | null>(null);

  // Logic State
  const [status, setStatus] = useState<'searching' | 'aligning' | 'locked' | 'countdown' | 'capturing'>('searching'); 
  const [guidanceMessage, setGuidanceMessage] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showManualButton, setShowManualButton] = useState(false);
  
  // Refs (Zamanlayıcı ve Kilitler)
  const faceMeshRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastProcessTimeRef = useRef(0);
  const manualTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCapturingRef = useRef(false); // Çift tıklama koruması

  // Güvenlik kontrolü: Eğer index dışına çıkılırsa crash olmasını engelle
  const currentStep = SCAN_STEPS[currentStepIndex];

  // --- INIT & CLEANUP ---
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    startManualButtonTimer();
    loadHairModel(); // ONNX saç modeli burada yükleniyor

    return () => {
      isMountedRef.current = false;
      stopCamera();
      if (faceMeshRef.current) {
        try { faceMeshRef.current.close(); } catch(e) {}
      }
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Adım değiştiğinde resetleme
  useEffect(() => {
    setStatus('searching');
    setGuidanceMessage("");
    setCountdown(null);
    setShowManualButton(false);
    isCapturingRef.current = false; // Kilidi aç
    
    // Önceki zamanlayıcıları temizle
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    
    startManualButtonTimer();
  }, [currentStepIndex]);

  const startManualButtonTimer = () => {
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setShowManualButton(true);
    }, 8000); 
  };

  // --- CAMERA LOGIC ---
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
          initializeAI();
        };
      }
    } catch (err) {
      console.error("Camera Error:", err);
      toast({ title: "Kamera Hatası", description: "Lütfen kamera izinlerini kontrol edin.", variant: "destructive" });
      setShowManualButton(true);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // --- FACE MESH AI LOGIC ---
  const initializeAI = async () => {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js');
      
      if (!(window as any).FaceMesh) throw new Error("FaceMesh SDK load failed");

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
      
      processVideoLoop();
      
    } catch (error) {
      console.warn("AI Load Error, switching to manual mode:", error);
      setIsModelLoaded(true); // UI kilidini aç
      setShowManualButton(true);
    }
  };

  const processVideoLoop = async () => {
    if (!isMountedRef.current) return;
    
    const now = Date.now();
    // FPS Limitleme (30 FPS max)
    if (now - lastProcessTimeRef.current > 33 && videoRef.current && faceMeshRef.current) {
      try {
         await faceMeshRef.current.send({ image: videoRef.current });
         lastProcessTimeRef.current = now;
      } catch (e) {
        // Silent fail
      }
    }
    requestAnimationFrame(processVideoLoop);
  };

  // --- POSE CALCULATION ---
  const calculatePose = (landmarks: any) => {
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const midEyes = { 
      x: (landmarks[33].x + landmarks[263].x) / 2, 
      y: (landmarks[33].y + landmarks[263].y) / 2 
    };

    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    // Yaw
    const yaw = -((nose.x - midEyes.x) / faceWidth) * 200;
    
    // Pitch
    const faceHeight = Math.abs(landmarks[14].y - midEyes.y);
    const pitch = ((nose.y - midEyes.y) / faceHeight - 0.4) * 150;

    return { yaw, pitch };
  };

  // --- MAIN LOOP RESULT HANDLER ---
  const onResults = useCallback((results: any) => {
    if (!isMountedRef.current || !currentStep) return;
    setIsModelLoaded(true);

    // Eğer geri sayım veya çekim yapılıyorsa analizi durdur
    if (status === 'countdown' || status === 'capturing') return;

    // 1. Manuel Adımlar
    if (currentStep.guideType === 'manual') {
      setStatus('locked');
      setGuidanceMessage("Konumunuzu ayarlayıp bekleyin");
      startCountdown();
      return;
    }

    // 2. Yüz Takip Adımları
    const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    if (!hasFace) {
      setStatus('searching');
      setGuidanceMessage("Yüzünüzü çerçeveye yerleştirin");
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    const pose = calculatePose(landmarks);
    const target = currentStep.target!;

    // Açı Kontrolü
    const yawDiff = pose.yaw - target.yaw;
    const pitchDiff = pose.pitch - target.pitch;
    
    const isYawGood = Math.abs(yawDiff) < target.tolerance;
    const isPitchGood = Math.abs(pitchDiff) < target.tolerance;

    if (isYawGood && isPitchGood) {
      setStatus('locked');
      setGuidanceMessage("Mükemmel! Kıpırdamayın.");
      startCountdown();
    } else {
      setStatus('aligning');
      
      if (!isYawGood) {
        if (yawDiff > 0) setGuidanceMessage("Başınızı hafifçe SOLA çevirin");
        else setGuidanceMessage("Başınızı hafifçe SAĞA çevirin");
      } else if (!isPitchGood) {
        if (pitchDiff > 0) setGuidanceMessage("Çenenizi biraz YUKARI kaldırın");
        else setGuidanceMessage("Çenenizi biraz AŞAĞI indirin");
      }
    }

  }, [currentStep, status, startCountdown]);

  // --- HAIR MODEL LOAD (ONNX) ---
  const loadHairModel = async () => {
    try {
      // face_parsing_bisenet.onnx dosyasını /public/models altına koyduğunu varsayıyorum
      const session = await ort.InferenceSession.create('/models/face_parsing_bisenet.onnx', {
        executionProviders: ['wasm'],
      });
      hairSessionRef.current = session;
      setIsHairModelReady(true);
      console.log('Hair segmentation model yüklendi');
    } catch (error) {
      console.error('Hair segmentation modeli yüklenemedi:', error);
      setIsHairModelReady(false);
    }
  };

  // --- HAIR SEGMENTATION & ANALYSIS ---
  const runHairSegmentation = async (dataUrl: string) => {
    if (!hairSessionRef.current) {
      console.warn('Hair model hazır değil');
      return null;
    }

    // BiSeNet genelde 512x512 input alıyor
    const INPUT_SIZE = 512;
    const HAIR_CLASS_ID = 10; // Bu modelde saç class id

    // 1. DataURL'den Image oluştur
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = (err) => reject(err);
      image.src = dataUrl;
    });

    // 2. Canvas üzerinde resize et
    const canvas = document.createElement('canvas');
    canvas.width = INPUT_SIZE;
    canvas.height = INPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const imageData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    const { data } = imageData;

    // 3. Onnx input tensor (1,3,H,W) - BGR, 0-1 scale
    const floatData = new Float32Array(1 * 3 * INPUT_SIZE * INPUT_SIZE);

    for (let y = 0; y < INPUT_SIZE; y++) {
      for (let x = 0; x < INPUT_SIZE; x++) {
        const idx = (y * INPUT_SIZE + x) * 4;
        const r = data[idx] / 255.0;
        const g = data[idx + 1] / 255.0;
        const b = data[idx + 2] / 255.0;

        const offset = y * INPUT_SIZE + x;

        // BGR sıralaması
        floatData[0 * INPUT_SIZE * INPUT_SIZE + offset] = b;
        floatData[1 * INPUT_SIZE * INPUT_SIZE + offset] = g;
        floatData[2 * INPUT_SIZE * INPUT_SIZE + offset] = r;
      }
    }

    const session = hairSessionRef.current;
    const feeds: Record<string, ort.Tensor> = {};
    const inputName = session.inputNames[0];
    feeds[inputName] = new ort.Tensor('float32', floatData, [1, 3, INPUT_SIZE, INPUT_SIZE]);

    // 4. Model çalıştır
    const results = await session.run(feeds);
    const outputName = session.outputNames[0];
    const output = results[outputName];

    if (!output) return null;

    // Çoğu face parsing modelinde output shape: [1, C, H, W]
    const [n, c, h, w] = output.dims;
    const scores = output.data as Float32Array;

    let hairPixelCount = 0;
    let totalPixelCount = h * w;

    // Saç maskesini ayrıca görselleştirmek istersen:
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return null;
    const maskImageData = maskCtx.createImageData(w, h);
    const maskData = maskImageData.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        let maxVal = -Infinity;
        let maxClass = 0;

        // Her piksel için tüm class skorları
        for (let ci = 0; ci < c; ci++) {
          const score = scores[ci * h * w + idx];
          if (score > maxVal) {
            maxVal = score;
            maxClass = ci;
          }
        }

        const maskIdx = idx * 4;
        if (maxClass === HAIR_CLASS_ID) {
          // Saç piksellerini yeşil yap
          maskData[maskIdx] = 0;
          maskData[maskIdx + 1] = 255;
          maskData[maskIdx + 2] = 0;
          maskData[maskIdx + 3] = 180; // yarı saydam
          hairPixelCount++;
        } else {
          // Arka planı transparan bırak
          maskData[maskIdx] = 0;
          maskData[maskIdx + 1] = 0;
          maskData[maskIdx + 2] = 0;
          maskData[maskIdx + 3] = 0;
        }
      }
    }

    maskCtx.putImageData(maskImageData, 0, 0);
    const hairMaskDataUrl = maskCanvas.toDataURL('image/png');

    const hairCoverageRatio = hairPixelCount / totalPixelCount;
    const hairCoveragePercent = Math.round(hairCoverageRatio * 100);

    return {
      hairCoverageRatio,
      hairCoveragePercent,
      hairMaskDataUrl,
    };
  };

  // --- CAPTURE HANDLER ---
  const handleCapture = useCallback(async () => {
    // Çift tıklama ve bellek sızıntısı koruması
    if (!videoRef.current || isCapturingRef.current) return;
    if (!currentStep) return;

    isCapturingRef.current = true; // KİLİTLE
    setStatus('capturing');

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1); // Aynalama
      ctx.drawImage(video, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      // Önce foto nesnesi
      const basePhoto: CapturedPhoto = {
        id: Date.now(),
        preview: dataUrl,
        type: currentStep.id
      };

      let finalPhoto = basePhoto;

      // Saç segmentasyonu varsa çalıştır
      if (isHairModelReady) {
        try {
          const hairResult = await runHairSegmentation(dataUrl);
          if (hairResult) {
            finalPhoto = {
              ...basePhoto,
              hairAnalysis: {
                hairCoverageRatio: hairResult.hairCoverageRatio,
                hairCoveragePercent: hairResult.hairCoveragePercent,
              },
            };

            toast({
              title: "Saç Analizi Tamamlandı",
              description: `Tahmini saç yoğunluğu: %${hairResult.hairCoveragePercent}`,
            });
          }
        } catch (error) {
          console.error('Saç segmentasyonunda hata:', error);
          toast({
            title: "Saç Analizi Hatası",
            description: "Saç segmentasyonu sırasında bir hata oluştu.",
            variant: 'destructive',
          });
        }
      } else {
        console.warn('Hair model ready değil, sadece foto kaydediliyor');
      }

      setCapturedImages(prev => [...prev, finalPhoto]);
      
      // Flash effect
      const flash = document.createElement('div');
      flash.className = 'fixed inset-0 bg-white z-[100] animate-out fade-out duration-500 pointer-events-none';
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 500);

      toast({ title: "Fotoğraf Çekildi", description: "Sıradaki adıma geçiliyor..." });

      // Next Step
      setTimeout(() => {
        if (isMountedRef.current) {
          if (currentStepIndex < SCAN_STEPS.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
          } else {
            onComplete([...capturedImages, finalPhoto]);
          }
        }
      }, 1000);
    }
  }, [currentStep, currentStepIndex, capturedImages, isHairModelReady, onComplete, toast]);

  // --- COUNTDOWN LOGIC ---
  const startCountdown = useCallback(() => {
    if (status === 'countdown' || status === 'capturing') return;
    if (isCapturingRef.current) return; // Eğer zaten yakalama modundaysa sayım başlatma
    
    setStatus('countdown');
    setCountdown(3);

    let count = 3;
    
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
        setCountdown(null);
        handleCapture();
      }
    }, 1000);

  }, [status, handleCapture]);

  // CRITICAL FIX: Eğer step undefined ise (index out of bounds) render etme
  if (!currentStep) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col overflow-hidden">
      
      {/* 1. VİDEO KATMANI */}
      <div className="absolute inset-0 z-0">
        <video 
          ref={videoRef}
          className="w-full h-full object-cover transform scale-x-[-1]"
          playsInline
          muted
        />
        {/* Hayalet Kılavuz */}
        <GuideOverlay shape={currentStep.guideShape} status={status} />
      </div>

      {/* 2. FEEDBACK KATMANI (ORTA) */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
        
        {/* Loading Spinner */}
        {!isModelLoaded && (
          <div className="bg-black/70 backdrop-blur-md p-6 rounded-2xl flex flex-col items-center">
            <RefreshCw className="w-10 h-10 animate-spin mb-3 text-indigo-400" />
            <p className="font-medium">AI Kamera Hazırlanıyor...</p>
          </div>
        )}

        {/* Geri Sayım Sayacı */}
        <AnimatePresence>
          {countdown !== null && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              key={countdown}
              className="text-8xl font-black text-white drop-shadow-lg"
            >
              {countdown}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Durum İkonları */}
        {status === 'locked' && countdown === null && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="bg-green-500/90 p-4 rounded-full mb-4">
            <Check className="w-8 h-8 text-white" />
          </motion.div>
        )}
      </div>

      {/* 3. UI KONTROL KATMANI */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
        
        {/* Üst Bar */}
        <div className="p-4 pt-safe bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start pointer-events-auto">
          <div>
            <span className="inline-block bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold mb-1">
              ADIM {currentStepIndex + 1} / {SCAN_STEPS.length}
            </span>
            <h2 className="text-xl font-bold drop-shadow-md">{currentStep.label}</h2>
          </div>
          <button onClick={onCancel} className="p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Alt Bar */}
        <div className="p-6 pb-safe bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center pointer-events-auto space-y-6">
          
          {/* Yönlendirme Mesajı */}
          <div className={`
            px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10 text-center transition-colors duration-300
            ${status === 'aligning' ? 'bg-amber-500/80 text-white' : 'bg-black/60 text-white'}
            ${status === 'locked' ? 'bg-green-500/80' : ''}
          `}>
            <p className="text-lg font-bold">{guidanceMessage || currentStep.instruction}</p>
            <p className="text-xs opacity-80 mt-1 font-medium">{currentStep.subInstruction}</p>
          </div>

          {/* Manuel Çekim Butonu (Fallback) */}
          <div className="h-16 flex items-center justify-center">
             {showManualButton && status !== 'countdown' && (
               <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                 <button
                   onClick={handleCapture}
                   className="flex items-center bg-white text-black hover:bg-gray-200 rounded-full font-bold px-8 py-3 shadow-xl transition-colors"
                 >
                   <CameraIcon className="w-5 h-5 mr-2" />
                   Manuel Çek
                 </button>
               </motion.div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default LiveScanner;
