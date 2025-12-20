
import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Camera, X, CheckCircle2, ScanLine, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import LiveScanner from './LiveScanner';

const PhotoUpload = ({ onPhotosUploaded, existingPhotos = [] }) => {
  const [photos, setPhotos] = useState(existingPhotos);
  const [dragActive, setDragActive] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const fileInputRef = useRef(null);
  const { toast } = useToast();

  const photoTypes = [
    { id: 'front', label: 'Front View', required: true },
    { id: 'top', label: 'Top View', required: true },
    { id: 'sides', label: 'Side Views', required: false },
    { id: 'back', label: 'Back View (Donor Area)', required: true }
  ];

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    handleFiles(files);
  };

  const handleFiles = async (files) => {
    const validFiles = Array.from(files).filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please upload only image files",
          variant: "destructive"
        });
        return false;
      }
      if (file.size > 15 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please upload images smaller than 15MB",
          variant: "destructive"
        });
        return false;
      }
      return true;
    });

    // Convert files to Data URLs with resizing to prevent localStorage quota issues
    const newPhotos = await Promise.all(validFiles.map(async file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            // Resize to max 1024px
            const scale = Math.min(1, 1024 / img.width);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            resolve({
              id: Date.now() + Math.random(),
              file: null, // Don't store raw File object in state meant for localStorage
              preview: canvas.toDataURL('image/jpeg', 0.8),
              type: null
            });
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }));

    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (id) => {
    setPhotos(photos.filter(photo => photo.id !== id));
  };

  const assignPhotoType = (photoId, type) => {
    setPhotos(photos.map(photo => 
      photo.id === photoId ? { ...photo, type } : photo
    ));
  };

  const handleLiveScanComplete = (capturedPhotos) => {
    setShowLiveScanner(false);
    setPhotos([...photos, ...capturedPhotos]);
    toast({
      title: "Live Scan Complete",
      description: `${capturedPhotos.length} high-quality images captured successfully.`
    });
  };

  const handleContinue = () => {
    const requiredTypes = photoTypes.filter(t => t.required).map(t => t.id);
    const uploadedTypes = photos.map(p => p.type).filter(Boolean);
    const missingTypes = requiredTypes.filter(t => !uploadedTypes.includes(t));

    if (missingTypes.length > 0) {
      toast({
        title: "Missing required photos",
        description: `Please upload and label: ${missingTypes.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    if (photos.length === 0) {
      toast({
        title: "No photos uploaded",
        description: "Please upload at least one photo",
        variant: "destructive"
      });
      return;
    }

    onPhotosUploaded(photos);
    toast({
      title: "Photos uploaded successfully",
      description: `${photos.length} photo(s) ready for analysis`
    });
  };

  if (showLiveScanner) {
    return <LiveScanner onComplete={handleLiveScanComplete} onCancel={() => setShowLiveScanner(false)} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="max-w-5xl mx-auto"
    >
      <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 md:p-12 border border-slate-200">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 border border-teal-200 rounded-full text-[11px] font-black uppercase tracking-widest text-teal-600 shadow-sm mb-6">
            <Camera className="w-3.5 h-3.5" />
            STEP 1 OF 3
          </div>
          <h2 className="text-4xl md:text-5xl font-light text-[#0E1A2B] mb-3 tracking-tight">
            Hair Analysis <span className="font-bold">Photos</span>
          </h2>
          <p className="text-slate-500 text-lg font-light">Choose how you'd like to provide photos for your analysis</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <button
            onClick={() => setShowLiveScanner(true)}
            className="group relative p-8 bg-gradient-to-br from-[#14B8A6] to-teal-600 rounded-[2rem] text-white text-left transition-all hover:shadow-2xl hover:-translate-y-1 active:scale-[0.98] overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <ScanLine className="w-32 h-32" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm border border-white/20">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3">Live Camera Analysis</h3>
              <p className="text-teal-50 text-sm mb-6 leading-relaxed font-light">
                Use our AI-guided camera to automatically capture the best angles with real-time feedback.
              </p>
              <div className="flex items-center text-sm font-bold uppercase tracking-wider">
                Start Live Scan <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          <div
            className={`border-2 border-dashed rounded-[2rem] p-8 flex flex-col justify-center text-center transition-all duration-300 ${
              dragActive
                ? 'border-teal-500 bg-teal-50/50'
                : 'border-slate-300 hover:border-teal-400 hover:bg-slate-50'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6">
              <Upload className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="font-bold text-[#0E1A2B] text-xl mb-2">Manual Upload</h3>
            <p className="text-sm text-slate-500 mb-6 font-light">
              Drag & drop or browse files
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mx-auto px-8 py-3 bg-white border-2 border-slate-300 text-[#0E1A2B] rounded-xl font-bold text-sm uppercase tracking-wider hover:bg-slate-50 hover:border-slate-400 transition-all"
            >
              Select Files
            </button>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="mt-10 border-t border-slate-200 pt-10">
            <h3 className="text-2xl font-bold text-[#0E1A2B] mb-6">
              Uploaded Photos <span className="text-teal-600">({photos.length})</span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border-2 border-slate-200 group-hover:border-teal-300 transition-all">
                    <img
                      src={photo.preview}
                      alt="Uploaded hair photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-3 right-3 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 shadow-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <select
                    value={photo.type || ''}
                    onChange={(e) => assignPhotoType(photo.id, e.target.value)}
                    className="mt-3 w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-medium text-[#0E1A2B]"
                  >
                    <option value="">Select Type...</option>
                    {photoTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {photo.type && (
                    <div className="absolute top-3 left-3 bg-teal-500 text-white px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-lg">
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                      Set
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <div className="mt-10 flex justify-center">
              <button
                onClick={handleContinue}
                className="px-12 py-5 bg-[#0E1A2B] text-white rounded-2xl font-bold text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
              >
                <span className="relative z-10">Continue to Profile</span>
                <ArrowRight className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />
                <div className="absolute inset-0 bg-teal-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PhotoUpload;
