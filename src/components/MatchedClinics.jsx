
import React from 'react';
import { motion } from 'framer-motion';
import { MapPin, Star, ShieldCheck, Phone, Award, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const MatchedClinics = () => {
  const { toast } = useToast();

  const clinics = [
    {
      id: 1,
      name: "Elite Hair Restoration",
      location: "Beverly Hills, CA",
      rating: 4.9,
      reviews: 128,
      specialization: ["FUE", "DHI", "Artas Robotic"],
      price: "$$$",
      verified: true,
      imageAlt: "Modern medical clinic reception with marble floors",
      description: "Premium facility specializing in high-density FUE transplants with natural hairlines. Recognized for celebrity clientele and discrete service."
    },
    {
      id: 2,
      name: "Advanced Follicular Centre",
      location: "Miami, FL",
      rating: 4.8,
      reviews: 342,
      specialization: ["FUE", "PRP Therapy"],
      price: "$$",
      verified: true,
      imageAlt: "Clean and bright medical consultation room with glass walls",
      description: "Leading specialists in advanced FUE techniques and comprehensive post-op care. State-of-the-art facility with 24/7 patient support."
    },
    {
      id: 3,
      name: "Global Hair Institute",
      location: "New York, NY",
      rating: 4.7,
      reviews: 89,
      specialization: ["Hybrid FUE", "Stem Cell"],
      price: "$$$$",
      verified: true,
      imageAlt: "High-tech operating room with modern medical equipment",
      description: "Pioneers in stem cell enhanced hair restoration and complex revision cases. Award-winning surgical team."
    }
  ];

  const handleContact = (clinicName) => {
    toast({
      title: "Request Sent Successfully",
      description: `We've forwarded your contact details to ${clinicName}. Their coordination team will reach out shortly via email.`,
      className: "bg-green-50 border-green-200 text-green-900"
    });
  };

  return (
    <div className="space-y-6 py-4">
       <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-600" /> 
              Matched Clinics & Specialists
            </h3>
            <p className="text-gray-500 text-sm mt-1">Verified providers matching your specific hair loss profile and treatment needs</p>
          </div>
          <ShieldCheck className="w-8 h-8 text-green-500 opacity-80" />
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clinics.map((clinic, index) => (
          <motion.div
            key={clinic.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col group"
          >
            <div className="h-48 overflow-hidden relative">
                <img alt={clinic.imageAlt} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" src="https://images.unsplash.com/photo-1629909613638-0e4a1fad8f81" />
                {clinic.verified && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur text-xs font-bold px-2.5 py-1 rounded-full flex items-center text-indigo-700 shadow-sm border border-indigo-100">
                    <ShieldCheck className="w-3 h-3 mr-1 fill-indigo-100" /> Verified Match
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pt-8">
                  <div className="flex justify-between items-end">
                    <h4 className="font-bold text-white text-lg leading-tight shadow-sm">{clinic.name}</h4>
                  </div>
                </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center text-gray-600 text-xs font-medium">
                   <MapPin className="w-3.5 h-3.5 mr-1 text-gray-400" />
                   {clinic.location}
                </div>
                <div className="flex items-center bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 mr-1" />
                  <span className="text-xs font-bold text-amber-800">{clinic.rating}</span>
                  <span className="text-[10px] text-amber-600 ml-1">({clinic.reviews})</span>
                </div>
              </div>

              <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-1 leading-relaxed">{clinic.description}</p>

              <div className="flex flex-wrap gap-2 mb-5">
                {clinic.specialization.map(spec => (
                  <span key={spec} className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-md font-semibold">
                    {spec}
                  </span>
                ))}
              </div>

              <Button 
                onClick={() => handleContact(clinic.name)}
                variant="outline"
                className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white transition-colors group-hover:border-indigo-600"
              >
                <span className="mr-2">Contact Clinic</span>
                <ExternalLink className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        ))}
       </div>
    </div>
  );
};

export default MatchedClinics;
