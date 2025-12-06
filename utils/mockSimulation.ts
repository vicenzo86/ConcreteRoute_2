
import { OptimizationResult, ScheduleItem, SimulationParams, WorkSite } from '../types';

// ==========================================
// HELPERS & CONFIG
// ==========================================

// Helper to add minutes to a date
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

// Helper to parse HH:MM to minutes from midnight
const getMinutesFromMidnight = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

// Haversine distance
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Simulated Travel Time: Matches Python logic roughly (min 10 mins, + factor of distance)
function getSimulatedTravelTime(from: { lat: number, lng: number }, to: { lat: number, lng: number }) {
  const dist = getDistanceFromLatLonInKm(from.lat, from.lng, to.lat, to.lng);
  // Base 10 mins + 2.0 min per km (Conservative city traffic)
  return 10 + (dist * 2.0); 
}

// HERE Geocoding API Call
async function getGeocodeFromHere(address: string, apiKey: string): Promise<{lat: number, lng: number} | null> {
    if (!apiKey || !address) return null;
    try {
        const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${apiKey}`;
        const response = await fetch(url);
        if (!response.ok) return null;
        
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const pos = data.items[0].position;
            return { lat: pos.lat, lng: pos.lng };
        }
    } catch (e) {
        console.warn(`Geocoding failed for ${address}`, e);
    }
    return null;
}

// Safe Fallback Points (Strictly Inland to avoid Sea)
const REALISTIC_POINTS = [
    { lat: -26.8826, lng: -48.6658 }, // Navegantes Centro (Safe)
    { lat: -26.8900, lng: -48.6800 }, // São Domingos (Inland)
    { lat: -26.8700, lng: -48.6550 }, // Near Airport (Safe)
    { lat: -26.9100, lng: -48.6900 }, // Itaipava (Inland)
    { lat: -26.9050, lng: -48.6700 }, // São Vicente (Itajaí)
    { lat: -26.8950, lng: -48.7000 }, // Rural West
    { lat: -26.8600, lng: -48.6500 }, // Machados (Inland)
    { lat: -26.9200, lng: -48.6800 }, // Cordeiros (Itajaí)
    { lat: -26.8850, lng: -48.6600 }, // Port area
    { lat: -26.9000, lng: -48.6650 }, // River side
];

function getFallbackCoords(index: number) {
  const base = REALISTIC_POINTS[index % REALISTIC_POINTS.length];
  const jitterLat = (Math.random() - 0.5) * 0.002;
  const jitterLng = (Math.random() - 0.5) * 0.002;
  return { lat: base.lat + jitterLat, lng: base.lng + jitterLng };
}

// ==========================================
// MAIN LOGIC
// ==========================================

export const generateMockData = async (params: SimulationParams): Promise<OptimizationResult> => {
  
  // 1. DETERMINE BRANCH LOCATION
  let branchCoords = { lat: -26.8955, lng: -48.6757 };
  const manualLat = parseFloat(params.branchLat);
  const manualLng = parseFloat(params.branchLng);
  if (!isNaN(manualLat) && !isNaN(manualLng)) {
      branchCoords = { lat: manualLat, lng: manualLng };
  } else if (params.apiKey && params.branchAddress && params.branchAddress.length > 5) {
      const found = await getGeocodeFromHere(params.branchAddress, params.apiKey);
      if (found) branchCoords = found;
  }

  // 2. PREPARE WORKS DATA
  let rawWorks: WorkSite[] = [];
  
  if (params.uploadedData && params.uploadedData.length > 0) {
    rawWorks = await Promise.all(params.uploadedData.map(async (item, i) => {
      let coords = null;
      if (params.apiKey && item.address.length > 5 && !item.address.toLowerCase().includes("exemplo")) {
          let searchAddr = item.address;
          if (!searchAddr.toLowerCase().includes("navegantes") && !searchAddr.toLowerCase().includes("sc")) {
              searchAddr += ", Navegantes, SC, Brasil";
          }
          coords = await getGeocodeFromHere(searchAddr, params.apiKey);
      }
      if (!coords) coords = getFallbackCoords(i);
      return {
        id: `W-${i + 1}`,
        name: `Obra ${i + 1}`,
        address: item.address,
        volume: item.loads * params.truckCapacity,
        loads: item.loads > 0 ? item.loads : 1,
        lat: coords.lat,
        lng: coords.lng,
      };
    }));
  } else {
    // Generate Mock Data (Default 5 works if Simulator mode to match Sidebar defaults, else 15)
    const count = params.mode === 'simulator' ? 5 : 15;
    rawWorks = Array.from({ length: count }).map((_, i) => {
      const coords = getFallbackCoords(i);
      const loads = Math.floor(Math.random() * 8) + 3;
      return {
        id: `W-${i + 1}`,
        name: `Residencial ${i + 1}`,
        address: `Rua Exemplo ${i * 100}, Navegantes - SC`,
        loads: loads,
        volume: loads * params.truckCapacity,
        lat: coords.lat,
        lng: coords.lng,
      };
    });
  }

  // 3. EXECUTE BASED ON MODE
  if (params.mode === 'simulator') {
      return runSimulator(rawWorks, branchCoords, params);
  } else {
      return runOptimizer(rawWorks, branchCoords, params);
  }
};

// ==========================================
// OPTIMIZER LOGIC (Heuristic / "GA")
// ==========================================
function runOptimizer(works: WorkSite[], branchCoords: {lat: number, lng: number}, params: SimulationParams): OptimizationResult {
  // Priority Sorting based on travel time
  let pendingWorks = works.map(w => {
    const travelTime = getSimulatedTravelTime(branchCoords, w);
    const unitTime = params.loadTime + (2 * travelTime) + params.unloadTime;
    return { ...w, unitTimeEst: unitTime, totalTimeEst: unitTime * w.loads };
  }).sort((a, b) => b.totalTimeEst - a.totalTimeEst);

  const numPumps = params.totalPumps;
  const totalTrucks = params.totalTrucks;
  
  // Heuristic Truck Allocation
  const topN = Math.min(numPumps, pendingWorks.length);
  const sumTopTimes = pendingWorks.slice(0, topN).reduce((sum, w) => sum + w.totalTimeEst, 0);
  const trucksPerPump: number[] = [];
  for (let i = 0; i < numPumps; i++) {
    if (i < topN) {
       const percent = sumTopTimes > 0 ? pendingWorks[i].totalTimeEst / sumTopTimes : 0;
       let assigned = Math.round(percent * totalTrucks);
       if (assigned < 1) assigned = 1;
       trucksPerPump.push(assigned);
    } else {
       trucksPerPump.push(1);
    }
  }

  // Balance trucks
  let currentSum = trucksPerPump.reduce((a, b) => a + b, 0);
  let diff = totalTrucks - currentSum;
  let pIdx = 0;
  while (diff !== 0) {
      if (diff > 0) { trucksPerPump[pIdx % numPumps]++; diff--; }
      else { if (trucksPerPump[pIdx % numPumps] > 1) { trucksPerPump[pIdx % numPumps]--; diff++; } }
      pIdx++;
  }

  const pumps = trucksPerPump.map((count, i) => ({
    id: `Bomba ${i + 1}`,
    trucks: count,
    coords: { ...branchCoords },
    availableTime: 0, 
  }));

  const schedule: ScheduleItem[] = [];
  
  // CONSTRUCT START DATE TIME
  const [year, month, day] = params.startDate.split('-').map(Number);
  const [sh, sm] = params.startTime.split(':').map(Number);
  // Month is 0-indexed in Date constructor
  const startDateTime = new Date(year, month - 1, day, sh, sm, 0, 0);

  const getFreePumps = (timeRef: number) => pumps.filter(p => p.availableTime <= timeRef + 0.01);

  // Simulation Loop
  while (pendingWorks.length > 0) {
      pumps.sort((a, b) => a.availableTime - b.availableTime);
      const nextTime = pumps[0].availableTime;
      
      let freePumps = getFreePumps(nextTime);
      if (freePumps.length === 0) {
         const earliest = Math.min(...pumps.map(p => p.availableTime));
         freePumps = getFreePumps(earliest);
      }

      const m = freePumps.length;
      freePumps.sort((a, b) => b.trucks - a.trucks);
      pendingWorks.sort((a, b) => (b.unitTimeEst * b.loads) - (a.unitTimeEst * a.loads));
      
      const selectedWorks = pendingWorks.splice(0, m);

      for (let i = 0; i < selectedWorks.length; i++) {
          if (i >= freePumps.length) break;
          const pump = freePumps[i];
          const work = selectedWorks[i];
          const travelTime = getSimulatedTravelTime(pump.coords, work);
          const durationMin = ((params.loadTime + (2 * travelTime) + params.unloadTime) * work.loads) / pump.trucks;

          const departTime = Math.max(pump.availableTime, nextTime);
          const arrivalAtSite = departTime + travelTime;
          const finishAtSite = arrivalAtSite + durationMin;
          const interval = durationMin / work.loads;
          const pumpTruckIds = Array.from({length: pump.trucks}, (_, t) => `${pump.id}-T${t+1}`);

          for (let l = 0; l < work.loads; l++) {
              const truckId = pumpTruckIds[l % pump.trucks];
              const loadStart = arrivalAtSite + (l * interval);
              schedule.push({
                  id: `${work.id}-L${l+1}`,
                  workId: work.id,
                  truckId: truckId,
                  pumpId: pump.id,
                  loadNumber: l + 1,
                  startTime: addMinutes(startDateTime, loadStart),
                  endTime: addMinutes(startDateTime, loadStart + Math.min(interval, params.unloadTime)),
                  status: 'unloading'
              });
          }
          pump.availableTime = finishAtSite;
          pump.coords = { lat: work.lat, lng: work.lng };
      }
  }

  return buildResult(works, branchCoords, schedule);
}

// ==========================================
// SIMULATOR LOGIC (Hybrid: Manual + Auto)
// ==========================================
function runSimulator(works: WorkSite[], branchCoords: {lat: number, lng: number}, params: SimulationParams): OptimizationResult {
    const schedule: ScheduleItem[] = [];
    
    // CONSTRUCT BASE DATE (00:00 of Selected Day)
    const [year, month, day] = params.startDate.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day, 0, 0, 0, 0);

    const globalStartTimeMin = getMinutesFromMidnight(params.startTime);

    // Initialize Pumps State (All pumps, even unused ones)
    const pumpsState = Array.from({ length: params.totalPumps }).map((_, i) => ({
        id: i + 1,
        availableTime: globalStartTimeMin, // Starts at global start time (minutes from midnight)
        coords: { ...branchCoords },
        trucks: 4 // Default trucks for auto-allocated works
    }));

    // Split works into Manual (Locked) and Auto (Unlocked)
    const manualIndices: number[] = [];
    const autoIndices: number[] = [];
    
    works.forEach((_, idx) => {
        const constraint = params.manualConstraints[idx];
        if (constraint && constraint.locked) {
            manualIndices.push(idx);
        } else {
            autoIndices.push(idx);
        }
    });

    // --- PHASE 1: Process Manual/Locked Works ---
    // Sort by user's forced time to ensure timeline order
    manualIndices.sort((a, b) => {
        const timeA = getMinutesFromMidnight(params.manualConstraints[a].forcedStartTime);
        const timeB = getMinutesFromMidnight(params.manualConstraints[b].forcedStartTime);
        return timeA - timeB;
    });

    for (const workIdx of manualIndices) {
        const work = works[workIdx];
        const constraint = params.manualConstraints[workIdx];
        
        const pumpId = constraint.forcedPumpId; 
        const trucks = Math.max(1, constraint.forcedTrucks); // Ensure at least 1 truck
        const desiredStart = getMinutesFromMidnight(constraint.forcedStartTime);

        // Find pump state (pumpId is 1-based)
        const pumpState = pumpsState[pumpId - 1] || pumpsState[0];

        // Travel Logic
        const travelTime = getSimulatedTravelTime(pumpState.coords, work);
        
        // Available after previous job?
        const readyToTravel = pumpState.availableTime; 
        
        // Arrival: Must be at least ready + travel, AND at least user's desired start
        let arrivalTime = readyToTravel + travelTime;
        if (arrivalTime < desiredStart) {
            arrivalTime = desiredStart;
        }

        const cycleTime = params.loadTime + (2 * travelTime) + params.unloadTime;
        const durationMin = (cycleTime * work.loads) / trucks;
        const finishAtSite = arrivalTime + durationMin;

        // Generate Schedule
        const interval = durationMin / work.loads;
        const pumpTruckIds = Array.from({length: trucks}, (_, t) => `Bomba ${pumpId}-T${t+1}`);

        for (let l = 0; l < work.loads; l++) {
            const loadStart = arrivalTime + (l * interval);
            schedule.push({
                id: `${work.id}-L${l+1}`,
                workId: work.id,
                truckId: pumpTruckIds[l % trucks],
                pumpId: `Bomba ${pumpId}`,
                loadNumber: l + 1,
                startTime: addMinutes(baseDate, loadStart),
                endTime: addMinutes(baseDate, loadStart + Math.min(interval, params.unloadTime)),
                status: 'unloading'
            });
        }

        // Update Pump
        pumpState.availableTime = finishAtSite;
        pumpState.coords = { lat: work.lat, lng: work.lng };
    }

    // --- PHASE 2: Process Auto/Unlocked Works ---
    const autoWorks = autoIndices.map(i => works[i]).sort((a, b) => b.loads - a.loads);

    for (const work of autoWorks) {
        pumpsState.sort((a, b) => a.availableTime - b.availableTime);
        const bestPump = pumpsState[0];

        const travelTime = getSimulatedTravelTime(bestPump.coords, work);
        const arrivalTime = bestPump.availableTime + travelTime;
        
        const trucks = 4; // Default standard for auto

        const cycleTime = params.loadTime + (2 * travelTime) + params.unloadTime;
        const durationMin = (cycleTime * work.loads) / trucks;
        const finishAtSite = arrivalTime + durationMin;

        const interval = durationMin / work.loads;
        const pumpTruckIds = Array.from({length: trucks}, (_, t) => `Bomba ${bestPump.id}-T${t+1}`);

        for (let l = 0; l < work.loads; l++) {
            const loadStart = arrivalTime + (l * interval);
            schedule.push({
                id: `${work.id}-L${l+1}`,
                workId: work.id,
                truckId: pumpTruckIds[l % trucks],
                pumpId: `Bomba ${bestPump.id}`,
                loadNumber: l + 1,
                startTime: addMinutes(baseDate, loadStart),
                endTime: addMinutes(baseDate, loadStart + Math.min(interval, params.unloadTime)),
                status: 'unloading'
            });
        }

        bestPump.availableTime = finishAtSite;
        bestPump.coords = { lat: work.lat, lng: work.lng };
    }

    return buildResult(works, branchCoords, schedule);
}

function buildResult(works: WorkSite[], branchCoords: {lat: number, lng: number}, schedule: ScheduleItem[]): OptimizationResult {
    const allEndTimes = schedule.map(s => s.endTime.getTime());
    const maxTime = allEndTimes.length > 0 ? new Date(Math.max(...allEndTimes)) : new Date();
    
    // Formatting completion time with Date for clarity in summary
    return {
      works,
      branchLocation: branchCoords,
      schedule: schedule.sort((a,b) => a.startTime.getTime() - b.startTime.getTime()),
      summary: {
        totalTrips: schedule.length,
        completionTime: maxTime.toLocaleString([], { day:'2-digit', month:'2-digit', hour: '2-digit', minute: '2-digit' }),
        efficiency: 94.5 // Mock efficiency
      }
    };
}
