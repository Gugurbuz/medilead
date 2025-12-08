import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, RefreshCw, X, Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { processHairImage } from '@/lib/visionModel';

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
    densityScore: number;
    coverageLabel: string;
    segmentationMask: string;
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
    target: { yaw: -50, pitch: 5, roll: 0, tolerance: 25 }, // Tolerans biraz artırıldı
    guideType: 'face',
    guideShape: 'oval'
  },
  { 
    id: 'right', 
    label: 'Sol Profil', 
    instruction: 'Başınızı SAĞA Çevirin', 
    subInstruction: 'Kulağınızı görene kadar yavaşça dönün',
    target: { yaw: 50, pitch: 5, roll: 0, tolerance: 25 }, // Tolerans biraz artırıldı
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

// --- GÖRSEL REHBER BİLEŞENİ (UX) ---
const GuideOverlay = ({ shape, status }: { shape: string; status: string }) => {
  const getColor = () => {
    if (status === 'locked') return '#4ade80'; // Yeşil
    if (status === 'countdown') return '#4ade80'; // Yeşil
    if (status === 'aligning') return '#fbbf24'; // Sarı
    return 'rgba(255, 255, 255, 0.5)'; // Beyaz
  };

  const getStrokeWidth = () => {
     return status === 'locked' ? "5" : "3";
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-300">
      <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
        <defs>
          <mask id="guide-mask">
            <rect width="100%" height="100%" fill="white" />
            {shape === 'oval' && <ellipse cx="200" cy="280" rx="130" ry="170" fill="black" />}
            {shape === 'circle' && <circle cx="200" cy="300" r="140" fill="black" />}
            {shape === 'rect' && <rect x="50" y="150" width="300" height="300" rx="40" fill="black" />}
          </mask>
        </defs>

        <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#guide-mask)" />

        {shape === 'oval' && (
          <ellipse cx="200" cy="280" rx="130" ry="170" fill="none" stroke={getColor()} strokeWidth={getStrokeWidth()} strokeDasharray={status === 'locked' ? "0" : "10 5"} />
        )}
        {shape === 'circle' && (
          <circle cx="200" cy="300" r="140" fill="none" stroke={getColor()} strokeWidth={getStrokeWidth()} strokeDasharray={status === 'locked' ? "0" : "10 5"} />
        )}
        {shape === 'rect' && (
          <rect x="50" y="150" width="300" height="300" rx="40" fill="none" stroke={getColor()} strokeWidth={getStrokeWidth()} strokeDasharray={status === 'locked' ? "0" : "10 5"} />
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
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  // Logic State
  const [status, setStatus] = useState<'searching' | 'aligning' | 'locked' | 'countdown' | 'capturing'>('searching');
  const [guidanceMessage, setGuidanceMessage] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showManualButton, setShowManualButton] = useState(false);
  const [processingAnalysis, setProcessingAnalysis] = useState(false);

  // Refs
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const isMountedRef = useRef(true);
  const lastProcessTimeRef = useRef(0);
  const manualTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isCapturingRef = useRef(false);
  const requestRef = useRef<number>();

  const currentStep = SCAN_STEPS[currentStepIndex];

  // --- INIT & CLEANUP ---
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    startManualButtonTimer();

    return () => {
      isMountedRef.current = false;
      stopCamera();
      if (faceMeshRef.current) {
        faceMeshRef.current.close();
      }
      if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  useEffect(() => {
    // Adım değişikliğinde state reset
    setStatus('searching');
    setGuidanceMessage('');
    setCountdown(null);
    setShowManualButton(false);
    isCapturingRef.current = false;
    
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    startManualButtonTimer();
  }, [currentStepIndex]);

  const startManualButtonTimer = () => {
    if (manualTimerRef.current) clearTimeout(manualTimerRef.current);
    manualTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) setShowManualButton(true);
    }, 10000); // 10 saniye sonra manuel buton çıkar
  };

  // --- KAMERA ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          initializeFaceMesh();
        };
      }
    } catch (err) {
      console.error('Camera Error:', err);
      toast({
        title: 'Kamera Hatası',
        description: 'Lütfen kamera izinlerini kontrol edin.',
        variant: 'destructive',
      });
      setShowManualButton(true);
      setIsModelLoaded(true); // Model yüklenemese bile UI açılmalı
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  // --- FACE MESH (NPM PAKETİ) ---
  const initializeFaceMesh = async () => {
    try {
      const faceMesh = new FaceMesh({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
        },
      });

      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      faceMesh.onResults(onResults);
      faceMeshRef.current = faceMesh;

      // Döngüyü başlat
      processVideoLoop();
    } catch (error) {
      console.error('FaceMesh Init Error:', error);
      setIsModelLoaded(true);
      setShowManualButton(true);
    }
  };

  const processVideoLoop = async () => {
    if (!isMountedRef.current) return;

    const now = Date.now();
    // 30 FPS Limiti (Gereksiz CPU kullanımını önler)
    if (now - lastProcessTimeRef.current > 33 && videoRef.current && faceMeshRef.current) {
      // Sadece video hazırsa ve duraklatılmamışsa işle
      if (videoRef.current.readyState >= 2 && !videoRef.current.paused) {
        try {
          await faceMeshRef.current.send({ image: videoRef.current });
          lastProcessTimeRef.current = now;
        } catch (e) {
          // Sessiz hata yönetimi
        }
      }
    }
    requestRef.current = requestAnimationFrame(processVideoLoop);
  };

  // --- POZ HESAPLAMA ---
  const calculatePose = (landmarks: any) => {
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const midEyes = {
      x: (landmarks[33].x + landmarks[263].x) / 2,
      y: (landmarks[33].y + landmarks[263].y) / 2,
    };

    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    // Yaw (Sağ-Sol Dönüş)
    const yaw = -((nose.x - midEyes.x) / faceWidth) * 200;

    // Pitch (Yukarı-Aşağı Dönüş)
    const faceHeight = Math.abs(landmarks[14].y - midEyes.y);
    const pitch = ((nose.y - midEyes.y) / faceHeight - 0.4) * 150;

    return { yaw, pitch };
  };

  // --- SONUÇ İŞLEYİCİ ---
  const onResults = useCallback((results: Results) => {
    if (!isMountedRef.current || !currentStep) return;
    setIsModelLoaded(true);

    if (status === 'countdown' || status === 'capturing' || processingAnalysis) return;

    // Manuel Mod Kontrolü
    if (currentStep.guideType === 'manual') {
      // Manuel modda sadece zamanlayıcıyı tetikle, poz kontrolü yapma
      if (status !== 'locked') {
        setStatus('locked');
        setGuidanceMessage('Konumunuzu ayarlayıp bekleyin');
        startCountdown();
      }
      return;
    }

    const landmarks = results.multiFaceLandmarks;
    
    if (!landmarks || landmarks.length === 0) {
      if (status !== 'searching') {
        setStatus('searching');
        setGuidanceMessage('Yüzünüzü çerçeveye yerleştirin');
      }
      return;
    }

    const pose = calculatePose(landmarks[0]);
    const target = currentStep.target!;

    const yawDiff = pose.yaw - target.yaw;
    const pitchDiff = pose.pitch - target.pitch;

    const isYawGood = Math.abs(yawDiff) < target.tolerance;
    const isPitchGood = Math.abs(pitchDiff) < target.tolerance;

    if (isYawGood && isPitchGood) {
      if (status !== 'locked') {
        setStatus('locked');
        setGuidanceMessage('Mükemmel! Kıpırdamayın.');
        startCountdown();
      }
    } else {
      setStatus('aligning');
      // Kullanıcıya anlık feedback (Debounce eklenebilir ama şu an için doğrudan set ediyoruz)
      if (!isYawGood) {
        setGuidanceMessage(yawDiff > 0 ? 'Başınızı hafifçe SOLA çevirin' : 'Başınızı hafifçe SAĞA çevirin');
      } else if (!isPitchGood) {
        setGuidanceMessage(pitchDiff > 0 ? 'Çenenizi biraz YUKARI kaldırın' : 'Çenenizi biraz AŞAĞI indirin');
      }
    }
  }, [currentStep, status, processingAnalysis]); // startCountdown deps'ten çıkarıldı loop riskini azaltmak için

  // --- CAPTURE & ANALİZ ---
  const handleCapture = async () => {
    if (!videoRef.current || isCapturingRef.current) return;
    
    isCapturingRef.current = true;
    setStatus('capturing');
    setProcessingAnalysis(true);

    const video = videoRef.current;
    
    // Fotoğrafı yakala
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Aynalama efekti ile çiz
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // Animasyon efekti
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-white z-[100] animate-out fade-out duration-500 pointer-events-none';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);

    let finalPhoto: CapturedPhoto = {
      id: Date.now(),
      preview: dataUrl,
      type: currentStep.id,
    };

    // Saç Analizi (Sadece belli adımlarda veya hepsinde yapılabilir, şu an hepsinde deniyoruz)
    try {
      setGuidanceMessage('Analiz ediliyor...');
      const analysisResult = await processHairImage(dataUrl);
      
      finalPhoto = {
        ...finalPhoto,
        preview: analysisResult.original, // Optimize edilmiş görseli kullan
        hairAnalysis: {
          densityScore: analysisResult.densityScore,
          coverageLabel: analysisResult.coverageLabel,
          segmentationMask: analysisResult.segmentationMask
        }
      };

      toast({
        title: 'Analiz Başarılı',
        description: `${finalPhoto.hairAnalysis.coverageLabel} (${finalPhoto.hairAnalysis.densityScore}%)`,
      });

    } catch (error) {
      console.error("Analiz hatası:", error);
      // Analiz başarısız olsa bile fotoğrafı kaydet
      toast({
        title: 'Fotoğraf Alındı',
        description: 'Detaylı analiz daha sonra yapılacak.',
        variant: 'default',
      });
    }

    setCapturedImages(prev => [...prev, finalPhoto]);
    setProcessingAnalysis(false);

    // Sonraki adıma geçiş
    setTimeout(() => {
        if (currentStepIndex < SCAN_STEPS.length - 1) {
          setCurrentStepIndex(prev => prev + 1);
        } else {
          onComplete([...capturedImages, finalPhoto]);
        }
    }, 1000);
  };

  // --- COUNTDOWN WRAPPER ---
  const startCountdown = () => {
    // Eğer zaten sayıyorsa veya işlem yapılıyorsa çık
    if (countdown !== null || isCapturingRef.current) return;
    
    let count = 3;
    setCountdown(count);
    
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(countdownIntervalRef.current!);
        setCountdown(null);
        handleCapture();
      }
    }, 1000);
  };

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
        <GuideOverlay shape={currentStep.guideShape} status={status} />
      </div>

      {/* 2. FEEDBACK KATMANI */}
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
        {(!isModelLoaded || processingAnalysis) && (
          <div className="bg-black/70 backdrop-blur-md p-6 rounded-2xl flex flex-col items-center animate-in fade-in zoom-in">
            <RefreshCw className="w-10 h-10 animate-spin mb-3 text-indigo-400" />
            <p className="font-medium">
              {processingAnalysis ? 'Saç Analizi Yapılıyor...' : 'Kamera ve AI Hazırlanıyor...'}
            </p>
          </div>
        )}

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

        {status === 'locked' && countdown === null && !processingAnalysis && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="bg-green-500/90 p-4 rounded-full mb-4"
          >
            <Check className="w-8 h-8 text-white" />
          </motion.div>
        )}
      </div>

      {/* 3. UI KONTROL KATMANI */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between pointer-events-none">
        {/* Header */}
        <div className="p-4 pt-safe bg-gradient-to-b from-black/80 to-transparent flex justify-between items-start pointer-events-auto">
          <div>
            <span className="inline-block bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-xs font-bold mb-1">
              ADIM {currentStepIndex + 1} / {SCAN_STEPS.length}
            </span>
            <h2 className="text-xl font-bold drop-shadow-md">{currentStep.label}</h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 bg-white/10 rounded-full backdrop-blur-md hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Footer Controls */}
        <div className="p-6 pb-safe bg-gradient-to-t from-black/95 via-black/60 to-transparent flex flex-col items-center pointer-events-auto space-y-6">
          <div
            className={`
              px-6 py-3 rounded-2xl backdrop-blur-md border border-white/10 text-center transition-all duration-300
              ${status === 'aligning' ? 'bg-amber-500/80 text-white' : 'bg-black/60 text-white'}
              ${status === 'locked' ? 'bg-green-500/80' : ''}
              ${status === 'searching' ? 'animate-pulse' : ''}
            `}
          >
            <p className="text-lg font-bold">{guidanceMessage || currentStep.instruction}</p>
            <p className="text-xs opacity-80 mt-1 font-medium">{currentStep.subInstruction}</p>
          </div>

          <div className="h-16 flex items-center justify-center w-full">
            {showManualButton && status !== 'countdown' && !processingAnalysis && (
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