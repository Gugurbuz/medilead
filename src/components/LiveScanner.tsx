import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, RefreshCw, X, User, Check, Sun, Volume2, VolumeX, MousePointerClick
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

// --- TİP TANIMLAMALARI (CDN için) ---
declare global {
  interface Window {
    FaceMesh: any;
    Camera: any;
  }
}

// --- CONFIGURATION ---
const SCAN_STEPS = [
  { 
    id: 'front', 
    label: 'Ön Görünüm', 
    instruction: 'Kameraya Düz Bakın', 
    target: { yaw: 0, pitch: 10, roll: 0, yawTolerance: 15, pitchTolerance: 20 }, 
    guideType: 'face'
  },
  { 
    id: 'left', 
    label: 'Sağ Profil', 
    instruction: 'Başınızı Yavaşça SOLA Çevirin', 
    target: { yaw: -85, pitch: 10, roll: 0, yawTolerance: 10, pitchTolerance: 40 }, 
    guideType: 'face'
  },
  { 
    id: 'right', 
    label: 'Sol Profil', 
    instruction: 'Başınızı Yavaşça SAĞA Çevirin', 
    target: { yaw: 85, pitch: 10, roll: 0, yawTolerance: 10, pitchTolerance: 40 }, 
    guideType: 'face'
  },
  { 
    id: 'top', 
    label: 'Tepe Görünümü', 
    instruction: 'Başınızı Öne Eğerek Tepeyi Gösterin', 
    target: { yaw: 0, pitch: 90, roll: 0, yawTolerance: 20, pitchTolerance: 25 }, 
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

// --- CDN SCRIPT YÜKLEYİCİ ---
const loadScript = (src: string) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(true);
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

interface LiveScannerProps {
  onComplete: (photos: any[]) => void;
  onCancel: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<any[]>([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [forceManualMode, setForceManualMode] = useState(false); // Sadece manuel butonla aktif olur
  
  // Tracking
  const [pose, setPose] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [quality, setQuality] = useState({ lighting: 'good', stability: 'stable', faceDetected: false });
  const [status, setStatus] = useState<'searching' | 'aligning' | 'locked' | 'capturing'>('searching');
  const [scanProgress, setScanProgress] = useState(0);

  // Features
  const [hairlineOffset, setHairlineOffset] = useState(0);
  const [hairStyle, setHairStyle] = useState('young');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isLowLight, setIsLowLight] = useState(false);

  // Refs
  const onResultsRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastSpeakTimeRef = useRef(0);
  const faceMeshRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);

  const currentStep = SCAN_STEPS[currentStepIndex];

  // --- TTS (SESLİ ASİSTAN) ---
  const speak = useCallback((text: string, force = false) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    
    const now = Date.now();
    if (!force && now - lastSpeakTimeRef.current < 3000) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.0;
    
    window.speechSynthesis.speak(utterance);
    lastSpeakTimeRef.current = now;
  }, [voiceEnabled]);

  // --- AR DRAWING ---
  const drawHairlineAR = (ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) => {
    if (!landmarks) return;

    const style = HAIR_STYLES[hairStyle];
    const mid = landmarks[10];
    const left = landmarks[338];
    const right = landmarks[297];

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
    
    ctx.moveTo(lx, ly + totalOffsetY + (style.curvature * 20));
    
    const cp1x = lx + (mx - lx) * 0.5;
    const cp1y = ly + totalOffsetY - (style.curvature * 10);
    const cp2x = rx + (mx - rx) * 0.5;
    const cp2y = ry + totalOffsetY - (style.curvature * 10);

    ctx.bezierCurveTo(cp1x, cp1y, mx, my + totalOffsetY, mx, my + totalOffsetY);
    ctx.bezierCurveTo(mx, my + totalOffsetY, cp2x, cp2y, rx, ry + totalOffsetY + (style.curvature * 20));

    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.8)';
    ctx.setLineDash([5, 5]);
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.stroke();
    
    ctx.fillStyle = '#4ade80';
    ctx.beginPath(); ctx.arc(mx, my + totalOffsetY, 4, 0, 2*Math.PI); ctx.fill();
    
    ctx.restore();
  };

  // --- HESAPLAMA MANTIĞI ---
  const calculatePose = (landmarks: any) => {
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
    const noseRelativeX = nose.x - midEyes.x; 
    const yaw = -(noseRelativeX / faceWidth) * 250; 

    const faceHeight = Math.abs(mouthBottom.y - midEyes.y);
    const noseRelativeY = nose.y - midEyes.y;
    const pitchRatio = noseRelativeY / faceHeight;
    const pitch = (pitchRatio - 0.4) * 150; 

    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const roll = Math.atan2(dy, dx) * (180 / Math.PI);

    return { yaw, pitch, roll };
  };

  // --- SONUÇ İŞLEME MANTIĞI ---
  const onResults = useCallback((results: any) => {
    if (!isMountedRef.current || status === 'capturing') return;
    if (!isModelLoaded) setIsModelLoaded(true);
    if (!currentStep) return;

    // 1. Brightness Check
    const pCanvas = processRef.current;
    if (pCanvas && results.image) {
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
          pCtx.drawImage(results.image, 0, 0, 50, 50);
          const imageData = pCtx.getImageData(0, 0, 50, 50);
          let totalBrightness = 0;
          const data = imageData.data;
          for(let i=0; i < data.length; i+=4) {
            totalBrightness += (data[i] + data[i+1] + data[i+2]) / 3;
          }
          const avgBrightness = totalBrightness / (data.length / 4);
          
          const lowLight = avgBrightness < 50;
          setIsLowLight(lowLight);
          
          if (lowLight && voiceEnabled && Math.random() > 0.98) {
             speak("Lütfen ışığa dönün");
          }
      }
    }

    // 2. AR Canvas Setup
    const canvas = canvasRef.current;
    if (canvas && videoRef.current) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
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

    // 3. Manual Step Logic
    if (currentStep.guideType === 'manual' || forceManualMode) {
      if (forceManualMode) {
          setStatus('locked');
      } else if (!hasFace && !isLowLight) {
          setStatus('locked');
          setScanProgress(prev => Math.min(prev + 1.5, 100));
          if (scanProgress > 80) speak("Harika, kıpırdamayın");
      } else {
          setScanProgress(0);
          if (hasFace) setStatus('aligning'); 
          if (hasFace) speak("Lütfen arkanızı dönün");
      }
      return;
    }

    // 4. FaceMesh Logic
    if (!hasFace) {
      setQuality(prev => ({ ...prev, faceDetected: false }));
      setStatus('searching');
      setScanProgress(0);
      return;
    }

    setQuality(prev => ({ ...prev, faceDetected: true }));

    const landmarks = results.multiFaceLandmarks[0];
    const headPose = calculatePose(landmarks);
    if (!headPose) return;
    setPose(headPose);

    const { target } = currentStep;
    if (!target) return;

    const yawTolerance = target.yawTolerance || 15;
    const pitchTolerance = target.pitchTolerance || 15;

    const yawDiff = headPose.yaw - target.yaw;
    const pitchDiff = headPose.pitch - target.pitch;

    const isYawGood = Math.abs(yawDiff) < yawTolerance;
    const isPitchGood = Math.abs(pitchDiff) < pitchTolerance;
    const isRollGood = Math.abs(headPose.roll - target.roll) < 15; 

    if (isYawGood && isPitchGood && isRollGood) {
      setStatus('locked');
      if (scanProgress < 100) setScanProgress(prev => prev + 3); 
      
      if (scanProgress > 80 && status !== 'locked') {
         speak("Harika, kıpırdamayın", true);
      }
    } else {
      setStatus('aligning');
      setScanProgress(prev => Math.max(0, prev - 5)); 
      
      if (Math.abs(yawDiff) > yawTolerance) {
          if (yawDiff > 0) speak("Sola dönün");
          else speak("Sağa dönün");
      } else if (Math.abs(pitchDiff) > pitchTolerance) {
          if (pitchDiff > 0) speak("Yukarı bakın");
          else speak("Aşağı bakın");
      }
    }

  }, [currentStep, scanProgress, status, isLowLight, voiceEnabled, hairStyle, hairlineOffset, speak, forceManualMode]);

  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  // --- INIT (CDN SCRIPT YÜKLEME) ---
  useEffect(() => {
    isMountedRef.current = true;

    const init = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

        if (!isMountedRef.current) return;

        const faceMesh = new window.FaceMesh({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        faceMesh.onResults((results: any) => {
          if (onResultsRef.current) {
            onResultsRef.current(results);
          }
        });

        faceMeshRef.current = faceMesh;

        if (videoRef.current) {
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (faceMeshRef.current && videoRef.current) {
                 await faceMeshRef.current.send({ image: videoRef.current });
              }
            },
            width: 1280,
            height: 720,
          });
          camera.start();
          cameraRef.current = camera;
        }

      } catch (error) {
        console.error("Başlatma hatası:", error);
        // Otomatik geçiş İPTAL EDİLDİ
        toast({ title: "Kamera Başlatılamadı", description: "Lütfen sayfayı yenileyin veya izinleri kontrol edin.", variant: "destructive" });
      }
    };

    init();

    // ZAMAN AŞIMI (TIMEOUT) İPTAL EDİLDİ (Artık sonsuza kadar bekler)

    setTimeout(() => speak(currentStep.instruction), 1000);

    return () => {
      isMountedRef.current = false;
      if (cameraRef.current) cameraRef.current.stop();
      if (faceMeshRef.current) faceMeshRef.current.close();
      window.speechSynthesis.cancel();
    };
  }, []); 

  // Auto-capture
  useEffect(() => {
    if (scanProgress >= 100 && status !== 'capturing') {
      handleCapture();
    }
  }, [scanProgress, status]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !isMountedRef.current) return;
    
    setStatus('capturing');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1024 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        const newPhoto = {
          id: Date.now(),
          preview: dataUrl,
          type: currentStep.id,
          metadata: { hairStyle, hairlineOffset }
        };
        
        setCapturedImages(prev => [...prev, newPhoto]);

        const flash = document.createElement('div');
        flash.className = 'fixed inset-0 bg-white z-[60] animate-out fade-out duration-500 pointer-events-none';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 500);

        setTimeout(() => {
          if (!isMountedRef.current) return;
          
          if (currentStepIndex < SCAN_STEPS.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
            setScanProgress(0);
            setStatus('searching');
            setTimeout(() => speak(SCAN_STEPS[currentStepIndex + 1].instruction, true), 500);
          } else {
            onComplete([...capturedImages, newPhoto]);
          }
        }, 1000);
    }
  }, [currentStep, currentStepIndex, onComplete, hairStyle, hairlineOffset, speak, capturedImages]);

  if (!currentStep) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <canvas ref={processRef} width="50" height="50" className="hidden" />

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
        <button 
          onClick={onCancel}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm pointer-events-auto"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* CAMERA VIEW */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden flex items-center justify-center">
        {!isModelLoaded && !forceManualMode && (
          <div className="absolute z-30 flex flex-col items-center text-white/70">
            <RefreshCw className="w-10 h-10 animate-spin mb-2" />
            <p>AI Sistemi Başlatılıyor...</p>
          </div>
        )}

        <video 
          ref={videoRef}
          autoPlay 
          playsInline 
          muted
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" 
        />
        
        <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none transform scale-x-[-1]"
        />

        {/* SLIDER CONTROLS */}
        {currentStep.guideType === 'face' && !forceManualMode && (
            <div className="absolute right-4 top-1/4 bottom-1/3 flex flex-col items-center justify-center z-40 pointer-events-auto">
                <div className="bg-black/40 backdrop-blur-md rounded-full py-6 px-2 border border-white/10 flex flex-col items-center gap-4 shadow-xl">
                    <MousePointerClick className="w-5 h-5 text-white/70 mb-2" />
                    <div className="h-64 w-8 relative flex items-center justify-center">
                        <input 
                            type="range" 
                            min="-50" 
                            max="50" 
                            value={hairlineOffset} 
                            onChange={(e) => setHairlineOffset(parseInt(e.target.value))}
                            className="absolute -rotate-90 w-64 h-8 bg-transparent cursor-pointer appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-track]:w-full [&::-webkit-slider-track]:h-1 [&::-webkit-slider-track]:bg-white/30 [&::-webkit-slider-track]:rounded-full"
                        />
                    </div>
                    <span className="text-[10px] text-white/70 font-medium uppercase rotate-[-90deg] mt-4 whitespace-nowrap">
                        Saç Çizgisi
                    </span>
                </div>
            </div>
        )}

        {/* LOW LIGHT WARNING */}
        {isLowLight && (
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-24 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white px-6 py-2 rounded-full flex items-center gap-2 z-40 shadow-lg backdrop-blur-sm"
            >
                <Sun className="w-5 h-5 animate-pulse" />
                <span className="font-bold text-sm">Lütfen ışığa dönün</span>
            </motion.div>
        )}
        
        {/* HUD OVERLAY */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                animate={{
                  borderColor: status === 'locked' ? '#4ade80' : status === 'aligning' ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                  borderWidth: status === 'locked' ? 4 : 2,
                  scale: status === 'locked' ? 1.05 : 1
                }}
                className="w-[350px] h-[480px] rounded-[4rem] border-2 relative overflow-hidden shadow-2xl transition-colors duration-300 bg-transparent"
              >
                <AnimatePresence>
                  {(status === 'locked' || status === 'capturing') && (
                    <motion.div
                      initial={{ top: "0%" }}
                      animate={{ top: "100%" }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute left-0 right-0 h-1 bg-green-400 shadow-[0_0_15px_rgba(74,222,128,0.8)] z-10"
                    />
                  )}
                </AnimatePresence>

                {!quality.faceDetected && currentStep.guideType !== 'manual' && isModelLoaded && !forceManualMode && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
                    <User className="w-16 h-16 text-white/50 mb-2" />
                    <span className="bg-red-500/80 text-white px-3 py-1 rounded-full text-sm font-bold">
                      Yüz Aranıyor...
                    </span>
                  </div>
                )}
              </motion.div>
          </div>

          <div className="absolute bottom-36 left-0 right-0 text-center space-y-4 pointer-events-auto z-30"> 
              <motion.div
               key={currentStep.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="inline-block bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl"
              >
               <h3 className="text-xl font-bold text-white">{currentStep.instruction}</h3>
               {status === 'locked' && (
                 <p className="text-green-400 text-sm mt-1 font-bold tracking-wider animate-pulse uppercase">
                   Harika, kıpırdamayın
                 </p>
               )}
               {forceManualMode && (
                   <p className="text-amber-400 text-xs mt-1">(Manuel Mod Aktif)</p>
               )}
              </motion.div>
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div className="bg-black/90 backdrop-blur-xl p-4 pb-8 flex flex-col items-center border-t border-white/10 relative z-50">
        
        {/* Hair Style Selector */}
        {currentStep.guideType === 'face' && !forceManualMode && (
            <div className="flex gap-2 mb-6 w-full justify-center px-4 overflow-x-auto">
                {Object.entries(HAIR_STYLES).map(([key, style]) => (
                    <button
                        key={key}
                        onClick={() => setHairStyle(key)}
                        className={`px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 border ${
                            hairStyle === key 
                            ? 'bg-white text-black border-white scale-105 shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                            : 'bg-white/10 text-white/70 border-white/10 hover:bg-white/20'
                        }`}
                    >
                        {style.label}
                    </button>
                ))}
            </div>
        )}

        <div className="flex items-center justify-between w-full max-w-md px-8">
            <div className="relative w-20 h-20 flex items-center justify-center mx-auto">
            <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#374151" strokeWidth="4" />
                <circle 
                cx="40" cy="40" r="36" 
                fill="none" 
                stroke={status === 'locked' || status === 'capturing' ? '#4ade80' : '#6366f1'} 
                strokeWidth="4"
                strokeDasharray={226}
                strokeDashoffset={226 - (226 * scanProgress) / 100}
                strokeLinecap="round"
                className="transition-all duration-100 ease-linear"
                />
            </svg>
            
            <button
                onClick={() => {
                    if (forceManualMode) handleCapture();
                    else setScanProgress(100);
                }}
                className="relative w-14 h-14 rounded-full bg-white hover:scale-95 transition-transform flex items-center justify-center group shadow-lg shadow-white/20"
            >
                {status === 'capturing' ? (
                <Check className="w-6 h-6 text-green-600" />
                ) : (
                <CameraIcon className="w-6 h-6 text-gray-900 group-hover:text-indigo-600 transition-colors" />
                )}
            </button>
            </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveScanner;