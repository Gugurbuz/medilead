
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

const PatientForm = ({ onSubmit, existingData = null, photos }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState(existingData || {
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
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
      className="max-w-4xl mx-auto"
    >
      <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Patient Profile</h2>
          <p className="text-gray-600">Help us understand your hair loss condition better</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="age" className="text-gray-700 font-medium">Age *</Label>
              <input
                type="number"
                id="age"
                name="age"
                value={formData.age}
                onChange={handleChange}
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                placeholder="Enter your age"
                min="18"
                max="100"
                required
              />
            </div>

            <div>
              <Label htmlFor="gender" className="text-gray-700 font-medium">Gender *</Label>
              <select
                id="gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
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
            <Label htmlFor="hairLossDuration" className="text-gray-700 font-medium">
              How long have you been experiencing hair loss? *
            </Label>
            <select
              id="hairLossDuration"
              name="hairLossDuration"
              value={formData.hairLossDuration}
              onChange={handleChange}
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
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
            <Label htmlFor="familyHistory" className="text-gray-700 font-medium">
              Family History of Hair Loss
            </Label>
            <select
              id="familyHistory"
              name="familyHistory"
              value={formData.familyHistory}
              onChange={handleChange}
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
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
            <Label htmlFor="previousTreatments" className="text-gray-700 font-medium">
              Previous Treatments (if any)
            </Label>
            <textarea
              id="previousTreatments"
              name="previousTreatments"
              value={formData.previousTreatments}
              onChange={handleChange}
              rows="3"
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              placeholder="E.g., Minoxidil, Finasteride, PRP therapy..."
            />
          </div>

          <div>
            <Label htmlFor="medications" className="text-gray-700 font-medium">
              Current Medications
            </Label>
            <textarea
              id="medications"
              name="medications"
              value={formData.medications}
              onChange={handleChange}
              rows="2"
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              placeholder="List any medications you're currently taking..."
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Lifestyle Factors</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="lifestyle.stress" className="text-gray-700 font-medium">
                  Stress Level
                </Label>
                <select
                  id="lifestyle.stress"
                  name="lifestyle.stress"
                  value={formData.lifestyle.stress}
                  onChange={handleChange}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                >
                  <option value="">Select</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <Label htmlFor="lifestyle.diet" className="text-gray-700 font-medium">
                  Diet Quality
                </Label>
                <select
                  id="lifestyle.diet"
                  name="lifestyle.diet"
                  value={formData.lifestyle.diet}
                  onChange={handleChange}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                >
                  <option value="">Select</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>

              <div>
                <Label htmlFor="lifestyle.smoking" className="text-gray-700 font-medium">
                  Smoking Status
                </Label>
                <select
                  id="lifestyle.smoking"
                  name="lifestyle.smoking"
                  value={formData.lifestyle.smoking}
                  onChange={handleChange}
                  className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
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
            <Label htmlFor="goals" className="text-gray-700 font-medium">
              Treatment Goals & Expectations
            </Label>
            <textarea
              id="goals"
              name="goals"
              value={formData.goals}
              onChange={handleChange}
              rows="3"
              className="mt-1 w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
              placeholder="What are you hoping to achieve with treatment?"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm text-amber-800">
              <strong>Privacy Notice:</strong> Your information is stored locally on your device and is used only to generate your personalized analysis report. We do not share your data with third parties.
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8"
              size="lg"
            >
              Generate Analysis Report
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default PatientForm;
