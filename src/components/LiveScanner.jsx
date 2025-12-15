import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon, RefreshCw, X, User, Sun, Check, AlertCircle,
  SlidersHorizontal, Layers, Activity, Droplets, Sparkles
} from 'lucide-react';
// Import path fixed to relative to avoid alias issues
import { useToast } from './ui/use-toast';

// MediaPipe imports removed to prevent build errors.
// We will load them dynamically from CDN.

// Configuration for scan steps
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
    instruction: 'Başınızı ÖNE eğerek tepeyi gösterin',
    // Top view is tricky for face detection. We set guideType to 'manual' or handle it specifically.
    // Setting to manual to avoid "No Face Detected" errors when looking down.
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

// Helper to load external scripts dynamically
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
};

// Simple Range Slider Component
const RangeControl = ({ icon: Icon, label, value, onChange, min = 0, max = 200 }) => (
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
        className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-125"
      />
    </div>
  </div>
);

const LiveScanner = ({ onComplete, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const { toast } = useToast();

  // Logic State
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [capturedImages, setCapturedImages] = useState([]);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isSegmenterLoaded, setIsSegmenterLoaded] = useState(false);
  
  // Camera Settings
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [activeOverlay, setActiveOverlay] = useState('hairline'); 
  const [showSettings, setShowSettings] = useState(false);

  // Tracking State
  const [pose, setPose] = useState({ yaw: 0, pitch: 0, roll: 0 });
  const [quality, setQuality] = useState({ lighting: 'good', stability: 'stable', faceDetected: false });
  const [status, setStatus] = useState('searching'); 
  const [scanProgress, setScanProgress] = useState(0);
  
  // Refs
  const onResultsRef = useRef(null);
  const isMountedRef = useRef(true);
  const faceMeshRef = useRef(null);
  const cameraRef = useRef(null);
  const hairSegmenterRef = useRef(null);
  const lastLandmarksRef = useRef(null);

  const currentStep = SCAN_STEPS[currentStepIndex];

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (cameraRef.current) {
        try { cameraRef.current.stop(); } catch(e) {}
      }
      if (faceMeshRef.current) {
        try { faceMeshRef.current.close(); } catch(e) {}
      }
    };
  }, []);

  // Calculate Head Pose
  const calculatePose = (landmarks) => {
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
      z: (leftEye.z + rightEye.z) / 2 
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

  // Segment Hair using MediaPipe Image Segmenter
  const segmentHair = useCallback((video, startTimeMs) => {
    if (!hairSegmenterRef.current || !video) return null;

    try {
      const result = hairSegmenterRef.current.segmentForVideo(video, startTimeMs);
      return result;
    } catch (error) {
      console.error('Hair segmentation error:', error);
      return null;
    }
  }, []);

  // Draw Hair Mask with Beard Eraser Logic
  const drawHairMask = useCallback((ctx, hairResult, landmarks) => {
    if (!hairResult || !hairResult.categoryMask) return;

    const mask = hairResult.categoryMask;
    const width = mask.width;
    const height = mask.height;

    const maskData = mask.getAsUint8Array();

    const imageData = ctx.createImageData(ctx.canvas.width, ctx.canvas.height);
    const data = imageData.data;

    for (let i = 0; i < maskData.length; i++) {
      const isHair = maskData[i] === 1;

      if (isHair) {
        const y = Math.floor(i / width);
        const x = i % width;

        const canvasX = Math.floor((x / width) * ctx.canvas.width);
        const canvasY = Math.floor((y / height) * ctx.canvas.height);

        let shouldDraw = true;

        // BEARD ERASER: Remove beard/lower face hair using landmarks
        if (landmarks) {
          const chinY = landmarks[152].y * ctx.canvas.height;
          const mouthBottomY = landmarks[14].y * ctx.canvas.height;

          if (canvasY > chinY - 20) {
            shouldDraw = false;
          } else if (canvasY > mouthBottomY - 10) {
            const leftCheek = landmarks[234].x * ctx.canvas.width;
            const rightCheek = landmarks[454].x * ctx.canvas.width;
            if (canvasX > leftCheek && canvasX < rightCheek) {
              shouldDraw = false;
            }
          }
        }

        if (shouldDraw) {
          const idx = (canvasY * ctx.canvas.width + canvasX) * 4;
          if (idx >= 0 && idx < data.length - 3) {
            data[idx] = 34;
            data[idx + 1] = 197;
            data[idx + 2] = 94;
            data[idx + 3] = 180;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }, []);

  // Draw hair regions with landmarks overlay
  const drawHairRegions = useCallback((landmarks, canvasElement) => {
    if (!canvasElement || !landmarks) return;

    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    const width = canvasElement.width;
    const height = canvasElement.height;

    // Hairline landmark indices (forehead area)
    const hairlineIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

    // Draw hairline
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.8)';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(34, 197, 94, 0.5)';
    ctx.shadowBlur = 10;

    hairlineIndices.forEach((index, i) => {
      const point = landmarks[index];
      const x = point.x * width;
      const y = point.y * height;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw key hairline points
    ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
    hairlineIndices.forEach(index => {
      const point = landmarks[index];
      const x = point.x * width;
      const y = point.y * height;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, 2 * Math.PI);
      ctx.fill();
    });

    // Draw temporal regions (sides)
    const leftTempleIndices = [234, 93, 132, 58, 172, 136, 150, 149];
    const rightTempleIndices = [454, 323, 361, 288, 397, 365, 379, 378];

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)';
    ctx.lineWidth = 2;

    [leftTempleIndices, rightTempleIndices].forEach(templeIndices => {
      ctx.beginPath();
      templeIndices.forEach((index, i) => {
        const point = landmarks[index];
        const x = point.x * width;
        const y = point.y * height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    });

  }, []);

  // Process Frames
  const onResults = useCallback((results) => {
    if (!isMountedRef.current || status === 'capturing') return;
    if (!currentStep) return;

    const hasFace = results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0;
    const currentLandmarks = hasFace ? results.multiFaceLandmarks[0] : null;

    if (currentLandmarks) {
      lastLandmarksRef.current = currentLandmarks;
    }

    // Segment hair and draw
    let hairResult = null;
    if (videoRef.current && isSegmenterLoaded && activeOverlay === 'hairline') {
      const startTimeMs = performance.now();
      hairResult = segmentHair(videoRef.current, startTimeMs);
    }

    try {
      const canvas = overlayCanvasRef.current;
      if (canvas && videoRef.current) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // LAYER 1: Hair Segmentation Mask (Bottom)
          if (hairResult && activeOverlay === 'hairline') {
            drawHairMask(ctx, hairResult, currentLandmarks || undefined);
          }

          // LAYER 2: Face Mesh Overlay (Top) - Landmarks
          if (currentLandmarks && activeOverlay === 'hairline') {
            drawHairRegions(currentLandmarks, canvas);
          }
        }
      }
    } finally {
      // CRITICAL: Close MediaPipe masks to prevent memory leaks
      if (hairResult) {
        if (hairResult.categoryMask) {
          hairResult.categoryMask.close();
        }
        if (hairResult.confidenceMasks) {
          hairResult.confidenceMasks.forEach(mask => mask.close());
        }
      }
    }

    // 1. Manual Handling (Back & Top Views)
    // "Top" view also triggers this logic now, skipping face detection requirement
    if (currentStep.guideType === 'manual') {
      setIsModelLoaded(true);
      // For Top/Back view, we don't strictly require face detection to lock
      // But we still track if a face is present just for info
      setQuality(prev => ({ ...prev, faceDetected: hasFace, stability: 'stable' }));
      
      const canvas = canvasRef.current;
      if (canvas) {
         const ctx = canvas.getContext('2d');
         // Use smaller dimensions for performance during analysis
         canvas.width = 100; canvas.height = 100;
         ctx.drawImage(results.image, 0, 0, 100, 100);
         const imageData = ctx.getImageData(0, 0, 100, 100);
         let totalBrightness = 0;
         for(let i=0; i<imageData.data.length; i+=4) totalBrightness += imageData.data[i];
         totalBrightness /= (imageData.data.length/4);
         
         const lighting = totalBrightness < 40 ? 'dark' : totalBrightness > 230 ? 'bright' : 'good';
         setQuality(q => ({ ...q, lighting }));
         
         // For BACK view: we prefer NO face.
         // For TOP view: we might see a face looking down, or no face. Both are fine.
         // Simplified logic: If lighting is good, we lock.
         
         if (currentStep.id === 'back' && hasFace) {
             // If capturing back and face is detected -> warning
             setStatus('aligning');
             setScanProgress(prev => Math.max(0, prev - 10));
         } else {
             // For TOP view or BACK view (without face), proceed
             if (lighting === 'good') {
                 setStatus('locked');
                 setScanProgress(prev => Math.min(prev + 5, 100));
             } else {
                 setScanProgress(prev => Math.max(0, prev - 5));
             }
         }
      }
      return;
    }

    // 2. FaceMesh Handling (Front, Left, Right)
    if (!hasFace) {
      setQuality(prev => ({ ...prev, faceDetected: false }));
      setStatus('searching');
      setScanProgress(0);
      return;
    }

    setIsModelLoaded(true);
    setQuality(prev => ({ ...prev, faceDetected: true }));

    const landmarks = results.multiFaceLandmarks[0];
    const headPose = calculatePose(landmarks);
    setPose(headPose);

    const { target } = currentStep;
    const yawTolerance = target.yawTolerance || target.tolerance || 15;
    const pitchTolerance = target.pitchTolerance || target.tolerance || 15;

    const isYawGood = Math.abs(headPose.yaw - target.yaw) < yawTolerance;
    const isPitchGood = Math.abs(headPose.pitch - target.pitch) < pitchTolerance;
    const isRollGood = Math.abs(headPose.roll - target.roll) < 15; 

    if (isYawGood && isPitchGood && isRollGood) {
      setStatus('locked');
      if (scanProgress < 100) setScanProgress(prev => prev + 8);
    } else {
      setStatus('aligning');
      setScanProgress(prev => Math.max(0, prev - 10));
    }

  }, [currentStep, scanProgress, status, activeOverlay, drawHairRegions, segmentHair, drawHairMask, isSegmenterLoaded]);

  // Update ref for callback
  useEffect(() => {
    onResultsRef.current = onResults;
  }, [onResults]);

  // Resize overlay canvas to match video
  useEffect(() => {
    const resizeCanvas = () => {
      if (videoRef.current && overlayCanvasRef.current) {
        const video = videoRef.current;
        if (video.videoWidth > 0) {
          overlayCanvasRef.current.width = video.videoWidth;
          overlayCanvasRef.current.height = video.videoHeight;
        }
      }
    };

    const video = videoRef.current;
    if (video) {
      video.addEventListener('loadedmetadata', resizeCanvas);
      return () => video.removeEventListener('loadedmetadata', resizeCanvas);
    }
  }, []);

  // Initialize MediaPipe Image Segmenter for Hair
  useEffect(() => {
    const initHairSegmenter = async () => {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.js');

        if (!window.ImageSegmenter || !window.FilesetResolver) {
          console.error('ImageSegmenter not loaded from CDN');
          return;
        }

        const vision = await window.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );

        const imageSegmenter = await window.ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float16/latest/hair_segmenter.tflite',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          outputCategoryMask: true,
          outputConfidenceMasks: false
        });

        hairSegmenterRef.current = imageSegmenter;
        setIsSegmenterLoaded(true);
        console.log('Hair Segmenter loaded successfully');

      } catch (error) {
        console.error('Error loading Hair Segmenter:', error);
        setIsSegmenterLoaded(false);
      }
    };

    initHairSegmenter();

    return () => {
      if (hairSegmenterRef.current) {
        try {
          hairSegmenterRef.current.close();
        } catch(e) {}
      }
    };
  }, []);

  // Initialize MediaPipe FaceMesh and Camera via CDN scripts
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        // Load scripts dynamically to avoid build errors
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1675466862/camera_utils.js');
        await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3.1675466124/drawing_utils.js');

        if (!window.FaceMesh || !window.Camera) {
          throw new Error('MediaPipe failed to load');
        }

        console.log('MediaPipe FaceMesh loaded successfully');

        const faceMesh = new window.FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${file}`;
          }
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        faceMesh.onResults((results) => {
          if (onResultsRef.current) {
            onResultsRef.current(results);
          }
        });

        faceMeshRef.current = faceMesh;
        console.log('FaceMesh initialized');

        if (videoRef.current) {
          const camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (faceMeshRef.current) {
                await faceMeshRef.current.send({image: videoRef.current});
              }
            },
            width: 1280,
            height: 720
          });

          await camera.start();
          cameraRef.current = camera;
          console.log('Camera started');
        }

      } catch (error) {
        console.error("Error initializing MediaPipe:", error);
        toast({
          title: "Kamera Hatası",
          description: "AI kamera başlatılamadı. Lütfen izinleri kontrol edin.",
          variant: "destructive"
        });
      }
    };

    initMediaPipe();

  }, [toast]);

  // Capture logic
  useEffect(() => {
    if (scanProgress >= 100 && status !== 'capturing') {
      handleCapture();
    }
  }, [scanProgress, status]);

  const validateCapture = (currentPose, step, currentQuality) => {
    // Manual steps (Back & Top) don't strictly require face detection logic for validation
    if (step.guideType === 'manual') {
        if (step.id === 'back' && currentQuality.faceDetected) {
            return { valid: false, message: "Yüz algılandı! Lütfen arkanızı dönün." };
        }
        // Top view is lenient
        return { valid: true };
    }

    if (!currentQuality.faceDetected) return { valid: false, message: "Yüz algılanamadı." };

    const { target } = step;
    const yawTolerance = target.yawTolerance || target.tolerance || 15;
    const pitchTolerance = target.pitchTolerance || target.tolerance || 15;

    const yawDiff = currentPose.yaw - target.yaw;
    const pitchDiff = currentPose.pitch - target.pitch;

    if (Math.abs(yawDiff) > yawTolerance) {
      const correction = yawDiff > 0 ? "Başınızı SOLA çevirin" : "Başınızı SAĞA çevirin";
      return { valid: false, message: `Açı Hatalı: ${correction}` };
    }

    if (Math.abs(pitchDiff) > pitchTolerance) {
       const correction = pitchDiff > 0 ? "Yukarı Bakın" : "Aşağı Bakın"; 
       return { valid: false, message: `Eğim Hatalı: ${correction}` };
    }

    return { valid: true };
  };

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !isMountedRef.current) return;

    const validation = validateCapture(pose, currentStep, quality);
    if (!validation.valid) {
      toast({
        title: "Çekim Reddedildi",
        description: validation.message,
        variant: "destructive",
        duration: 3000,
      });
      setScanProgress(0);
      setStatus('searching');
      return;
    }

    setStatus('capturing');
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1024 / video.videoWidth);
    canvas.width = video.videoWidth * scale;
    canvas.height = video.videoHeight * scale;
    const ctx = canvas.getContext('2d');

    // Apply filters visually
    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

    toast({
      title: "Fotoğraf Çekildi",
      description: `${currentStep.label} başarıyla alındı`,
      duration: 1500,
    });

    const newPhoto = {
      id: Date.now(),
      file: null,
      preview: dataUrl,
      type: currentStep.id
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
      } else {
        setCapturedImages(finalImages => {
          onComplete(finalImages);
          return finalImages;
        });
      }
    }, 1000);

  }, [currentStep, currentStepIndex, onComplete, pose, quality, toast, brightness, contrast]);

  // --- Overlays Render ---
  const renderOverlay = () => {
    switch (activeOverlay) {
      case 'density':
        return (
          <div className="absolute inset-0 opacity-40">
            <div className="absolute inset-0 bg-gradient-to-b from-red-500 via-yellow-400 to-green-500 mix-blend-overlay" />
          </div>
        );
      case 'hairline':
        return (
          <div className="absolute inset-0 flex items-center justify-center opacity-60 pointer-events-none">
          </div>
        );
      case 'roots':
        return (
          <div className="absolute inset-0 opacity-30 pointer-events-none">
             <div className="absolute inset-0" 
                  style={{ 
                    backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', 
                    backgroundSize: '12px 12px' 
                  }} 
             />
          </div>
        );
      default:
        return null;
    }
  };

  const AngleIndicator = ({ label, current, target, tolerance }) => {
    const diff = current - target;
    const isGood = Math.abs(diff) < tolerance;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="h-1.5 w-24 bg-gray-700 rounded-full overflow-hidden relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/30 -ml-px" />
          <div 
             className="absolute top-0 bottom-0 bg-green-400/20"
             style={{ left: '50%', width: '100%', transform: `translateX(-50%) scaleX(${(tolerance / 90)})` }}
          />
          <motion.div 
            className={`absolute top-0 bottom-0 w-2 rounded-full transition-colors duration-200 ${isGood ? 'bg-green-400' : 'bg-red-400'}`}
            style={{ 
              left: `${Math.max(0, Math.min(100, 50 + (diff / 90) * 50))}%`,
              transform: 'translateX(-50%)'
            }}
          />
        </div>
        <div className="flex flex-col items-center">
          <span className={`text-[10px] font-bold uppercase ${isGood ? 'text-green-400' : 'text-gray-400'}`}>{label}</span>
          <span className="text-[9px] text-gray-500 font-mono">{Math.round(current)}° / {target}°</span>
        </div>
      </div>
    );
  };

  if (!currentStep) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 p-6 bg-gradient-to-b from-black/90 to-transparent text-white flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2 mb-1">
             <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-medium tracking-wider uppercase">
               Adım {currentStepIndex + 1}/{SCAN_STEPS.length}
             </span>
             {/* Only show angle indicators for face-guided steps */}
             {quality.faceDetected && status !== 'searching' && currentStep.guideType === 'face' && (
               <div className="flex gap-4 ml-4 bg-black/50 backdrop-blur-sm p-2 rounded-lg border border-white/10">
                 <AngleIndicator 
                    label="Yaw" 
                    current={pose.yaw} 
                    target={currentStep.target.yaw} 
                    tolerance={currentStep.target.yawTolerance || currentStep.target.tolerance || 15} 
                 />
                 <AngleIndicator 
                    label="Pitch" 
                    current={pose.pitch} 
                    target={currentStep.target.pitch} 
                    tolerance={currentStep.target.pitchTolerance || currentStep.target.tolerance || 15} 
                 />
               </div>
             )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{currentStep.label}</h2>
        </div>
        <button 
          onClick={onCancel}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm pointer-events-auto"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Settings Toggle */}
      <div className="absolute top-20 right-6 z-30 flex flex-col gap-2">
        <button 
           onClick={() => setShowSettings(!showSettings)}
           className={`p-3 rounded-full backdrop-blur-md transition-all border ${showSettings ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/40 border-white/10 text-gray-300 hover:bg-black/60'}`}
        >
           <SlidersHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-36 right-6 z-30 w-64 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-4"
          >
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-3 h-3" /> Kamera Ayarları
              </h4>
              <RangeControl 
                icon={Sun} 
                label="Parlaklık" 
                value={brightness} 
                onChange={setBrightness} 
              />
              <RangeControl 
                icon={Sparkles} 
                label="Netlik" 
                value={contrast} 
                onChange={setContrast} 
              />
            </div>
            
            <div className="h-px bg-white/10 my-1" />

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-3 h-3" /> Analiz Katmanı
              </h4>
              <div className="grid grid-cols-3 gap-2">
                 {[
                   { id: 'hairline', icon: User, label: 'Saç Çizgisi' },
                   { id: 'density', icon: Activity, label: 'Yoğunluk' },
                   { id: 'roots', icon: Droplets, label: 'Kökler' }
                 ].map((mode) => (
                   <button
                     key={mode.id}
                     onClick={() => setActiveOverlay(activeOverlay === mode.id ? 'none' : mode.id)}
                     className={`flex flex-col items-center justify-center gap-1 p-2 rounded-lg border transition-all ${
                       activeOverlay === mode.id 
                         ? 'bg-indigo-600/50 border-indigo-400 text-white' 
                         : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'
                     }`}
                   >
                     <mode.icon className="w-4 h-4" />
                     <span className="text-[9px] font-medium">{mode.label}</span>
                   </button>
                 ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera View */}
      <div className="relative flex-1 bg-gray-900 overflow-hidden flex items-center justify-center">
        {!isModelLoaded && currentStep.guideType !== 'manual' && (
          <div className="absolute z-30 flex flex-col items-center text-white/70 bg-black/60 backdrop-blur-sm p-4 rounded-lg">
            <RefreshCw className="w-10 h-10 animate-spin mb-2" />
            <p className="font-medium">FaceMesh Başlatılıyor...</p>
            {isSegmenterLoaded && (
              <p className="text-xs text-green-400 mt-1">✓ Saç Segmentasyon Hazır</p>
            )}
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ filter: `brightness(${brightness}%) contrast(${contrast}%)` }}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-[filter] duration-200"
        />

        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] pointer-events-none"
          style={{ zIndex: 10 }}
        />
        
        {/* HUD Overlays */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Central Guide Frame with Dynamic Content */}
          <div className="absolute inset-0 flex items-center justify-center">
             <motion.div
                animate={{
                  borderColor: status === 'locked' ? '#4ade80' : status === 'aligning' ? '#fbbf24' : 'rgba(255,255,255,0.3)',
                  borderWidth: status === 'locked' ? 4 : 2,
                  scale: status === 'locked' ? 1.05 : 1
                }}
                className="w-[400px] h-[520px] rounded-[4rem] border-2 relative overflow-hidden shadow-2xl transition-colors duration-300 bg-black/5 backdrop-blur-[1px]"
             >
                {/* Active Overlay Layer */}
                {renderOverlay()}

                {/* Scanning Line Animation */}
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

                {/* Alerts */}
                {!quality.faceDetected && currentStep.guideType === 'face' && isModelLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
                    <User className="w-16 h-16 text-white/50 mb-2" />
                    <span className="bg-red-500/80 text-white px-3 py-1 rounded-full text-sm font-bold">
                      Yüz Algılanamadı
                    </span>
                  </div>
                )}
                
                {/* Alert for Back view if face is detected (only for back view) */}
                {quality.faceDetected && currentStep.id === 'back' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] z-20">
                    <AlertCircle className="w-16 h-16 text-red-500 mb-2" />
                    <span className="bg-red-500/90 text-white px-3 py-1 rounded-full text-sm font-bold text-center">
                      Yüz Algılandı!<br/>Arkanızı Dönün
                    </span>
                  </div>
                )}
             </motion.div>
          </div>

          {/* Feedback Text */}
          <div className="absolute bottom-8 left-0 right-0 text-center space-y-4 pointer-events-auto"> 
             <motion.div
               key={currentStep.id}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="inline-block bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10"
             >
               <h3 className="text-xl font-bold text-white">{currentStep.instruction}</h3>
               {status === 'aligning' && currentStep.guideType === 'face' && (
                 <p className="text-amber-300 text-sm mt-1 font-medium">
                    Açıyı kılavuzlara göre ayarlayın
                 </p>
               )}
               {status === 'locked' && (
                 <p className="text-green-400 text-sm mt-1 font-bold tracking-wider animate-pulse">
                    MÜKEMMEL - SABİT DURUN
                 </p>
               )}
             </motion.div>

             {/* Quality Alerts */}
             <div className="flex justify-center gap-2 mt-2">
               {quality.lighting === 'dark' && (
                 <div className="bg-red-500/90 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                   <Sun className="w-3 h-3" /> Düşük Işık
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-black/80 backdrop-blur-xl p-8 pb-12 flex items-center justify-center border-t border-white/10 relative z-20">
        {/* Progress Ring */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full rotate-[-90deg]">
            <circle cx="48" cy="48" r="44" fill="none" stroke="#374151" strokeWidth="6" />
            <circle 
              cx="48" cy="48" r="44" 
              fill="none" 
              stroke={status === 'locked' || status === 'capturing' ? '#4ade80' : '#6366f1'} 
              strokeWidth="6"
              strokeDasharray={276}
              strokeDashoffset={276 - (276 * scanProgress) / 100}
              strokeLinecap="round"
              className="transition-all duration-100 ease-linear"
            />
          </svg>
          
          <button
            disabled={status === 'capturing'}
            className="relative w-16 h-16 rounded-full bg-white transition-transform flex items-center justify-center group pointer-events-none"
          >
            {status === 'capturing' ? (
              <Check className="w-8 h-8 text-green-600" />
            ) : (
              <CameraIcon className="w-8 h-8 text-gray-900" />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveScanner;