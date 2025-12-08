import React, { useRef, useEffect, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FaceMesh } from '@mediapipe/face_mesh';
import * as Cam from '@mediapipe/camera_utils';

interface LiveScannerProps {
  onComplete: (photos: any[]) => void;
  onCancel: () => void;
}

const LiveScanner: React.FC<LiveScannerProps> = ({ onComplete, onCancel }) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraInstanceRef = useRef<Cam.Camera | null>(null);

  // MediaPipe FaceMesh Kurulumu
  useEffect(() => {
    const faceMesh = new FaceMesh({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
      },
    });

    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    faceMesh.onResults(onResults);

    if (webcamRef.current && webcamRef.current.video) {
      const camera = new Cam.Camera(webcamRef.current.video, {
        onFrame: async () => {
          if (webcamRef.current?.video) {
            await faceMesh.send({ image: webcamRef.current.video });
          }
        },
        width: 1280,
        height: 720,
      });
      cameraInstanceRef.current = camera;
      camera.start();
    }

    return () => {
      if (cameraInstanceRef.current) {
        // Stop method might not exist on type definition but cleans up processes
        try { (cameraInstanceRef.current as any).stop(); } catch(e) {}
      }
    };
  }, []);

  // MediaPipe Sonuçlarını Çizme (O Yeşil Çizgiler)
  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    
    if (!canvas || !video || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      setIsFaceDetected(false);
      if(canvas) {
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    setIsFaceDetected(true);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Çizim Ayarları (Tekno-Medikal Görünüm)
    ctx.lineWidth = 1;
    
    for (const landmarks of results.multiFaceLandmarks) {
      // 1. Yüz Ağı (Mesh) Çizimi
      drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_TESSELATION, { color: '#C0C0C070', lineWidth: 0.5 });
      
      // 2. Önemli Hatlar (Gözler, Kaşlar, Yüz Çerçevesi)
      const mainColor = '#00FF94'; // Canlı Yeşil
      
      // Face Oval
      drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_FACE_OVAL, { color: mainColor, lineWidth: 2 });
      // Eyebrows (Saç çizgisi için referans)
      drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_RIGHT_EYEBROW, { color: mainColor, lineWidth: 2 });
      drawConnectors(ctx, landmarks, FaceMesh.FACEMESH_LEFT_EYEBROW, { color: mainColor, lineWidth: 2 });
      
      // 3. Alın Bölgesi (Saç Çizgisi Analizi İçin Vurgu)
      // Basitçe alındaki bazı noktaları vurgulayalım
      const foreheadPoints = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
      
      ctx.fillStyle = '#00C2FF'; // Mavi noktalar
      foreheadPoints.forEach(index => {
        const point = landmarks[index];
        if(point) {
            ctx.beginPath();
            ctx.arc(point.x * canvas.width, point.y * canvas.height, 2, 0, 2 * Math.PI);
            ctx.fill();
        }
      });
    }
    ctx.restore();
  }, []);

  // Helper function to draw connectors manually to avoid importing drawing_utils which adds huge bundle size
  const drawConnectors = (ctx: CanvasRenderingContext2D, landmarks: any[], connections: any[], style: { color: string, lineWidth: number }) => {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.lineWidth;
    
    // FACEMESH_TESSELATION gibi sabitler bazen array of arrays döner
    // Mediapipe versiyonuna göre bu data yapısı değişebilir, basit bir loop:
    for (const connection of connections) {
      const start = landmarks[connection[0]];
      const end = landmarks[connection[1]];
      
      if (start && end) {
        ctx.beginPath();
        ctx.moveTo(start.x * ctx.canvas.width, start.y * ctx.canvas.height);
        ctx.lineTo(end.x * ctx.canvas.width, end.y * ctx.canvas.height);
        ctx.stroke();
      }
    }
  };

  const capture = useCallback(() => {
    setCapturing(true);
    const imageSrc = webcamRef.current?.getScreenshot();
    
    if (imageSrc) {
      // Fotoğrafı işlemesi için parent'a gönder
      // Not: Burada simüle ediyoruz, gerçek uygulamada tek tek çekim mantığına bağlanmalı
      onComplete([{
        id: Date.now(),
        preview: imageSrc,
        type: 'front', // Varsayılan olarak front atıyoruz, sonra değiştirilebilir
        file: null
      }]);
    }
    setCapturing(false);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Üst Bilgi Barı */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex justify-between items-center max-w-4xl mx-auto text-white">
          <button onClick={onCancel} className="text-white/80 hover:text-white">
            İptal
          </button>
          <div className="text-center">
            <h3 className="font-semibold text-lg">AI Tarama Aktif</h3>
            <p className="text-xs text-green-400 font-mono tracking-wider">
              {isFaceDetected ? 'YÜZ ALGILANDI - ANALİZ HAZIR' : 'YÜZ ARANIYOR...'}
            </p>
          </div>
          <div className="w-10"></div> {/* Spacer */}
        </div>
      </div>

      {/* Kamera Alanı */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          className="absolute inset-0 w-full h-full object-cover"
          mirrored={true}
          videoConstraints={{
            width: 1280,
            height: 720,
            facingMode: "user"
          }}
        />
        
        {/* Face Mesh Canvas Katmanı */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />

        {/* Statik Rehber (SVG Overlay) */}
        {!isFaceDetected && (
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-50">
             <div className="w-64 h-80 border-2 border-white/30 rounded-[50%] border-dashed animate-pulse"></div>
           </div>
        )}
      </div>

      {/* Alt Kontrol Barı */}
      <div className="bg-black p-8">
        <div className="max-w-md mx-auto flex justify-center items-center">
          <Button
            onClick={capture}
            disabled={!isFaceDetected || capturing}
            className={`
              w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300
              ${isFaceDetected 
                ? 'bg-white border-green-500 hover:scale-105 cursor-pointer shadow-[0_0_20px_rgba(0,255,148,0.5)]' 
                : 'bg-gray-800 border-gray-600 cursor-not-allowed opacity-50'}
            `}
          >
            <div className={`w-16 h-16 rounded-full transition-all ${capturing ? 'bg-green-500 scale-90' : 'bg-transparent border-2 border-black/10'}`}>
              <Camera className={`w-8 h-8 mx-auto mt-3 ${isFaceDetected ? 'text-black' : 'text-gray-400'}`} />
            </div>
          </Button>
        </div>
        <p className="text-center text-gray-400 mt-4 text-sm">
          {isFaceDetected ? 'Fotoğraf çekmek için butona basın' : 'Yüzünüzü çerçeveye yerleştirin'}
        </p>
      </div>
    </div>
  );
};

export default LiveScanner;