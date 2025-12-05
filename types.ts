export interface WorkSite {
  id: string;
  name: string;
  address: string;
  loads: number;
  volume: number; // m3
  lat: number;
  lng: number;
}

export interface SimulationParams {
  apiKey: string;
  branchAddress: string;
  loadTime: number; // minutes
  unloadTime: number; // minutes
  totalTrucks: number;
  totalPumps: number;
  startTime: string; // HH:MM
  generations: number;
  popSize: number;
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
  summary: {
    totalTrips: number;
    completionTime: string;
    efficiency: number;
  };
}
