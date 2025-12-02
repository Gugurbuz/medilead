
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layers, Eye, Activity, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const VisualAnalysis = ({ analyzedPhotos }) => {
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  
  // Set default photo once available
  useEffect(() => {
    if (analyzedPhotos && analyzedPhotos.length > 0 && !selectedPhotoId) {
      setSelectedPhotoId(analyzedPhotos[0].id);
    }
  }, [analyzedPhotos, selectedPhotoId]);

  const selectedPhoto = analyzedPhotos?.find(p => p.id === selectedPhotoId) || analyzedPhotos?.[0];

  if (!analyzedPhotos || analyzedPhotos.length === 0) {
    return (
      <div className="p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
        <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No analysis data available. Please upload photos to generate a report.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden"
    >
      <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Eye className="w-5 h-5 text-indigo-600" />
            ViT Segmentation Analysis
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            AI-powered vision transformer results showing hair boundaries and density zones.
          </p>
        </div>
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 self-start sm:self-center whitespace-nowrap">
          Model: ViT-B/16-Hair
        </Badge>
      </div>

      <div className="flex flex-col md:flex-row min-h-[500px]">
        {/* Thumbnails Sidebar */}
        <div className="w-full md:w-48 bg-gray-50 p-4 flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto border-b md:border-b-0 md:border-r border-gray-200">
          {analyzedPhotos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setSelectedPhotoId(photo.id)}
              className={`relative flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all w-20 h-20 md:w-full md:h-32 bg-white ${
                selectedPhoto?.id === photo.id ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-transparent hover:border-gray-300'
              }`}
            >
              {photo.preview ? (
                <img src={photo.preview} alt={photo.type} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-xs text-gray-400">No Img</div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] py-1 text-center truncate px-1 uppercase font-medium">
                {photo.type || 'Scan'}
              </div>
            </button>
          ))}
        </div>

        {/* Main Viewer */}
        <div className="flex-1 p-6">
          {selectedPhoto && (
            <Tabs defaultValue="segmentation" className="w-full h-full flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <TabsList className="grid w-full max-w-md grid-cols-3 bg-gray-100/80">
                  <TabsTrigger value="original" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
                    <Eye className="w-4 h-4 mr-2" /> Original
                  </TabsTrigger>
                  <TabsTrigger value="segmentation" className="data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">
                    <Layers className="w-4 h-4 mr-2" /> Segmentation
                  </TabsTrigger>
                  <TabsTrigger value="heatmap" className="data-[state=active]:bg-white data-[state=active]:text-green-600 data-[state=active]:shadow-sm">
                    <Activity className="w-4 h-4 mr-2" /> Heatmap
                  </TabsTrigger>
                </TabsList>

                {selectedPhoto.processed && (
                   <div className="flex gap-4 text-sm">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                         <span className="text-gray-600">Coverage: <span className="font-semibold text-gray-900">{selectedPhoto.processed.densityScore}%</span></span>
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-green-500"></div>
                         <span className="text-gray-600">Quality: <span className="font-semibold text-gray-900">{selectedPhoto.processed.coverageLabel}</span></span>
                      </div>
                   </div>
                )}
              </div>

              <div className="flex-1 relative bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[400px] shadow-inner border border-gray-800">
                
                <TabsContent value="original" className="w-full h-full absolute inset-0 mt-0 data-[state=inactive]:hidden">
                   {selectedPhoto.preview ? (
                     <img src={selectedPhoto.preview} alt="Original" className="w-full h-full object-contain" />
                   ) : (
                     <div className="text-white flex flex-col items-center"><AlertCircle className="mb-2"/> Image failed to load</div>
                   )}
                </TabsContent>

                <TabsContent value="segmentation" className="w-full h-full absolute inset-0 mt-0 data-[state=inactive]:hidden relative group">
                   <img src={selectedPhoto.preview} alt="Base" className="absolute inset-0 w-full h-full object-contain z-0 opacity-50" />
                   {selectedPhoto.processed?.segmentationMask && (
                     <img 
                        src={selectedPhoto.processed.segmentationMask} 
                        alt="Mask" 
                        className="absolute inset-0 w-full h-full object-contain z-10 mix-blend-screen" 
                     />
                   )}
                   <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur text-white text-xs p-2 rounded max-w-[200px] border border-white/10">
                      <p className="font-semibold mb-1 text-blue-300">Segmentation Layer</p>
                      Blue overlay indicates detected hair follicles identified by the ViT model.
                   </div>
                </TabsContent>

                <TabsContent value="heatmap" className="w-full h-full absolute inset-0 mt-0 data-[state=inactive]:hidden relative">
                   <img src={selectedPhoto.preview} alt="Base" className="absolute inset-0 w-full h-full object-contain z-0 opacity-30 grayscale" />
                   {selectedPhoto.processed?.densityHeatmap && (
                     <img 
                        src={selectedPhoto.processed.densityHeatmap} 
                        alt="Heatmap" 
                        className="absolute inset-0 w-full h-full object-contain z-10 mix-blend-overlay opacity-90" 
                     />
                   )}
                   <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur text-gray-900 text-xs p-3 rounded-lg shadow-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                         <div className="w-3 h-3 bg-green-500 rounded-sm"></div> High Density
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                         <div className="w-3 h-3 bg-yellow-500 rounded-sm"></div> Moderate
                      </div>
                      <div className="flex items-center gap-2">
                         <div className="w-3 h-3 bg-red-500 rounded-sm"></div> Low Density
                      </div>
                   </div>
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default VisualAnalysis;
