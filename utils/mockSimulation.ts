import { OptimizationResult, ScheduleItem, SimulationParams, WorkSite } from '../types';

// Helper to add minutes to a date
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

// Mock coordinates around a central point (Navegantes, SC roughly based on prompt)
const BASE_LAT = -26.89;
const BASE_LNG = -48.65;

export const generateMockData = (params: SimulationParams): OptimizationResult => {
  const works: WorkSite[] = Array.from({ length: 8 }).map((_, i) => ({
    id: `W-${i + 1}`,
    name: `Obra Residencial ${i + 1}`,
    address: `Rua Exemplo ${i * 100}, Navegantes - SC`,
    loads: Math.floor(Math.random() * 5) + 3, // 3 to 8 loads
    volume: 0, // Calculated later
    lat: BASE_LAT + (Math.random() - 0.5) * 0.1,
    lng: BASE_LNG + (Math.random() - 0.5) * 0.1,
  }));

  works.forEach(w => w.volume = w.loads * 8); // Assuming 8m3 per truck

  const schedule: ScheduleItem[] = [];
  const startDateTime = new Date();
  const [startHour, startMinute] = params.startTime.split(':').map(Number);
  startDateTime.setHours(startHour, startMinute, 0, 0);

  let currentTruckIndex = 0;

  // Simple heuristic simulation to generate a "Gantt-like" structure
  works.forEach((work, idx) => {
    // Assign a pump to this work (Round robin for mock)
    const pumpId = `BOMBA-${(idx % params.totalPumps) + 1}`;
    
    // Stagger start times for works slightly
    let lastFinishTime = addMinutes(startDateTime, idx * 15); 

    for (let i = 1; i <= work.loads; i++) {
      const truckId = `CAM-${(currentTruckIndex % params.totalTrucks) + 1}`;
      currentTruckIndex++;

      const travelTime = 20 + Math.random() * 20; // 20-40 min travel
      
      const loadStart = lastFinishTime;
      const loadEnd = addMinutes(loadStart, params.loadTime);
      
      const travelEnd = addMinutes(loadEnd, travelTime);
      
      const unloadStart = travelEnd;
      const unloadEnd = addMinutes(unloadStart, params.unloadTime);
      
      // Update last finish time for the NEXT load of this work 
      // (assuming pump constraint implies serial unloading)
      lastFinishTime = unloadEnd; 

      schedule.push({
        id: `${work.id}-L${i}`,
        workId: work.id,
        truckId: truckId,
        pumpId: pumpId,
        loadNumber: i,
        startTime: loadStart,
        endTime: unloadEnd,
        status: 'unloading' // Simplified status for the Gantt visual
      });
    }
  });

  // Calculate summary metrics
  const lastEvent = schedule.reduce((max, item) => item.endTime > max ? item.endTime : max, new Date(0));
  
  return {
    works,
    schedule,
    summary: {
      totalTrips: schedule.length,
      completionTime: lastEvent.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      efficiency: 85 + Math.random() * 10,
    }
  };
};
