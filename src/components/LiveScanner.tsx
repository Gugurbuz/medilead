import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, RefreshCw, X, User, Check, Sun, Volume2, VolumeX, MousePointerClick
} from 'lucide-react';
import { FaceMesh, Results } from '@mediapipe/face_mesh';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

// --- CONFIGURATION ---
const SCAN_STEPS = [
  { 
    id: 'front', 
    label: 'Ön Görünüm', 
    instruction: 'Kameraya Düz Bakın', 
    target: { yaw: 0, pitch: 0, roll: 0, yawTolerance: 10, pitchTolerance: 15 }, // Toleranslar sıkılaştırıldı
    guideType: 'face'
  },
  { 
    id: 'left', 
    label: 'Sağ Profil', 
    instruction: 'Başınızı Yavaşça SOLA Çevirin', 
    target: { yaw: -50, pitch: 0, roll: 0, yawTolerance: 20, pitchTolerance: 30 }, 
    guideType: 'face'
  },
  { 
    id: 'right', 
    label: 'Sol Profil', 
    instruction: 'Başınızı Yavaşça SAĞA Çevirin', 
    target: { yaw: 50, pitch: 0, roll: 0, yawTolerance: 20, pitchTolerance: 30 }, 
    guideType: 'face'
  },
  { 
    id: 'crown', 
    label: 'Tepe Görünümü', 
    instruction: 'Başınızı Öne Eğerek Tepeyi Gösterin', 
    target: { yaw: 0, pitch: 50, roll: 0, yawTolerance: 30, pitchTolerance: 30 }, // Pitch hedefi artırıldı
    guideType: 'face'
  },
  { 
    id: 'back', 
    label: 'Donör Bölge (Ense)', 
    instruction: 'Arkanızı Dönün', 
    target: null, 
    guideType: 'manual'
  },
];

const HAIR_STYLES: Record<string, { label: string; curvature: number; height: number }> = {
  young: { label: 'Genç', curvature: 0.8, height: 0 },
  mature: { label: 'Olgun', curvature: 1.5, height: -15 },
  straight: { label: 'Düz', curvature: 0.1, height: 5 },
};

interface CapturedPhoto {
  id: string;
  preview: string;
  type: string;
  metadata?: any;
}

interface LiveScannerProps {
  onComplete: (photos: CapturedPhoto[]) => void;
  onCancel: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<CapturedPhoto[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  
  // Tracking State
  const [status, setStatus] = useState<'searching' | 'aligning' | 'locked' | 'capturing'>('searching');
  const [scanProgress, setScanProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);

  // AR & UX Features
  const [hairlineOffset, setHairlineOffset] = useState(0);
  const [hairStyle, setHairStyle] = useState('young');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLowLight, setIsLowLight] = useState(false);

  // Refs
  const faceMeshRef = useRef<FaceMesh | null>(null);
  const isMountedRef = useRef(true);
  const lastSpeakTimeRef = useRef(0);
  const requestRef = useRef<number>();
  const lastProcessTimeRef = useRef(0);

  const currentStep = SCAN_STEPS[currentStepIndex];

  // --- TTS (SESLİ ASİSTAN) ---
  const speak = useCallback((text: string, force = false) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    
    const now = Date.now();
    // Çok sık konuşmasını engelle (3 saniye ara)
    if (!force && now - lastSpeakTimeRef.current < 3000) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR'; // Türkçe konuşması için
    utterance.rate = 1.0;
    
    window.speechSynthesis.speak(utterance);
    lastSpeakTimeRef.current = now;
  }, [voiceEnabled]);

  // --- AR DRAWING (SAÇ ÇİZİMİ) ---
  const drawHairlineAR = (ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) => {
    if (!landmarks || landmarks.length === 0) return;

    const style = HAIR_STYLES[hairStyle];
    
    // MediaPipe noktaları (Mesh map'e göre)
    const mid = landmarks[10];  // Alın ortası
    const left = landmarks[338]; // Sol şakak
    const right = landmarks[297]; // Sağ şakak

    if (!mid || !left || !right) return;

    const mx = mid.x * width;
    const my = mid.y * height;
    const lx = left.x * width;
    const ly = left.y * height;
    const rx = right.x * width;
    const ry = right.y * height;

    const totalOffsetY = - (hairlineOffset * 2) - style.height; 

    ctx.save();
    ctx.beginPath();
    
    // Bezier curve ile saç çizgisi simülasyonu
    ctx.moveTo(lx, ly + totalOffsetY + (style.curvature * 20));
    
    const cp1x = lx + (mx - lx) * 0.5;
    const cp1y = ly + totalOffsetY - (style.curvature * 10);
    const cp2x = rx + (mx - rx) * 0.5;
    const cp2y = ry + totalOffsetY - (style.curvature * 10);

    ctx.bezierCurveTo(cp1x, cp1y, mx, my + totalOffsetY, mx, my + totalOffsetY);
    ctx.bezierCurveTo(mx, my + totalOffsetY, cp2x, cp2y, rx, ry + totalOffsetY + (style.curvature * 20));

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)'; // Parlak yeşil
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.restore();
  };

  // --- INIT & CLEANUP ---
  useEffect(() => {
    isMountedRef.current = true;
    startCamera();
    
    // İlk açılışta konuş
    setTimeout(() => speak(currentStep.instruction), 1000);

    return () => {
      isMountedRef.current = false;
      stopCamera();
      window.speechSynthesis.cancel();
      if (faceMeshRef.current) faceMeshRef.current.close();
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Adım değiştiğinde reset
  useEffect(() => {
    setStatus('searching');
    setScanProgress(0);
    speak(currentStep.instruction, true);
  }, [currentStepIndex]);

  // --- AUTO CAPTURE ---
  useEffect(() => {
    if (scanProgress >= 100 && status !== 'capturing') {
      handleCapture();
    }
  }, [scanProgress, status]);

  // --- CAMERA ---
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
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
      toast({ title: 'Kamera Hatası', variant: 'destructive' });
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  // --- POSE CALCULATION (SENİN ÖRNEĞİNDEKİ HASSAS VERSİYON) ---
  const calculatePose = (landmarks: any[]) => {
    if (!landmarks) return null;
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const mouthBottom = landmarks[14];
    
    const midEyes = { 
      x: (leftEye.x + rightEye.x) / 2, 
      y: (leftEye.y + rightEye.y) / 2,
    };

    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    // Yaw hesaplaması (Dönüş hassasiyeti için 200 çarpanı)
    const noseRelativeX = nose.x - midEyes.x; 
    const yaw = -(noseRelativeX / faceWidth) * 200; 

    // Pitch hesaplaması
    const faceHeight = Math.abs(mouthBottom.y - midEyes.y);
    const noseRelativeY = nose.y - midEyes.y;
    const pitchRatio = noseRelativeY / faceHeight;
    const pitch = (pitchRatio - 0.4) * 150; 

    // Roll hesaplaması
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const roll = Math.atan2(dy, dx) * (180 / Math.PI);

    return { yaw, pitch, roll };
  };

  // --- MEDIA PIPE INIT ---
  const initializeFaceMesh = async () => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onResults);
    faceMeshRef.current = faceMesh;
    processVideoLoop();
  };

  const processVideoLoop = () => {
    if (!isMountedRef.current) return;
    const now = Date.now();
    
    // 30 FPS Limit
    if (now - lastProcessTimeRef.current > 33 && videoRef.current && faceMeshRef.current) {
      if (videoRef.current.readyState >= 2 && !videoRef.current.paused) {
         faceMeshRef.current.send({ image: videoRef.current }).catch(() => {});
         lastProcessTimeRef.current = now;
      }
    }
    requestRef.current = requestAnimationFrame(processVideoLoop);
  };

  // --- MAIN LOGIC LOOP ---
  const onResults = useCallback((results: Results) => {
    if (!isMountedRef.current || status === 'capturing') return;
    if (!currentStep) return;

    // 1. Işık Kontrolü (Lighting Detection)
    // Performans için her frame değil, processRef canvas üzerinden küçük bir alanı kontrol edebiliriz
    // (Basitleştirilmiş versiyon: direkt results.image kullanılamadığı için videoRef kullanacağız capturing sırasında)

    // 2. Canvas Çizimi (AR)
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            // Canvas boyutunu videoya eşitle
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Aynalama efekti için transform
            ctx.save();
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);

            if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
               drawHairlineAR(ctx, results.multiFaceLandmarks[0], canvas.width, canvas.height);
            }
            ctx.restore();
        }
    }

    const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
    setFaceDetected(hasFace);
    setIsModelLoaded(true);

    // 3. Manuel Adım (Arka Görünüm)
    if (currentStep.guideType === 'manual') {
        if (!hasFace) {
             setStatus('locked');
             setScanProgress(prev => Math.min(prev + 1.5, 100)); // Yavaşça dol
             if (scanProgress > 80) speak("Mükemmel, kıpırdamayın");
        } else {
             setScanProgress(0);
             setStatus('aligning'); 
             if (scanProgress === 0) speak("Lütfen arkanızı dönün");
        }
        return;
    }

    // 4. Face Mesh Mantığı
    if (!hasFace) {
        setStatus('searching');
        setScanProgress(0);
        return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    const headPose = calculatePose(landmarks);
    if (!headPose) return;

    const { target } = currentStep;
    if (!target) return;

    // Açı farklarını hesapla
    const yawDiff = headPose.yaw - target.yaw;
    const pitchDiff = headPose.pitch - target.pitch;

    // "Hata" toleransı kontrolü (Mutlak değer kullanılarak yön bağımsız kontrol)
    const isYawGood = Math.abs(yawDiff) < target.yawTolerance;
    const isPitchGood = Math.abs(pitchDiff) < target.pitchTolerance;
    
    // Eğer tüm açılar uygunsa
    if (isYawGood && isPitchGood) {
        setStatus('locked');
        if (scanProgress < 100) setScanProgress(prev => prev + 4); // Hızlı dolum
        
        if (scanProgress > 70 && status !== 'locked') {
            speak("Mükemmel");
        }
    } else {
        setStatus('aligning');
        setScanProgress(prev => Math.max(0, prev - 5)); // Hata yaparsa progress düşsün
        
        // Kullanıcıya sesli feedback
        // Sola bakma durumunda yaw negatiftir.
        if (!isYawGood) {
             if (yawDiff > 0) speak("Sola dönün"); // Pozitif fark varsa sola gitmeli
             else speak("Sağa dönün");
        } else if (!isPitchGood) {
             if (pitchDiff > 0) speak("Yukarı bakın");
             else speak("Aşağı bakın");
        }
    }

  }, [currentStep, scanProgress, status, voiceEnabled, hairStyle, hairlineOffset, speak]);

  // --- CAPTURE HANDLER ---
  const handleCapture = useCallback(() => {
    if (!videoRef.current || !isMountedRef.current) return;
    
    setStatus('capturing');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const newPhoto: CapturedPhoto = {
            id: crypto.randomUUID(),
            preview: dataUrl,
            type: currentStep.id,
            metadata: { hairStyle, hairlineOffset }
        };
        
        setCapturedImages(prev => [...prev, newPhoto]);

        // Flash Efekti
        const flash = document.createElement('div');
        flash.className = 'fixed inset-0 bg-white z-[100] animate-out fade-out duration-500 pointer-events-none';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 500);

        setTimeout(() => {
            if (!isMountedRef.current) return;
            
            if (currentStepIndex < SCAN_STEPS.length - 1) {
                setCurrentStepIndex(prev => prev + 1);
                setScanProgress(0);
                setStatus('searching');
            } else {
                onComplete([...capturedImages, newPhoto]);
            }
        }, 1000);
    }
  }, [currentStep, currentStepIndex, onComplete, hairStyle, hairlineOffset, capturedImages]);

  if (!currentStep) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden"
    >
      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent text-white flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
             <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-medium tracking-wider uppercase backdrop-blur-md">
               ADIM {currentStepIndex + 1}/{SCAN_STEPS.length}
             </span>
             <Button
               variant="ghost" 
               size="icon"
               onClick={() => setVoiceEnabled(!voiceEnabled)}
               className="h-8 w-8 bg-white/10 hover:bg-white/20 text-white rounded-full"
             >
               {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
             </Button>
          </div>
          <h2 className="text-2xl font-bold tracking-tight drop-shadow-lg">{currentStep.label}</h2>
        </div>
        <button onClick={onCancel} className="p-2 bg-white/10 hover:bg-white/20 rounded-full pointer-events-auto transition-colors">
            <X className="w-6 h-6" />
        </button>
      </div>

      {/* MAIN VIEW */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden flex items-center justify-center">
        {!isModelLoaded && currentStep.guideType !== 'manual' && (
          <div className="absolute z-30 flex flex-col items-center text-white/70 animate-pulse">
            <RefreshCw className="w-10 h-10 animate-spin mb-2" />
            <p>AI Hazırlanıyor...</p>
          </div>
        )}

        {/* VİDEO VE CANVAS AYNI BOYUTTA VE HİZADA */}
        <div className="relative w-full h-full flex items-center justify-center">
            <video 
              ref={videoRef}
              autoPlay 
              playsInline 
              muted
              className="absolute w-full h-full object-cover transform scale-x-[-1]" 
            />
            <canvas 
                ref={canvasRef}
                className="absolute w-full h-full object-cover pointer-events-none" // scale-x-[-1] canvas içinde yapıldı
            />
        </div>

        {/* AR SLIDERS (Sadece Ön Kamera) */}
        {currentStep.guideType === 'face' && (
            <div className="absolute right-4 top-1/3 flex flex-col items-center justify-center z-40 pointer-events-auto gap-4">
                 <div className="bg-black/40 backdrop-blur-md rounded-full py-6 px-2 border border-white/10 shadow-xl flex flex-col items-center">
                    <MousePointerClick className="w-5 h-5 text-white/70 mb-4" />
                    <div className="h-40 w-8 relative flex items-center justify-center">
                        <input 
                            type="range" 
                            min="-50" 
                            max="50" 
                            value={hairlineOffset} 
                            onChange={(e) => setHairlineOffset(parseInt(e.target.value))}
                            className="absolute -rotate-90 w-40 h-8 bg-transparent cursor-pointer opacity-50 hover:opacity-100"
                        />
                    </div>
                </div>
            </div>
        )}

        {/* LOW LIGHT WARNING */}
        {isLowLight && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white px-6 py-2 rounded-full flex items-center gap-2 z-40 shadow-lg backdrop-blur-sm animate-bounce">
                <Sun className="w-5 h-5" />
                <span className="font-bold text-sm">Işığı Artırın</span>
            </div>
        )}
        
        {/* CENTRAL HUD (KİLİTLENME HALKASI) */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
             <motion.div
                animate={{
                  borderColor: status === 'locked' ? '#4ade80' : status === 'aligning' ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                  borderWidth: status === 'locked' ? 6 : 2,
                  scale: status === 'locked' ? 1.05 : 1
                }}
                className="w-[300px] h-[400px] sm:w-[350px] sm:h-[480px] rounded-[3rem] border-2 relative overflow-hidden transition-all duration-300 shadow-2xl"
             >
                <AnimatePresence>
                  {(status === 'locked' || status === 'capturing') && (
                    <motion.div
                      initial={{ top: "0%" }}
                      animate={{ top: "100%" }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-1 bg-green-400 shadow-[0_0_20px_rgba(74,222,128,0.8)] z-10"
                    />
                  )}
                </AnimatePresence>

                {!faceDetected && currentStep.guideType !== 'manual' && isModelLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20 text-center p-4">
                    <User className="w-16 h-16 text-white/50 mb-2" />
                    <span className="bg-red-500/90 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">Yüz Bulunamadı</span>
                    <p className="text-white/80 mt-2 text-sm">Lütfen yüzünüzü çerçeveye yerleştirin</p>
                  </div>
                )}
             </motion.div>
        </div>

        {/* INSTRUCTIONS */}
        <div className="absolute bottom-32 left-0 right-0 text-center pointer-events-none px-4"> 
             <div className="inline-block bg-black/60 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10 shadow-2xl max-w-sm">
               <h3 className="text-xl font-bold text-white">{currentStep.instruction}</h3>
               {status === 'locked' && (
                 <p className="text-green-400 text-sm mt-1 font-bold uppercase tracking-widest animate-pulse">
                   Hareketsiz Kalın
                 </p>
               )}
             </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="bg-black/80 backdrop-blur-xl p-6 flex flex-col items-center border-t border-white/10 relative z-50">
        
        {currentStep.guideType === 'face' && (
            <div className="flex gap-2 mb-6 w-full justify-center overflow-x-auto no-scrollbar">
                {Object.entries(HAIR_STYLES).map(([key, style]) => (
                    <button
                        key={key}
                        onClick={() => setHairStyle(key)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all border whitespace-nowrap ${
                            hairStyle === key 
                            ? 'bg-white text-black border-white scale-105 shadow-lg' 
                            : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20'
                        }`}
                    >
                        {style.label}
                    </button>
                ))}
            </div>
        )}

        {/* PROGRESS RING & MANUAL BUTTON */}
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
                  className="transition-all duration-100 linear"
                />
            </svg>
            <button
                onClick={() => setScanProgress(100)}
                className="relative w-14 h-14 rounded-full bg-white hover:scale-95 transition-transform flex items-center justify-center shadow-lg active:scale-90"
            >
                {status === 'capturing' ? <Check className="w-6 h-6 text-green-600" /> : <CameraIcon className="w-6 h-6 text-gray-900" />}
            </button>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveScanner;