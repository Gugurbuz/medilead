
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
      className="max-w-4xl mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Hair Analysis Photos</h2>
          <p className="text-gray-600">Choose how you'd like to provide photos for your analysis</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Live Scan Option */}
          <button
            onClick={() => setShowLiveScanner(true)}
            className="group relative p-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl text-white text-left transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <ScanLine className="w-24 h-24" />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center mb-4 backdrop-blur-sm">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2">Live Camera Analysis</h3>
              <p className="text-indigo-100 text-sm mb-4">
                Use our AI-guided camera to automatically capture the best angles with real-time feedback.
              </p>
              <div className="flex items-center text-sm font-semibold">
                Start Live Scan <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </button>

          {/* Manual Upload Option */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 flex flex-col justify-center text-center transition-all duration-300 ${
              dragActive 
                ? 'border-indigo-500 bg-indigo-50' 
                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
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
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Upload className="w-6 h-6 text-gray-500" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Manual Upload</h3>
            <p className="text-sm text-gray-500 mb-4">
              Drag & drop or browse files
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="mx-auto border-gray-300"
            >
              Select Files
            </Button>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="mt-8 border-t border-gray-100 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Uploaded Photos ({photos.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border-2 border-gray-200">
                    <img
                      src={photo.preview}
                      alt="Uploaded hair photo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  
                  <select
                    value={photo.type || ''}
                    onChange={(e) => assignPhotoType(photo.id, e.target.value)}
                    className="mt-2 w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">Type...</option>
                    {photoTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </motion.div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <Button
                onClick={handleContinue}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
                size="lg"
              >
                Continue to Profile
              </Button>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default PhotoUpload;
