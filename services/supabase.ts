import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://rqrilfgdtqfjnczmogus.supabase.co';
const SUPABASE_KEY = (import.meta as any).env?.VITE_SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJxcmlsZmdkdHFmam5jem1vZ3VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MzExNjEsImV4cCI6MjEwNjMwNzE2MX0.7Q-hpARqarmgPGTsx7zFv5vpzruP5uLOALA_Qz9wO0A';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper function to ensure keys are lowercase
export const normalizeKeys = (obj: any) => {
  if (!obj || typeof obj !== 'object') return obj;
  const newObj: any = {};
  Object.keys(obj).forEach(key => {
    newObj[key.toLowerCase()] = obj[key];
  });
  return newObj;
};

