import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export const Countdown = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const endDate = new Date('2024-12-01T00:00:00');
      const difference = endDate.getTime() - new Date().getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  const timeUnits = [
    { label: 'Days', value: timeLeft.days },
    { label: 'Hours', value: timeLeft.hours },
    { label: 'Minutes', value: timeLeft.minutes },
    { label: 'Seconds', value: timeLeft.seconds }
  ];

  return (
    <div className="bg-[#1E2A37]/50 backdrop-blur-lg rounded-3xl p-8 text-white relative overflow-hidden border border-white/5 mb-8">
      <div className="relative text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-[#2D9CDB]" />
          <h3 className="text-lg font-semibold text-[#2D9CDB]">Incubation Period Ends In</h3>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {timeUnits.map((unit, index) => (
            <motion.div
              key={unit.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex flex-col items-center"
            >
              <div className="bg-[#1E2A37] w-full py-3 px-4 rounded-xl border border-white/5 mb-2">
                <span className="text-2xl font-bold text-[#2D9CDB]">
                  {unit.value.toString().padStart(2, '0')}
                </span>
              </div>
              <span className="text-xs text-gray-400">{unit.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};