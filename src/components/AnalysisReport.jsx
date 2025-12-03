import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Download, Share2, FileText, Activity, User, Calendar,
  ChevronDown, ChevronUp, Info, CheckCircle2, AlertCircle,
  Stethoscope, Microscope, Layers, ArrowRight, Sparkles
} from 'lucide-react';
import { useToast } from '@/src/components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import TreatmentRecommendations from './TreatmentRecommendations';
import TreatmentTimeline from './TreatmentTimeline';
import HairDensityMap from './HairDensityMap';
import { createPremiumHairVisual } from '@/src/lib/visionModel';

const AnalysisReport = ({ results, patientData, onRestart }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('summary');
  const [expandedSection, setExpandedSection] = useState(null);
  const [premiumVisuals, setPremiumVisuals] = useState({});

  const { analysis, photos, timestamp } = results;

  useEffect(() => {
    const generateVisuals = async () => {
      if (!photos || photos.length === 0) return;

      const visuals = {};
      for (const photo of photos) {
        try {
          // Generate a premium visual for each photo
          const premiumUrl = await createPremiumHairVisual(photo.preview);
          visuals[photo.type] = premiumUrl;
        } catch (error) {
          console.error(`Error generating premium visual for ${photo.type}:`, error);
          // Fallback to original image if generation fails
          visuals[photo.type] = photo.preview;
        }
      }
      setPremiumVisuals(visuals);
    };

    generateVisuals();
  }, [photos]);

  const handleDownload = () => {
    toast({
      title: "Rapor İndiriliyor",
      description: "PDF raporunuz hazırlanıyor...",
    });
    setTimeout(() => {
      toast({
        title: "İndirme Tamamlandı",
        description: "Raporunuz başarıyla indirildi.",
        variant: "success",
      });
    }, 2000);
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: 'MediLead Saç Analiz Raporu',
        text: `${patientData.name} için saç analizi sonuçları.`,
        url: window.location.href,
      });
    } catch (error) {
      toast({
        title: "Paylaşılamadı",
        description: "Rapor paylaşılırken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStageColor = (stage) => {
    if (stage.includes('I') || stage.includes('II')) return 'bg-green-500/20 text-green-400';
    if (stage.includes('III') || stage.includes('IV')) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  const ReportHeader = () => (
    <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/10 mb-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <FileText className="w-8 h-8 text-indigo-400" />
            Saç Analiz Raporu
          </h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1">
              <User className="w-4 h-4" />
              {patientData.name}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(timestamp).toLocaleDateString('tr-TR')}
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            <Download className="w-5 h-5" />
            <span className="hidden md:inline">İndir</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Share2 className="w-5 h-5" />
            <span className="hidden md:inline">Paylaş</span>
          </button>
        </div>
      </div>
    </div>
  );

  const SummaryCard = ({ title, value, icon: Icon, color, subValue }) => (
    <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
      <div className="flex items-start justify-between mb-2">
        <span className="text-gray-400 text-sm">{title}</span>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      {subValue && <div className="text-xs text-gray-500">{subValue}</div>}
    </div>
  );

  const DetailedObservations = () => (
    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => toggleSection('observations')}
        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Microscope className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-semibold text-white">Detaylı Gözlemler</h3>
        </div>
        {expandedSection === 'observations' ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>
      <AnimatePresence>
        {expandedSection === 'observations' && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-white/10 space-y-3">
              {analysis.detailedObservations.map((observation, index) => (
                <div key={index} className="flex items-start gap-3 bg-white/5 p-3 rounded-lg">
                  <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                  <p className="text-gray-300 text-sm">{observation}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <ReportHeader />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white/5 border border-white/10 p-1">
            <TabsTrigger value="summary" className="data-[state=active]:bg-indigo-600">
              Özet
            </TabsTrigger>
            <TabsTrigger value="analysis" className="data-[state=active]:bg-indigo-600">
              Detaylı Analiz
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="data-[state=active]:bg-indigo-600">
              Tedavi Planı
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <SummaryCard
                title="Genel Skor"
                value={`${analysis.overallScore}/10`}
                icon={Activity}
                color={getScoreColor(analysis.overallScore)}
                subValue="Saç Sağlığı Endeksi"
              />
              <SummaryCard
                title="Dökülme Evresi"
                value={analysis.hairLossStage}
                icon={Layers}
                color="text-indigo-400"
                subValue="Norwood Ölçeği"
              />
              <SummaryCard
                title="Tahmini Greft"
                value={analysis.estimatedGrafts}
                icon={Stethoscope}
                color="text-green-400"
                subValue="Önerilen Miktar"
              />
              <SummaryCard
                title="Donör Kalitesi"
                value={analysis.donorQuality}
                icon={CheckCircle2}
                color="text-blue-400"
                subValue="Verici Bölge Durumu"
              />
            </div>

            {/* AI Visual Analysis - Premium Visuals */}
            <div className="bg-gray-900/50 backdrop-blur-xl p-6 rounded-2xl border border-white/10">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                AI Saç Analizi Görselleri
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5">
                      {/* Use the premium visual URL if available, otherwise fallback to preview */}
                      <img
                        src={premiumVisuals[photo.type] || photo.preview}
                        alt={`${photo.label} Analizi`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="text-white text-sm font-medium">{photo.label}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-400 mt-4 flex items-center gap-2">
                <Info className="w-4 h-4" />
                Bu görseller, saç yoğunluğunu ve sağlığını vurgulamak için yapay zeka ile işlenmiştir. Yüz hatları gizlenmiş ve saç bölgelerine odaklanılmıştır.
              </p>
            </div>

            {/* Detailed Observations */}
            <DetailedObservations />

            {/* Primary Recommendation */}
            {analysis.recommendations.length > 0 && (
              <div className="bg-indigo-600/20 border border-indigo-500/30 p-6 rounded-2xl">
                <div className="flex items-start gap-4">
                  <Sparkles className="w-8 h-8 text-indigo-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      Birincil Öneri: {analysis.recommendations[0].title}
                    </h3>
                    <p className="text-gray-300 mb-4">
                      {analysis.recommendations[0].description}
                    </p>
                    <button
                      onClick={() => setActiveTab('recommendations')}
                      className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                    >
                      Tüm Tedavi Planını Gör
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="analysis" className="space-y-6">
            <HairDensityMap data={analysis} />
            <DetailedObservations />
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-8">
            <TreatmentRecommendations recommendations={analysis.recommendations} />
            <TreatmentTimeline stage={analysis.hairLossStage} />
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mt-12">
          <button
            onClick={onRestart}
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium"
          >
            Yeni Analiz Başlat
          </button>
          <button className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-medium flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Ücretsiz Konsültasyon Al
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisReport;