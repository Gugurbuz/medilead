import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera as CameraIcon, RefreshCw, X, User, Check, Sun, 
  Volume2, VolumeX, Wand2 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

// --- GLOBAL TİPLER (CDN İÇİN) ---
declare global {
  interface Window {
    ort: any; // ONNX Runtime Web
    FaceMesh: any;
    Camera: any;
  }
}

// --- CONFIGURATION ---
const MODEL_PATH = 'https://uzootohvsanqlhijmkpn.supabase.co/storage/v1/object/public/models/face_parsing_bisenet.onnx';
const SCAN_STEPS = [
  { id: 'front', label: 'Ön Görünüm', instruction: 'Kameraya Düz Bakın', target: { yaw: 0, pitch: 0, roll: 0, tolerance: 15 }, guideType: 'face' },
  { id: 'left', label: 'Sağ Profil', instruction: 'Sola Dönün', target: { yaw: -50, pitch: 0, roll: 0, tolerance: 20 }, guideType: 'face' },
  { id: 'right', label: 'Sol Profil', instruction: 'Sağa Dönün', target: { yaw: 50, pitch: 0, roll: 0, tolerance: 20 }, guideType: 'face' },
  { id: 'back', label: 'Donör Bölge', instruction: 'Arkanızı Dönün', target: null, guideType: 'manual' },
];

// --- SCRIPTS (ONNX & MEDIAPIPE) ---
const loadScript = (src: string) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve(true);
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve(true);
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

const LiveScanner = ({ onComplete, onCancel }: { onComplete: any, onCancel: any }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const segmentationCanvasRef = useRef<HTMLCanvasElement>(null); // Sadece AI işlemi için
  const { toast } = useToast();

  // State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [status, setStatus] = useState<'searching' | 'aligning' | 'locked' | 'capturing'>('searching');
  const [scanProgress, setScanProgress] = useState(0);
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showHairMask, setShowHairMask] = useState(true); // AR Saç Göster/Gizle
  
  // Refs
  const sessionRef = useRef<any>(null);
  const isMountedRef = useRef(true);
  const lastInferenceTime = useRef(0);
  const processingRef = useRef(false);

  const currentStep = SCAN_STEPS[currentStepIndex];

  // --- 1. MODEL YÜKLEME (ONNX) ---
  useEffect(() => {
    isMountedRef.current = true;
    const initAI = async () => {
      try {
        // Scriptleri yükle
        await loadScript('https://cdn.jsdelivr.net/npm/onnxruntime-web@1.14.0/dist/ort.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

        if (!isMountedRef.current) return;

        // ONNX Session Başlat
        const session = await window.ort.InferenceSession.create(MODEL_PATH, {
            executionProviders: ['wasm', 'webgl'], // WebGL hızlandırıcı
            graphOptimizationLevel: 'all'
        });
        sessionRef.current = session;
        console.log("ONNX Model Yüklendi!");
        
        // Mediapip Başlat (Yüz takibi için)
        initFaceMesh();

        setIsAiLoading(false);
      } catch (e) {
        console.error("AI Başlatma Hatası:", e);
        toast({ title: "AI Modeli Yüklenemedi", description: "Manuel moda geçiliyor.", variant: "destructive" });
        setIsAiLoading(false);
      }
    };
    initAI();

    return () => { isMountedRef.current = false; };
  }, []);

  // --- 2. MEDIAPIPE FACE MESH ---
  const initFaceMesh = () => {
    const faceMesh = new window.FaceMesh({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`,
    });
    faceMesh.setOptions({ maxNumFaces: 1, minDetectionConfidence: 0.5 });
    
    faceMesh.onResults((results: any) => {
        if(!isMountedRef.current) return;
        
        // Yüz Takibi Mantığı (Pozisyon)
        if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
            checkPose(results.multiFaceLandmarks[0]);
        } else {
            if (currentStep.guideType !== 'manual') setStatus('searching');
        }

        // Segmentation Döngüsünü Tetikle (Her frame değil, kontrollü)
        runSegmentation();
    });

    if (videoRef.current) {
      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (videoRef.current) await faceMesh.send({ image: videoRef.current });
        },
        width: 640, // Performans için düşük çözünürlük
        height: 480
      });
      camera.start();
    }
  };

  // --- 3. GERÇEK ZAMANLI SAÇ SEGMENTASYONU (CORE LOGIC) ---
  const runSegmentation = async () => {
    // Şartlar: Model yüklü mü? Video var mı? AR açık mı? İşlem sürüyor mu?
    if (!sessionRef.current || !videoRef.current || !canvasRef.current || !showHairMask || processingRef.current) return;

    // FPS Limiti: Saniyede max 10 kare işle (Tarayıcıyı dondurmamak için)
    const now = Date.now();
    if (now - lastInferenceTime.current < 100) return; 
    
    processingRef.current = true;
    lastInferenceTime.current = now;

    try {
        const video = videoRef.current;
        const width = 512; // Modelin istediği boyut
        const height = 512;

        // 1. Videoyu 512x512 Canvas'a çiz (Preprocessing)
        if (!segmentationCanvasRef.current) {
            segmentationCanvasRef.current = document.createElement('canvas');
            segmentationCanvasRef.current.width = width;
            segmentationCanvasRef.current.height = height;
        }
        const ctx = segmentationCanvasRef.current.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(video, 0, 0, width, height);
        const imageData = ctx.getImageData(0, 0, width, height);
        
        // 2. Tensöre Çevir & Normalize Et (Mean/Std ImageNet)
        const inputTensor = preprocess(imageData.data, width, height);

        // 3. Modeli Çalıştır (Inference)
        const feeds = { [sessionRef.current.inputNames[0]]: inputTensor };
        const results = await sessionRef.current.run(feeds);
        const output = results[sessionRef.current.outputNames[0]];

        // 4. Sonucu Görsele Çevir (Postprocessing)
        drawSegmentationMask(output.data, video.videoWidth, video.videoHeight);

    } catch (err) {
        console.error("Segmentation Loop Hatası:", err);
    } finally {
        processingRef.current = false;
    }
  };

  // --- YARDIMCI: TENSOR HAZIRLAMA ---
  const preprocess = (data: Uint8ClampedArray, width: number, height: number) => {
    const float32Data = new Float32Array(3 * width * height);
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < width * height; i++) {
        const r = data[i * 4] / 255.0;
        const g = data[i * 4 + 1] / 255.0;
        const b = data[i * 4 + 2] / 255.0;

        float32Data[i] = (r - mean[0]) / std[0]; // R
        float32Data[i + width * height] = (g - mean[1]) / std[1]; // G
        float32Data[i + 2 * width * height] = (b - mean[2]) / std[2]; // B
    }
    return new window.ort.Tensor('float32', float32Data, [1, 3, height, width]);
  };

  // --- YARDIMCI: MASKE ÇİZME ---
  const drawSegmentationMask = (data: Float32Array, targetW: number, targetH: number) => {
    const mainCanvas = canvasRef.current;
    if (!mainCanvas) return;
    const ctx = mainCanvas.getContext('2d');
    if (!ctx) return;

    // Canvas boyutunu videoya eşitle
    mainCanvas.width = targetW;
    mainCanvas.height = targetH;
    
    // Geçici Maske Canvas'ı (512x512)
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = 512;
    maskCanvas.height = 512;
    const maskCtx = maskCanvas.getContext('2d');
    if(!maskCtx) return;

    const imgData = maskCtx.createImageData(512, 512);
    const pixels = imgData.data;

    // Argmax işlemi (En yüksek olasılıklı sınıfı bul)
    // BiSeNet çıktısı [1, 19, 512, 512] şeklindedir (flattened)
    const size = 512 * 512;
    const hairClass = 17; // BiSeNet standart saç sınıfı

    for (let i = 0; i < size; i++) {
        let maxVal = -Infinity;
        let maxClass = 0;
        
        // Basitleştirilmiş kontrol: Sadece Saç (17) sınıfının skoruna bakabiliriz hız için
        // Ancak doğrusu argmax'tır. Hız için sadece 0 (arkaplan) ve 17 (saç) karşılaştırması yapalım:
        // Not: Tam doğruluk için 19 sınıfı gezmek gerekir ama JS'de yavaştır.
        // Burada full döngü yerine basitleştirilmiş bir yaklaşım kullanıyoruz:
        
        // Hızlı Yöntem: Sadece belirli indexlere bak (optimization)
        // Düzgün bir visualization için full loop yapalım, WASM hızlıdır.
        
        for(let c=0; c<19; c++) {
            const val = data[c * size + i];
            if(val > maxVal) { maxVal = val; maxClass = c; }
        }

        if (maxClass === hairClass) {
            const pid = i * 4;
            pixels[pid] = 74;      // R
            pixels[pid + 1] = 222; // G (Yeşilimsi)
            pixels[pid + 2] = 128; // B
            pixels[pid + 3] = 160; // Alpha (Yarı saydam)
        }
    }

    maskCtx.putImageData(imgData, 0, 0);

    // Ana Canvas'a çiz (Scale & Mirror)
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.save();
    ctx.translate(targetW, 0);
    ctx.scale(-1, 1); // Aynalama
    // Maskeyi video boyutuna gererek çiz
    ctx.drawImage(maskCanvas, 0, 0, targetW, targetH);
    ctx.restore();
  };

  // --- POZ KONTROLÜ (SENİN MANTIĞIN) ---
  const checkPose = (landmarks: any) => {
     if(currentStep.guideType === 'manual') return;

     const nose = landmarks[1];
     const leftEye = landmarks[33];
     const rightEye = landmarks[263];
     
     // Basit Yaw Hesabı
     const width = Math.abs(landmarks[454].x - landmarks[234].x);
     const mid = (leftEye.x + rightEye.x) / 2;
     const yaw = -((nose.x - mid) / width) * 200;

     const target = currentStep.target!;
     const diff = Math.abs(yaw - target.yaw);

     if (diff < target.tolerance) {
         setStatus('locked');
         if(scanProgress < 100) setScanProgress(p => p + 2);
         if(scanProgress >= 100 && status !== 'capturing') handleCapture();
     } else {
         setStatus('aligning');
         setScanProgress(0);
     }
  };

  const handleCapture = () => {
     setStatus('capturing');
     // Fotoğraf çekme mantığı buraya...
     setTimeout(() => {
         if (currentStepIndex < SCAN_STEPS.length - 1) {
             setCurrentStepIndex(p => p + 1);
             setScanProgress(0);
             setStatus('searching');
         } else {
             onComplete([]);
         }
     }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* HEADER */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 flex justify-between items-start text-white">
        <div>
            <span className="bg-white/20 px-2 py-1 rounded text-xs font-bold">ADIM {currentStepIndex + 1}/{SCAN_STEPS.length}</span>
            <h2 className="text-xl font-bold mt-1 drop-shadow-md">{currentStep.label}</h2>
        </div>
        <div className="flex gap-2">
            <Button 
                variant="ghost" 
                size="icon" 
                className="bg-white/10 text-white rounded-full"
                onClick={() => setShowHairMask(!showHairMask)}
            >
                <Wand2 className={`w-5 h-5 ${showHairMask ? 'text-green-400' : 'text-gray-400'}`} />
            </Button>
            <Button onClick={onCancel} variant="ghost" size="icon" className="bg-white/10 text-white rounded-full"><X/></Button>
        </div>
      </div>

      {/* KAMERA VE AR */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden flex items-center justify-center">
        {isAiLoading && (
            <div className="absolute z-30 flex flex-col items-center text-white/70 animate-pulse">
                <RefreshCw className="w-10 h-10 animate-spin mb-2" />
                <p>AI Modeli Yükleniyor...</p>
                <p className="text-xs opacity-50 mt-1">(Bu işlem cihazınıza bağlı olarak zaman alabilir)</p>
            </div>
        )}

        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]" />
        
        {/* SEGMENTATION MASK LAYER */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

        {/* HUD */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div 
                animate={{ 
                    borderColor: status === 'locked' ? '#4ade80' : 'rgba(255,255,255,0.3)',
                    borderWidth: status === 'locked' ? 4 : 2
                }}
                className="w-[300px] h-[400px] rounded-[3rem] border-2 relative"
            >
                {status === 'locked' && <div className="absolute inset-0 border-4 border-green-400 rounded-[3rem] animate-pulse" />}
            </motion.div>
        </div>
        
        {/* INSTRUCTION */}
        <div className="absolute bottom-32 bg-black/60 px-6 py-3 rounded-2xl text-white backdrop-blur-md">
            <p className="font-bold text-lg">{currentStep.instruction}</p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="bg-black/80 p-6 flex justify-center border-t border-white/10 relative z-50">
        <button className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg active:scale-95 transition-transform" onClick={() => setScanProgress(100)}>
            {status === 'capturing' ? <Check className="text-green-600 w-8 h-8"/> : <CameraIcon className="text-black w-8 h-8"/>}
        </button>
      </div>
    </div>
  );
};

export default LiveScanner;