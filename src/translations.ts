export type LanguageCode = 'EN' | 'TR' | 'AR';

interface Translation {
  heroTag: string;
  heroTitle1: string;
  heroTitle2: string;
  heroDesc: string;
  startBtn: string;
  methodBtn: string;
  transformationTitle: string;
  transformationDesc: string;
  beforeLabel: string;
  afterLabel: string;
  showcaseTitle1: string;
  showcaseDesc1: string;
  showcaseTitle2: string;
  showcaseDesc2: string;
  showcaseTitle3: string;
  showcaseDesc3: string;
}

export const translations: Record<LanguageCode, Translation> = {
  EN: {
    heroTag: 'AI-Powered Analysis',
    heroTitle1: 'Your Hair',
    heroTitle2: 'Restoration Journey',
    heroDesc: 'Advanced AI technology analyzes your hair loss pattern and connects you with top-rated clinics for personalized treatment plans.',
    startBtn: 'Start Analysis',
    methodBtn: 'Learn Method',
    transformationTitle: 'Real Transformation Results',
    transformationDesc: 'See the difference professional hair restoration can make',
    beforeLabel: 'BEFORE',
    afterLabel: 'AFTER',
    showcaseTitle1: 'AI-Powered Analysis',
    showcaseDesc1: 'Our advanced AI analyzes your hair density, patterns, and scalp health with medical-grade precision.',
    showcaseTitle2: 'Personalized Matching',
    showcaseDesc2: 'Get matched with verified clinics based on your specific needs, location, and budget.',
    showcaseTitle3: 'Track Your Journey',
    showcaseDesc3: 'Monitor your transformation with timeline tracking and expert guidance every step of the way.',
  },
  TR: {
    heroTag: 'Yapay Zeka Destekli Analiz',
    heroTitle1: 'Saç Restorasyonu',
    heroTitle2: 'Yolculuğunuz',
    heroDesc: 'Gelişmiş yapay zeka teknolojisi saç kaybı paternlerinizi analiz eder ve sizi kişiselleştirilmiş tedavi planları için en iyi kliniklerle buluşturur.',
    startBtn: 'Analizi Başlat',
    methodBtn: 'Yöntemi Öğren',
    transformationTitle: 'Gerçek Dönüşüm Sonuçları',
    transformationDesc: 'Profesyonel saç restorasyonunun yarattığı farkı görün',
    beforeLabel: 'ÖNCE',
    afterLabel: 'SONRA',
    showcaseTitle1: 'Yapay Zeka Analizi',
    showcaseDesc1: 'Gelişmiş yapay zekamız saç yoğunluğunuzu, paternlerinizi ve saçlı derinizi tıbbi düzeyde hassasiyetle analiz eder.',
    showcaseTitle2: 'Kişiselleştirilmiş Eşleştirme',
    showcaseDesc2: 'İhtiyaçlarınıza, konumunuza ve bütçenize göre doğrulanmış kliniklerle eşleşin.',
    showcaseTitle3: 'Yolculuğunuzu İzleyin',
    showcaseDesc3: 'Dönüşümünüzü zaman çizelgesi takibi ve her adımda uzman rehberliğiyle izleyin.',
  },
  AR: {
    heroTag: 'تحليل بالذكاء الاصطناعي',
    heroTitle1: 'رحلة استعادة',
    heroTitle2: 'شعرك',
    heroDesc: 'تقنية الذكاء الاصطناعي المتقدمة تحلل نمط تساقط شعرك وتربطك بأفضل العيادات للحصول على خطط علاج مخصصة.',
    startBtn: 'ابدأ التحليل',
    methodBtn: 'تعرف على الطريقة',
    transformationTitle: 'نتائج تحول حقيقية',
    transformationDesc: 'شاهد الفرق الذي يمكن أن تحدثه استعادة الشعر الاحترافية',
    beforeLabel: 'قبل',
    afterLabel: 'بعد',
    showcaseTitle1: 'تحليل بالذكاء الاصطناعي',
    showcaseDesc1: 'يحلل ذكاؤنا الاصطناعي المتقدم كثافة شعرك وأنماطه وصحة فروة رأسك بدقة طبية.',
    showcaseTitle2: 'مطابقة مخصصة',
    showcaseDesc2: 'احصل على مطابقة مع عيادات موثقة بناءً على احتياجاتك المحددة وموقعك وميزانيتك.',
    showcaseTitle3: 'تتبع رحلتك',
    showcaseDesc3: 'راقب تحولك مع تتبع الجدول الزمني والإرشاد المتخصص في كل خطوة.',
  },
};
