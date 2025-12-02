
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Camera, FileText, ChevronRight, Loader2, Scan } from 'lucide-react';
import Header from '@/components/Header';
import PhotoUpload from '@/components/PhotoUpload';
import PatientForm from '@/components/PatientForm';
import AnalysisReport from '@/components/AnalysisReport';
import { processHairImage } from '@/lib/visionModel';
import { analyzeHairImages, analyzeHairlineCoordinates } from '@/lib/geminiService';

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

    try {
      setAnalysisStage('Initializing Vision Models...');
      setAnalysisProgress(5);
      await new Promise(r => setTimeout(r, 500));

      setAnalysisStage('Running Local Segmentation (ViT-B/16)...');
      const processedPhotos = [];
      const totalPhotos = photos.length;

      for (let i = 0; i < totalPhotos; i++) {
        const photo = photos[i];
        try {
          const processed = await processHairImage(photo);
          processedPhotos.push(processed);

          const progress = 5 + Math.round(((i + 1) / totalPhotos) * 30);
          setAnalysisProgress(progress);
        } catch (e) {
          console.error("Failed to analyze photo", e);
          processedPhotos.push(photo);
        }
      }

      setUploadedPhotos(processedPhotos);
      localStorage.setItem('patient_photos', JSON.stringify(processedPhotos));

      setAnalysisStage('Analyzing with Gemini AI...');
      setAnalysisProgress(40);

      const geminiAnalysis = await analyzeHairImages(processedPhotos, pData);

      setAnalysisProgress(70);
      setAnalysisStage('Extracting hairline coordinates...');

      const frontPhoto = processedPhotos.find(p => p.type === 'front');
      let hairlineData = null;
      if (frontPhoto) {
        try {
          hairlineData = await analyzeHairlineCoordinates(frontPhoto.preview);
        } catch (e) {
          console.error('Hairline analysis failed', e);
        }
      }

      setAnalysisProgress(90);
      setAnalysisStage('Generating treatment timeline...');
      await new Promise(r => setTimeout(r, 800));

      const finalAnalysis = {
        ...geminiAnalysis,
        hairlineData,
        timeline: {
          immediate: ['Start medical treatment', 'Schedule consultation with surgeon'],
          threeMonths: ['Begin prescribed medication', 'Complete pre-surgery evaluations'],
          sixMonths: ['Schedule hair transplant procedure', 'Continue medical treatments'],
          oneYear: ['Post-transplant follow-up', 'Evaluate results and plan maintenance']
        }
      };

      setAnalysisProgress(100);
      setAnalysisStage('Finalizing Report...');
      await new Promise(r => setTimeout(r, 500));

      completeAnalysis(pData, processedPhotos, finalAnalysis);
    } catch (error) {
      console.error('Analysis error:', error);
      setIsAnalyzing(false);
      setCurrentStep(2);

      if (error.message && error.message.includes('API key')) {
        alert('Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
      } else {
        alert('Analysis failed: ' + error.message);
      }
    }
  };

  const completeAnalysis = (data, photos, analysis) => {
    setAnalysisData(analysis);
    localStorage.setItem('analysis_data', JSON.stringify(analysis));
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
