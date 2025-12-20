import React, { useState, ChangeEvent, FormEvent } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

// Tip Tanımları (Interfaces)
interface Lifestyle {
  stress: string;
  diet: string;
  smoking: string;
}

interface PatientData {
  age: string;
  gender: string;
  hairLossDuration: string;
  familyHistory: string;
  previousTreatments: string;
  medications: string;
  lifestyle: Lifestyle;
  goals: string;
  // Dinamik erişim için index signature
  [key: string]: string | Lifestyle | any; 
}

interface PatientFormProps {
  onSubmit: (data: PatientData) => void;
  existingData?: PatientData | null;
  photos?: any[]; // Fotoğraf objesinin yapısı belliyse burayı detaylandırabilirsin
}

const PatientForm: React.FC<PatientFormProps> = ({ onSubmit, existingData = null, photos }) => {
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<PatientData>(existingData || {
    age: '',
    gender: '',
    hairLossDuration: '',
    familyHistory: '',
    previousTreatments: '',
    medications: '',
    lifestyle: {
      stress: '',
      diet: '',
      smoking: ''
    },
    goals: ''
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent] as Lifestyle),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!formData.age || !formData.gender || !formData.hairLossDuration) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields marked with *",
        variant: "destructive"
      });
      return;
    }

    onSubmit(formData);
    toast({
      title: "Profile created successfully",
      description: "Generating your personalized analysis..."
    });
  };

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
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            STEP 2 OF 3
          </div>
          <h2 className="text-4xl md:text-5xl font-light text-[#0E1A2B] mb-3 tracking-tight">
            Patient <span className="font-bold">Profile</span>
          </h2>
          <p className="text-slate-500 text-lg font-light">Help us understand your hair loss condition better</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="age" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">Age *</Label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
                placeholder="Enter your age"
                min="18"
                max="100"
                required
              />
            </div>

            <div>
              <Label htmlFor="gender" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">Gender *</Label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
                required
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="hairLossDuration" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
              How long have you been experiencing hair loss? *
            </Label>
            <select
              id="hairLossDuration"
              name="hairLossDuration"
              value={formData.hairLossDuration}
              onChange={handleChange}
              className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
              required
            >
              <option value="">Select duration</option>
              <option value="< 1 year">Less than 1 year</option>
              <option value="1-3 years">1-3 years</option>
              <option value="3-5 years">3-5 years</option>
              <option value="5-10 years">5-10 years</option>
              <option value="> 10 years">More than 10 years</option>
            </select>
          </div>

          <div>
            <Label htmlFor="familyHistory" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
              Family History of Hair Loss
            </Label>
            <select
              id="familyHistory"
              name="familyHistory"
              value={formData.familyHistory}
              onChange={handleChange}
              className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
            >
              <option value="">Select option</option>
              <option value="yes-paternal">Yes - Father's side</option>
              <option value="yes-maternal">Yes - Mother's side</option>
              <option value="yes-both">Yes - Both sides</option>
              <option value="no">No family history</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <Label htmlFor="previousTreatments" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
              Previous Treatments (if any)
            </Label>
            <textarea
              id="previousTreatments"
              name="previousTreatments"
              value={formData.previousTreatments}
              onChange={handleChange}
              rows={3}
              className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
              placeholder="E.g., Minoxidil, Finasteride, PRP therapy..."
            />
          </div>

          <div>
            <Label htmlFor="medications" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
              Current Medications
            </Label>
            <textarea
              id="medications"
              name="medications"
              value={formData.medications}
              onChange={handleChange}
              rows={2}
              className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
              placeholder="List any medications you're currently taking..."
            />
          </div>

          <div className="border-t-2 border-slate-200 pt-8">
            <h3 className="text-2xl font-bold text-[#0E1A2B] mb-6">Lifestyle Factors</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="lifestyle.stress" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
                  Stress Level
                </Label>
                <select
                  id="lifestyle.stress"
                  name="lifestyle.stress"
                  value={formData.lifestyle.stress}
                  onChange={handleChange}
                  className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <Label htmlFor="lifestyle.diet" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
                  Diet Quality
                </Label>
                <select
                  id="lifestyle.diet"
                  name="lifestyle.diet"
                  value={formData.lifestyle.diet}
                  onChange={handleChange}
                  className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
                >
                  <option value="">Select</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>

              <div>
                <Label htmlFor="lifestyle.smoking" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
                  Smoking Status
                </Label>
                <select
                  id="lifestyle.smoking"
                  name="lifestyle.smoking"
                  value={formData.lifestyle.smoking}
                  onChange={handleChange}
                  className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
                >
                  <option value="">Select</option>
                  <option value="never">Never</option>
                  <option value="former">Former smoker</option>
                  <option value="current">Current smoker</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="goals" className="text-[#0E1A2B] font-bold text-sm uppercase tracking-wider mb-3 block">
              Treatment Goals & Expectations
            </Label>
            <textarea
              id="goals"
              name="goals"
              value={formData.goals}
              onChange={handleChange}
              rows={3}
              className="w-full px-5 py-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 text-[#0E1A2B] font-medium"
              placeholder="What are you hoping to achieve with treatment?"
            />
          </div>

          <div className="bg-teal-50 border-2 border-teal-200 rounded-2xl p-6">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-teal-900 font-medium leading-relaxed">
                  <strong className="font-bold">Privacy Notice:</strong> Your information is stored locally on your device and is used only to generate your personalized analysis report. We do not share your data with third parties.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-6">
            <button
              type="submit"
              className="px-12 py-5 bg-[#0E1A2B] text-white rounded-2xl font-bold text-sm uppercase tracking-[0.2em] shadow-2xl hover:bg-slate-800 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 relative overflow-hidden group"
            >
              <span className="relative z-10">Generate Analysis Report</span>
              <svg className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="absolute inset-0 bg-teal-500 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default PatientForm;