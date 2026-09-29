// =============================================================================
// Design State Serialization — Save/Load JSON
// =============================================================================

import type { DesignData } from '../store/types';

/** Export design state to a downloadable JSON file */
export function downloadDesignJSON(data: DesignData, fileName: string = 'solar_design.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import design state from a JSON file via file picker */
export function importDesignJSON(): Promise<DesignData | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data: DesignData = JSON.parse(e.target?.result as string);
          resolve(data);
        } catch {
          console.error('Invalid JSON file');
          resolve(null);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

/** Validate that a DesignData object has all required fields */
export function validateDesignData(data: any): data is DesignData {
  if (!data || typeof data !== 'object') return false;
  const requiredKeys = ['roofs', 'obstructions', 'subArrays', 'inverters', 'dimensions', 'textBlocks'];
  return requiredKeys.every(key => Array.isArray(data[key]));
}
