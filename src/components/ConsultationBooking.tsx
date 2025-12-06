import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar as CalendarIcon, Clock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Props için Interface
interface ConsultationBookingProps {
  isOpen: boolean;
  onClose: () => void;
}

type BookingStep = 'date' | 'success';

const ConsultationBooking: React.FC<ConsultationBookingProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<BookingStep>('date');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);

  // Generate next 14 days
  useEffect(() => {
    const days: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      // Skip weekends for realism
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        days.push(date);
      }
    }
    
    setAvailableDates(days.slice(0, 10)); // Show next 10 business days
  }, []);

  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
    '11:00 AM', '11:30 AM', '01:00 PM', '01:30 PM',
    '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM'
  ];

  const handleConfirm = () => {
    // Simulate API call
    setTimeout(() => {
      setStep('success');
    }, 800);
  };

  const resetAndClose = () => {
    setStep('date');
    setSelectedDate(null);
    setSelectedTime(null);
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
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div>
            <h2 className="text-2xl font-bold">Schedule Consultation</h2>
            <p className="text-indigo-100 text-sm">Speak with a hair restoration specialist</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <AnimatePresence mode="wait">
            {step === 'date' && (
              <motion.div
                key="date-selection"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                {/* Date Selection */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <CalendarIcon className="w-5 h-5 text-indigo-600" /> Select a Date
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {availableDates.map((date) => (
                      <button
                        key={date.toISOString()}
                        onClick={() => setSelectedDate(date)}
                        className={`p-3 rounded-xl border transition-all text-sm flex flex-col items-center justify-center gap-1 ${
                          selectedDate === date
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-600 ring-offset-2'
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        <span className="font-medium uppercase text-xs opacity-70">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </span>
                        <span className="text-lg font-bold">
                          {date.getDate()}
                        </span>
                        <span className="text-xs opacity-70">
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Time Selection (Only visible if date selected) */}
                <div className={`transition-opacity duration-300 ${selectedDate ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-indigo-600" /> Select a Time
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        className={`py-2 px-1 rounded-lg border text-sm transition-all ${
                          selectedTime === time
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-md'
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 text-gray-600'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
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
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Consultation Confirmed!</h3>
                <p className="text-gray-600 mb-8 max-w-md">
                  Your appointment is scheduled for <strong>{selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong> at <strong>{selectedTime}</strong>.
                  <br />
                  We've sent a calendar invitation to your email.
                </p>
                <Button onClick={resetAndClose} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  Return to Report
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        {step === 'date' && (
          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center">
            <div className="text-sm">
              {selectedDate && selectedTime ? (
                <span className="text-indigo-900 font-medium">
                  {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {selectedTime}
                </span>
              ) : (
                <span className="text-gray-400 italic">Please select a date and time</span>
              )}
            </div>
            <Button 
              onClick={handleConfirm} 
              disabled={!selectedDate || !selectedTime}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 shadow-lg shadow-indigo-200 disabled:shadow-none"
            >
              Confirm Booking
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default ConsultationBooking;