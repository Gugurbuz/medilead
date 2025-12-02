import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, DollarSign, Calendar, Phone, Mail, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const GetQuote = ({ isOpen, onClose, analysisData, photos }) => {
  const [step, setStep] = useState('form'); // form, success
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    age: '',
    budgetMin: '',
    budgetMax: '',
    timeline: '1-3 months',
    notes: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('leads')
        .insert([
          {
            name: formData.name,
            email: formData.email,
            phone: formData.phone,
            age: formData.age ? parseInt(formData.age) : null,
            budget_min: formData.budgetMin ? parseInt(formData.budgetMin) : null,
            budget_max: formData.budgetMax ? parseInt(formData.budgetMax) : null,
            timeline: formData.timeline,
            notes: formData.notes,
            analysis_data: analysisData || null,
            photos: photos || null,
            status: 'new'
          }
        ])
        .select();

      if (error) throw error;

      setStep('success');
    } catch (error) {
      console.error('Error submitting lead:', error);
      alert('Failed to submit quote request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep('form');
    setFormData({
      name: '',
      email: '',
      phone: '',
      age: '',
      budgetMin: '',
      budgetMax: '',
      timeline: '1-3 months',
      notes: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
          <div>
            <h2 className="text-2xl font-bold">Get Your Quote</h2>
            <p className="text-emerald-100 text-sm">Connect with top hair restoration clinics</p>
          </div>
          <button
            onClick={resetAndClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 'form' && (
              <motion.div
                key="quote-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Personal Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <User className="w-5 h-5 text-emerald-600" /> Personal Information
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.name}
                          onChange={(e) => handleInputChange('name', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Age
                        </label>
                        <input
                          type="number"
                          value={formData.age}
                          onChange={(e) => handleInputChange('age', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="35"
                          min="18"
                          max="100"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Mail className="w-4 h-4" /> Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.email}
                          onChange={(e) => handleInputChange('email', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="john@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                          <Phone className="w-4 h-4" /> Phone
                        </label>
                        <input
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => handleInputChange('phone', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Budget & Timeline */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-600" /> Budget & Timeline
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Min Budget ($)
                        </label>
                        <input
                          type="number"
                          value={formData.budgetMin}
                          onChange={(e) => handleInputChange('budgetMin', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="5000"
                          min="0"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Max Budget ($)
                        </label>
                        <input
                          type="number"
                          value={formData.budgetMax}
                          onChange={(e) => handleInputChange('budgetMax', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="15000"
                          min="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> Timeline
                      </label>
                      <select
                        value={formData.timeline}
                        onChange={(e) => handleInputChange('timeline', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      >
                        <option value="1-3 months">1-3 months</option>
                        <option value="3-6 months">3-6 months</option>
                        <option value="6-12 months">6-12 months</option>
                        <option value="12+ months">12+ months</option>
                        <option value="just researching">Just researching</option>
                      </select>
                    </div>
                  </div>

                  {/* Additional Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                      rows="3"
                      placeholder="Any specific concerns or questions..."
                    />
                  </div>
                </form>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success-message"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center py-12"
              >
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Quote Request Submitted!</h3>
                <p className="text-gray-600 mb-8 max-w-md">
                  Thank you for your interest! We've received your information and will connect you with suitable clinics shortly.
                  <br /><br />
                  You'll receive personalized quotes via email within 24-48 hours.
                </p>
                <Button onClick={resetAndClose} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  Return to Report
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        {step === 'form' && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Your information is secure and will only be shared with qualified clinics
            </p>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.email}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 shadow-lg shadow-emerald-200 disabled:shadow-none"
            >
              {isSubmitting ? 'Submitting...' : 'Get Quote'}
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default GetQuote;
