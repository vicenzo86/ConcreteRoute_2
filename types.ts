export interface WorkSite {
  id: string;
  name: string;
  address: string;
  loads: number;
  volume: number; // m3
  lat: number;
  lng: number;
}

export interface UploadedWork {
  loads: number;
  address: string;
}

export interface WorkConstraint {
  workIndex: number; // Corresponds to the index in uploadedData or default list
  forcedTrucks: number;
  forcedPumpId: number; // 1-based index
  forcedStartTime: string; // HH:MM
  locked: boolean; // TRUE = Manual inputs, FALSE = Auto allocate
}

export interface SimulationParams {
  mode: 'optimizer' | 'simulator'; // New Toggle
  apiKey: string;
  branchAddress: string;
  branchLat: string;
  branchLng: string;
  loadTime: number; 
  unloadTime: number; 
  totalTrucks: number;
  totalPumps: number;
  startTime: string; 
  generations: number;
  popSize: number;
  uploadedData?: UploadedWork[];
  manualConstraints: WorkConstraint[]; // User inputs for simulator
}

export interface ScheduleItem {
  id: string;
  workId: string;
  truckId: string;
  pumpId: string;
  loadNumber: number;
  startTime: Date;
  endTime: Date;
  status: 'loading' | 'traveling' | 'unloading' | 'returning';
}

export interface OptimizationResult {
  schedule: ScheduleItem[];
  works: WorkSite[];
  branchLocation?: { lat: number; lng: number };
  summary: {
    totalTrips: number;
    completionTime: string;
    efficiency: number;
  };
}