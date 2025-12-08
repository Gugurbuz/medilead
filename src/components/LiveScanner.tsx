import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, RefreshCw, X, User, Check, Sun, Volume2, VolumeX, Wand2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

// --- CONFIGURATION ---
// Bu modelin çalıştığını doğruladık, link değişirse çalışmaz.
const MODEL_PATH = 'https://uzootohvsanqlhijmkpn.supabase.co/storage/v1/object/public/models/face_parsing_bisenet.onnx';

const SCAN_STEPS = [
  { id: 'front', label: 'Ön Görünüm', instruction: 'Kameraya Düz Bakın', target: { yaw: 0, pitch: 0, roll: 0, tolerance: 15 }, guideType: 'face' },
  { id: 'left', label: 'Sağ Profil', instruction: 'Yavaşça SOLA Dönün', target: { yaw: -85, pitch: 0, roll: 0, tolerance: 20 }, guideType: 'face' },
  { id: 'right', label: 'Sol Profil', instruction: 'Yavaşça SAĞA Dönün', target: { yaw: 85, pitch: 0, roll: 0, tolerance: 20 }, guideType: 'face' },
  { id: 'top', label: 'Tepe Görünümü', instruction: 'Başınızı Öne Eğerek Tepeyi Gösterin', target: { yaw: 0, pitch: 60, roll: 0, tolerance: 30 }, guideType: 'face' },
  { id: 'back', label: 'Donör Bölge', instruction: 'Arkanızı Dönün', target: null, guideType: 'manual' },
];

// --- SCRIPT LOADER (GARANTİLİ YÜKLEME) ---
const loadScript = (src: string, globalName: string) => {
  return new Promise((resolve, reject) => {
    if ((window as any)[globalName]) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error(`Script load error: ${src}`));
    document.body.appendChild(script);
  });
};

interface LiveScannerProps {
  onComplete: (photos: any[]) => void;
  onCancel: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onComplete, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // AR Canvas
  const { toast } = useToast();

  // State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState<any[]>([]);
  const [modelStatus, setModelStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [status, setStatus] = useState<'searching' | 'aligning' | 'locked' | 'capturing'>('searching');
  const [scanProgress, setScanProgress] = useState(0);
  const [showHairMask, setShowHairMask] = useState(true); // AR Maskesi Açık/Kapalı
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // Refs
  const isMountedRef = useRef(true);
  const sessionRef = useRef<any>(null); // ONNX Session
  const faceMeshRef = useRef<any>(null); // MediaPipe
  const processingRef = useRef(false); // Segmentasyon kilidi
  const lastSpeakTimeRef = useRef(0);

  const currentStep = SCAN_STEPS[currentStepIndex];

  // --- 1. TTS (SESLİ ASİSTAN) ---
  const speak = useCallback((text: string, force = false) => {
    if (!voiceEnabled || !window.speechSynthesis) return;
    const now = Date.now();
    if (!force && now - lastSpeakTimeRef.current < 3000) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US'; // Veya 'tr-TR'
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
    lastSpeakTimeRef.current = now;
  }, [voiceEnabled]);

  // --- 2. INIT: SCRIPTS & AI MODELS ---
  useEffect(() => {
    isMountedRef.current = true;

    const initSystem = async () => {
      try {
        console.log("Sistem başlatılıyor...");
        
        // A. Scriptleri Sırayla Yükle (Çatışmayı önlemek için)
        // ONNX Runtime (WASM Backend ile)
        await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.min.js', 'ort');
        // MediaPipe FaceMesh
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js', 'FaceMesh');
        // MediaPipe Camera Utils
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js', 'Camera');

        if (!isMountedRef.current) return;

        // B. ONNX Session Başlat (CRITICAL: WASM YOLUNU AYARLA)
        const ort = (window as any).ort;
        if (ort) {
            // WASM dosyalarını CDN'den çekmesi için yolu zorluyoruz
            ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/";
            
            const session = await ort.InferenceSession.create(MODEL_PATH, {
                executionProviders: ['webgl', 'wasm'], // WebGL öncelikli
                graphOptimizationLevel: 'all'
            });
            sessionRef.current = session;
            console.log("✅ ONNX Segmentasyon Modeli Hazır");
        }

        // C. MediaPipe FaceMesh Başlat
        const FaceMesh = (window as any).FaceMesh;
        const faceMesh = new FaceMesh({
            locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`,
        });
        
        faceMesh.setOptions({
            maxNumFaces: 1,
            refineLandmarks: true,
            minDetectionConfidence: 0.5,
            minTrackingConfidence: 0.5,
        });
        
        faceMesh.onResults(onResults);
        faceMeshRef.current = faceMesh;
        console.log("✅ FaceMesh Hazır");

        // D. Kamerayı Başlat
        if (videoRef.current) {
            const Camera = (window as any).Camera;
            const camera = new Camera(videoRef.current, {
                onFrame: async () => {
                    if (videoRef.current && faceMeshRef.current) {
                        await faceMeshRef.current.send({ image: videoRef.current });
                    }
                    // Segmentasyonu da her karede tetikle (async, bloklamaz)
                    if (sessionRef.current && showHairMask) {
                        requestAnimationFrame(() => runSegmentationLoop());
                    }
                },
                width: 640, // Performans için optimize boyut
                height: 480
            });
            camera.start();
        }

        setModelStatus('ready');
        speak(currentStep.instruction);

      } catch (err) {
        console.error("Başlatma Hatası:", err);
        setModelStatus('error');
        toast({ 
            title: "Model Yüklenemedi", 
            description: "Manuel moda geçiliyor. Lütfen internet bağlantınızı kontrol edin.", 
            variant: "destructive" 
        });
      }
    };

    initSystem();

    return () => {
        isMountedRef.current = false;
        if (faceMeshRef.current) faceMeshRef.current.close();
        window.speechSynthesis.cancel();
    };
  }, []);

  // --- 3. SEGMENTASYON DÖNGÜSÜ (CORE AR LOGIC) ---
  const runSegmentationLoop = async () => {
    if (processingRef.current || !videoRef.current || !canvasRef.current || !sessionRef.current) return;
    
    processingRef.current = true;
    try {
        const ort = (window as any).ort;
        const video = videoRef.current;
        
        // Model Input Boyutu (BiSeNet için 512x512 standarttır)
        const dims = [1, 3, 512, 512];
        const size = dims[2] * dims[3];
        
        // 1. Preprocessing (Canvas'a çizip veriyi al)
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = dims[2];
        tempCanvas.height = dims[3];
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(video, 0, 0, dims[2], dims[3]);
        const imgData = ctx.getImageData(0, 0, dims[2], dims[3]);
        const { data } = imgData;

        // 2. Normalization & Tensor Creation (Float32)
        const input = new Float32Array(dims[1] * size);
        const mean = [0.485, 0.456, 0.406];
        const std = [0.229, 0.224, 0.225];

        for (let i = 0; i < size; i++) {
            // R
            input[i] = ((data[i * 4] / 255) - mean[0]) / std[0];
            // G
            input[i + size] = ((data[i * 4 + 1] / 255) - mean[1]) / std[1];
            // B
            input[i + size * 2] = ((data[i * 4 + 2] / 255) - mean[2]) / std[2];
        }

        const inputTensor = new ort.Tensor('float32', input, dims);

        // 3. Inference
        const feeds = { [sessionRef.current.inputNames[0]]: inputTensor };
        const results = await sessionRef.current.run(feeds);
        const output = results[sessionRef.current.outputNames[0]].data;

        // 4. Postprocessing (Maske Çizimi)
        drawMask(output, video.videoWidth, video.videoHeight);

    } catch (e) {
        console.error("Segmentation Error:", e);
    } finally {
        processingRef.current = false;
    }
  };

  const drawMask = (data: any, width: number, height: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Maske Canvas'ı
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = 512;
    maskCanvas.height = 512;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const imgData = maskCtx.createImageData(512, 512);
    const pixels = imgData.data;
    const hairClass = 17; // BiSeNet saç sınıfı

    // ArgMax simülasyonu (Hız için basitleştirilmiş)
    for (let i = 0; i < 512 * 512; i++) {
        // Model çıktısı flat array. 19 sınıf var.
        // Hızlı kontrol: Eğer 17. sınıfın değeri yüksekse saça boya
        // (Tam döngü tarayıcıda çok yavaş olur, o yüzden sadece saç kanalına bakıp threshold koyuyoruz veya max arıyoruz)
        // Not: Çıktı formatı [1, 19, 512, 512]. i. pikselin saç skoru: data[17 * size + i]
        
        let maxVal = -Infinity;
        let maxClass = 0;
        
        // Sadece saç (17) ve arka plan (0) veya cilt (1) karşılaştırması yeterli olabilir performans için
        // Ama doğru sonuç için full loop:
        for(let c=0; c<19; c++) {
            const val = data[c * 512 * 512 + i];
            if (val > maxVal) { maxVal = val; maxClass = c; }
        }

        if (maxClass === hairClass) {
            const p = i * 4;
            pixels[p] = 74;      // R
            pixels[p + 1] = 222; // G
            pixels[p + 2] = 128; // B
            pixels[p + 3] = 180; // Alpha (Görünürlük)
        }
    }

    maskCtx.putImageData(imgData, 0, 0);

    // Ana ekrana scale ederek çiz
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1); // Ayna efekti
    ctx.drawImage(maskCanvas, 0, 0, width, height);
    ctx.restore();
  };

  // --- 4. POZ VE MANTIK KONTROLÜ ---
  const calculatePose = (landmarks: any) => {
    const nose = landmarks[1];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const leftEye = landmarks[33];
    const rightEye = landmarks[263];
    const mouthBottom = landmarks[14];
    
    const midEyes = { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 };
    const faceWidth = Math.abs(rightCheek.x - leftCheek.x);
    
    // Yaw: Sağa sola dönüş
    const noseRelativeX = nose.x - midEyes.x; 
    const yaw = -(noseRelativeX / faceWidth) * 250; 

    // Pitch: Yukarı aşağı bakış
    const faceHeight = Math.abs(mouthBottom.y - midEyes.y);
    const noseRelativeY = nose.y - midEyes.y;
    const pitchRatio = noseRelativeY / faceHeight;
    const pitch = (pitchRatio - 0.4) * 150; 

    // Roll: Kafa eğikliği
    const dx = rightEye.x - leftEye.x;
    const dy = rightEye.y - leftEye.y;
    const roll = Math.atan2(dy, dx) * (180 / Math.PI);

    return { yaw, pitch, roll };
  };

  const onResults = useCallback((results: any) => {
    if (!isMountedRef.current || status === 'capturing') return;
    if (!currentStep) return;

    const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;

    // A. Manuel Mod (Arka Görünüm)
    if (currentStep.guideType === 'manual') {
        if (!hasFace) { // Yüz yoksa arkası dönük varsay
            setStatus('locked');
            setScanProgress(prev => Math.min(prev + 1.5, 100));
            if (scanProgress > 80) speak("Perfect, hold still");
        } else {
            setScanProgress(0);
            setStatus('aligning');
            speak("Please turn around");
        }
        return;
    }

    // B. Yüz Modu
    if (!hasFace) {
        setStatus('searching');
        setScanProgress(0);
        return;
    }

    // Poz Kontrolü
    const landmarks = results.multiFaceLandmarks[0];
    const headPose = calculatePose(landmarks);
    
    const { target } = currentStep;
    if (!target) return;

    const yawDiff = headPose.yaw - target.yaw;
    const pitchDiff = headPose.pitch - target.pitch;

    const isYawGood = Math.abs(yawDiff) < (target.tolerance || 15);
    const isPitchGood = Math.abs(pitchDiff) < (target.tolerance || 15);

    if (isYawGood && isPitchGood) {
        setStatus('locked');
        if (scanProgress < 100) setScanProgress(prev => prev + 3);
        if (scanProgress > 80 && status !== 'locked') speak("Perfect, hold still", true);
    } else {
        setStatus('aligning');
        setScanProgress(prev => Math.max(0, prev - 5));
        
        // Yönlendirme (İngilizce)
        if (!isYawGood) {
            if (yawDiff > 0) speak("Turn Left");
            else speak("Turn Right");
        } else if (!isPitchGood) {
            if (pitchDiff > 0) speak("Look Up");
            else speak("Look Down");
        }
    }
  }, [currentStep, scanProgress, status, speak]);

  // --- 5. FOTOĞRAF ÇEKİMİ ---
  useEffect(() => {
    if (scanProgress >= 100 && status !== 'capturing') handleCapture();
  }, [scanProgress, status]);

  const handleCapture = useCallback(() => {
    if (!videoRef.current) return;
    setStatus('capturing');
    
    // Fotoğrafı al
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    // Kaydet
    setCapturedImages(prev => [...prev, {
        id: Date.now(),
        preview: dataUrl,
        type: currentStep.id
    }]);

    // Efekt
    const flash = document.createElement('div');
    flash.className = 'fixed inset-0 bg-white z-[60] animate-out fade-out duration-500 pointer-events-none';
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 500);

    // İlerleme
    setTimeout(() => {
        if (currentStepIndex < SCAN_STEPS.length - 1) {
            setCurrentStepIndex(p => p + 1);
            setScanProgress(0);
            setStatus('searching');
            setTimeout(() => speak(SCAN_STEPS[currentStepIndex + 1].instruction), 500);
        } else {
            onComplete([...capturedImages, { preview: dataUrl, type: currentStep.id }]);
        }
    }, 1000);
  }, [currentStep, currentStepIndex, capturedImages, speak, onComplete]);

  if (!currentStep) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start text-white pointer-events-none">
        <div className="pointer-events-auto">
            <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">STEP {currentStepIndex + 1}/{SCAN_STEPS.length}</span>
            <h2 className="text-xl font-bold mt-1 drop-shadow-md">{currentStep.label}</h2>
        </div>
        <div className="flex gap-2 pointer-events-auto">
            <Button variant="ghost" size="icon" className="bg-white/10 text-white rounded-full" onClick={() => setShowHairMask(!showHairMask)}>
                <Wand2 className={`w-5 h-5 ${showHairMask ? 'text-green-400' : 'text-gray-400'}`} />
            </Button>
            <Button variant="ghost" size="icon" className="bg-white/10 text-white rounded-full" onClick={() => setVoiceEnabled(!voiceEnabled)}>
                {voiceEnabled ? <Volume2 className="w-5 h-5"/> : <VolumeX className="w-5 h-5"/>}
            </Button>
            <Button onClick={onCancel} variant="ghost" size="icon" className="bg-white/10 text-white rounded-full"><X/></Button>
        </div>
      </div>

      {/* VIEWPORT */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden flex items-center justify-center">
        {modelStatus === 'loading' && (
            <div className="absolute z-30 flex flex-col items-center text-white/70 animate-pulse">
                <RefreshCw className="w-10 h-10 animate-spin mb-2" />
                <p>Initializing AI System...</p>
            </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" />
        
        {/* AR SEGMENTATION LAYER */}
        <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${showHairMask ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`} />

        {/* HUD */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div 
                animate={{ 
                    borderColor: status === 'locked' ? '#4ade80' : status === 'aligning' ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                    borderWidth: status === 'locked' ? 6 : 2
                }}
                className="w-[300px] h-[400px] rounded-[3rem] border-2 relative shadow-2xl"
            >
                {status === 'locked' && <div className="absolute inset-0 border-4 border-green-400 rounded-[3rem] animate-pulse" />}
            </motion.div>
        </div>
        
        {/* INSTRUCTIONS */}
        <div className="absolute bottom-32 bg-black/60 px-6 py-3 rounded-2xl text-white backdrop-blur-md pointer-events-none">
            <p className="font-bold text-lg">{currentStep.instruction}</p>
            {status === 'locked' && <p className="text-green-400 text-sm mt-1 animate-pulse">Perfect, Hold Still</p>}
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-black/90 p-6 flex justify-center border-t border-white/10 relative z-50">
        <div className="relative w-20 h-20 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#374151" strokeWidth="4" />
                <circle cx="40" cy="40" r="36" fill="none" stroke={status === 'locked' ? '#4ade80' : '#6366f1'} strokeWidth="4"
                    strokeDasharray={226} strokeDashoffset={226 - (226 * scanProgress) / 100} strokeLinecap="round" className="transition-all duration-100 linear" />
            </svg>
            <button className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform" onClick={() => setScanProgress(100)}>
                {status === 'capturing' ? <Check className="text-green-600 w-6 h-6"/> : <CameraIcon className="text-black w-6 h-6"/>}
            </button>
        </div>
      </div>
    </div>
  );
};

export default LiveScanner;