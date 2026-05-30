import { useState, useEffect } from 'react';

interface GeneralSettings {
  systemName: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
}

const defaultSettings: GeneralSettings = {
  systemName: 'WaspGuard AI',
  timezone: 'Asia/Ho_Chi_Minh',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
};

export function useGeneralSettings() {
  const [settings, setSettings] = useState<GeneralSettings>(defaultSettings);
  
  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('generalSettings');
        if (savedSettings) {
          setSettings(JSON.parse(savedSettings));
        }
      } catch (error) {
        console.error('Error loading general settings:', error);
      }
    }
  }, []);

  return settings;
}