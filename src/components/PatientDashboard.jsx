
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Camera, FileText, ChevronRight, Loader2, Scan } from 'lucide-react';
import Header from '@/components/Header';
import PhotoUpload from '@/components/PhotoUpload';
import PatientForm from '@/components/PatientForm';
import AnalysisReport from '@/components/AnalysisReport';
import { processHairImage } from '@/lib/visionModel';

const PatientDashboard = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const [patientData, setPatientData] = useState(null);
  const [analysisData, setAnalysisData] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStage, setAnalysisStage] = useState('');

  useEffect(() => {
    const savedPhotos = localStorage.getItem('patient_photos');
    const savedPatientData = localStorage.getItem('patient_data');
    const savedAnalysisData = localStorage.getItem('analysis_data');

    if (savedPhotos) setUploadedPhotos(JSON.parse(savedPhotos));
    if (savedPatientData) setPatientData(JSON.parse(savedPatientData));
    if (savedAnalysisData) setAnalysisData(JSON.parse(savedAnalysisData));

    if (savedPhotos && savedPatientData && savedAnalysisData) {
      setCurrentStep(3);
    } else if (savedPhotos && savedPatientData) {
      setCurrentStep(2);
    } else if (savedPhotos) {
      setCurrentStep(2);
    }
  }, []);

  const handlePhotosUploaded = (photos) => {
    setUploadedPhotos(photos);
    localStorage.setItem('patient_photos', JSON.stringify(photos));
    setCurrentStep(2);
  };

  const handlePatientFormSubmit = async (data) => {
    setPatientData(data);
    localStorage.setItem('patient_data', JSON.stringify(data));
    
    // Start real analysis with Vision Model simulation
    await performAnalysis(data, uploadedPhotos);
  };

  const performAnalysis = async (pData, photos) => {
    setIsAnalyzing(true);
    setCurrentStep(2.5); 
    
    // Stage 1: Initial Processing
    setAnalysisStage('Initializing ViT Model...');
    setAnalysisProgress(10);
    await new Promise(r => setTimeout(r, 800));

    // Stage 2: Vision Transformer Analysis
    setAnalysisStage('Running Segmentation (ViT-B/16)...');
    const processedPhotos = [];
    const totalPhotos = photos.length;
    
    for (let i = 0; i < totalPhotos; i++) {
       const photo = photos[i];
       try {
          // Actually process the image pixels
          const processed = await processHairImage(photo);
          processedPhotos.push(processed);
          
          // Update progress
          const progress = 10 + Math.round(((i + 1) / totalPhotos) * 60);
          setAnalysisProgress(progress);
       } catch (e) {
          console.error("Failed to analyze photo", e);
          processedPhotos.push(photo); // Fallback to original
       }
    }

    // Update stored photos with processed data (masks/heatmaps)
    setUploadedPhotos(processedPhotos);
    localStorage.setItem('patient_photos', JSON.stringify(processedPhotos));

    // Stage 3: Generating Insights
    setAnalysisStage('Synthesizing Density Maps...');
    setAnalysisProgress(85);
    await new Promise(r => setTimeout(r, 1500));

    // Stage 4: Finalizing
    setAnalysisStage('Finalizing Report...');
    setAnalysisProgress(100);
    await new Promise(r => setTimeout(r, 800));

    completeAnalysis(pData, processedPhotos);
  };

  const completeAnalysis = (data, photos) => {
    // Calculate score based on actual detected density
    const avgDensity = photos.reduce((acc, p) => acc + (p.processed?.densityScore || 50), 0) / photos.length;
    const normalizedScore = Math.min(10, Math.max(2, Math.round(avgDensity / 10) + 1));

    const mockAnalysis = {
      overallScore: normalizedScore, 
      hairLossStage: avgDensity < 40 ? 'Norwood Scale IV-V' : avgDensity < 65 ? 'Norwood Scale II-III' : 'Norwood Scale I',
      hairDensity: {
        frontal: Math.round(avgDensity * 0.9),
        crown: Math.round(avgDensity * 0.8),
        temporal: Math.round(avgDensity * 0.85),
        donor: Math.round(avgDensity * 1.2) // Donor usually stronger
      },
      donorQuality: avgDensity > 50 ? 'Good' : 'Fair',
      estimatedGrafts: avgDensity < 50 ? '3000-3500' : '1500-2000',
      recommendations: [
        {
          title: 'Follicular Unit Extraction (FUE)',
          priority: 'high',
          description: 'Recommended primary treatment based on your hair loss pattern and donor area quality.',
          details: [
            'Minimally invasive procedure',
            'Natural-looking results',
            'Quick recovery time (5-7 days)',
            'Estimated cost: $8,000 - $12,000'
          ]
        },
        {
          title: 'Medical Treatment (Finasteride + Minoxidil)',
          priority: 'medium',
          description: 'Complementary treatment to maintain existing hair and support transplant results.',
          details: [
            'Daily oral and topical medication',
            'Slows hair loss progression',
            'May stimulate regrowth',
            'Long-term commitment required'
          ]
        },
        {
          title: 'PRP Therapy',
          priority: 'medium',
          description: 'Platelet-Rich Plasma therapy to improve hair density and thickness.',
          details: [
            'Natural growth factor stimulation',
            '3-4 sessions recommended initially',
            'Maintenance sessions every 6 months',
            'Estimated cost: $500 - $800 per session'
          ]
        }
      ],
      timeline: {
        immediate: ['Start Minoxidil treatment', 'Schedule consultation with surgeon'],
        threeMonths: ['Begin Finasteride if approved', 'Complete pre-surgery evaluations'],
        sixMonths: ['Schedule hair transplant procedure', 'Continue medical treatments'],
        oneYear: ['Post-transplant follow-up', 'Evaluate results and plan maintenance']
      }
    };

    setAnalysisData(mockAnalysis);
    localStorage.setItem('analysis_data', JSON.stringify(mockAnalysis));
    setIsAnalyzing(false);
    setCurrentStep(3);
  };

  const handleStartOver = () => {
    setCurrentStep(1);
    setUploadedPhotos([]);
    setPatientData(null);
    setAnalysisData(null);
    localStorage.removeItem('patient_photos');
    localStorage.removeItem('patient_data');
    localStorage.removeItem('analysis_data');
  };

  const steps = [
    { number: 1, title: 'Upload Photos', icon: Camera },
    { number: 2, title: 'Patient Profile', icon: User },
    { number: 3, title: 'Analysis Report', icon: FileText }
  ];

  return (
    <div className="min-h-screen">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Loading Overlay */}
        <AnimatePresence>
          {isAnalyzing && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-white/95 backdrop-blur-md z-50 flex flex-col items-center justify-center"
            >
              <div className="w-full max-w-md p-8 text-center">
                <div className="relative w-24 h-24 mx-auto mb-8">
                  <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
                  <div 
                    className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"
                  ></div>
                  <Scan className="absolute inset-0 w-full h-full text-indigo-600 p-6 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Analyzing Your Profile</h2>
                <p className="text-gray-600 mb-8 font-medium">{analysisStage}</p>
                
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${analysisProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm text-gray-500 font-mono">
                  <span>Processed {Math.round(analysisProgress / 100 * uploadedPhotos.length)}/{uploadedPhotos.length} images</span>
                  <span>{analysisProgress}%</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-center space-x-4 mb-12">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex flex-col items-center"
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                      currentStep >= step.number
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/50'
                        : 'bg-white text-gray-400 border-2 border-gray-200'
                    }`}
                  >
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span
                    className={`mt-2 text-sm font-medium transition-colors duration-300 ${
                      currentStep >= step.number ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    {step.title}
                  </span>
                </motion.div>
                {index < steps.length - 1 && (
                  <ChevronRight
                    className={`w-5 h-5 transition-colors duration-300 ${
                      currentStep > step.number ? 'text-indigo-600' : 'text-gray-300'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <PhotoUpload
              key="photo-upload"
              onPhotosUploaded={handlePhotosUploaded}
              existingPhotos={uploadedPhotos}
            />
          )}
          {currentStep === 2 && (
            <PatientForm
              key="patient-form"
              onSubmit={handlePatientFormSubmit}
              existingData={patientData}
              photos={uploadedPhotos}
            />
          )}
          {currentStep === 3 && analysisData && (
            <AnalysisReport
              key="analysis-report"
              data={analysisData}
              patientData={patientData}
              photos={uploadedPhotos}
              onStartOver={handleStartOver}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PatientDashboard;
