import { OptimizationResult, ScheduleItem, SimulationParams, WorkSite } from '../types';

// ==========================================
// HELPERS & CONFIG
// ==========================================

// Central Navegantes/Itajaí Coords (Usina Reference)
const BRANCH_COORDS = { lat: -26.8955, lng: -48.6757 }; 

// Helper to add minutes to a date
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

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

// Realistic points around Navegantes/Itajai/Penha
const REALISTIC_POINTS = [
    { lat: -26.890, lng: -48.650 }, // Gravatá
    { lat: -26.880, lng: -48.670 }, // Centro Nav
    { lat: -26.905, lng: -48.660 }, // Meia Praia
    { lat: -26.910, lng: -48.680 }, // Escalvados
    { lat: -26.860, lng: -48.640 }, // Aeroporto area
    { lat: -26.900, lng: -48.700 }, // Interior
    { lat: -26.885, lng: -48.630 }, // Beach front
    { lat: -26.895, lng: -48.690 }, // Rural
    { lat: -26.914, lng: -48.634 }, // Penha armação
    { lat: -26.872, lng: -48.697 }, // Machados
];

function getCoordsFromAddress(address: string, index: number) {
  // Use index to pick a realistic base point to simulate geocoding
  const base = REALISTIC_POINTS[index % REALISTIC_POINTS.length];
  // Small random jitter to prevent overlap
  const jitterLat = (Math.random() - 0.5) * 0.005;
  const jitterLng = (Math.random() - 0.5) * 0.005;
  
  return {
    lat: base.lat + jitterLat,
    lng: base.lng + jitterLng
  };
}

// ==========================================
// MAIN LOGIC
// ==========================================

export const generateMockData = (params: SimulationParams): OptimizationResult => {
  
  // 1. PREPARE WORKS DATA & INITIAL ESTIMATES
  // ------------------------------------------------------------
  let rawWorks: WorkSite[] = [];
  
  if (params.uploadedData && params.uploadedData.length > 0) {
    rawWorks = params.uploadedData.map((item, i) => {
      const coords = getCoordsFromAddress(item.address, i);
      const loads = item.loads; // Input is loads
      const volume = loads * 10; // 10m3 per truck rule
      return {
        id: `W-${i + 1}`,
        name: `Obra ${i + 1}`,
        address: item.address,
        volume: volume,
        loads: loads > 0 ? loads : 1,
        lat: coords.lat,
        lng: coords.lng,
      };
    });
  } else {
    rawWorks = Array.from({ length: 15 }).map((_, i) => {
      const coords = getCoordsFromAddress("Random", i);
      const loads = Math.floor(Math.random() * 8) + 3;
      return {
        id: `W-${i + 1}`,
        name: `Residencial ${i + 1}`,
        address: `Rua Exemplo ${i * 100}, Navegantes - SC`,
        loads: loads,
        volume: loads * 10,
        lat: coords.lat,
        lng: coords.lng,
      };
    });
  }

  // Calculate Initial Estimates (Travel from Branch) for Priority Sorting
  // Python: obras = sorted(obras, key=lambda x: x["Tempo_total_est"], reverse=True)
  let pendingWorks = rawWorks.map(w => {
    const travelTime = getSimulatedTravelTime(BRANCH_COORDS, w);
    const unitTime = params.loadTime + (2 * travelTime) + params.unloadTime;
    const totalTime = unitTime * w.loads;
    return { 
        ...w, 
        travelTimeFromBranch: travelTime,
        unitTimeEst: unitTime, 
        totalTimeEst: totalTime 
    };
  }).sort((a, b) => b.totalTimeEst - a.totalTimeEst);

  // Keep a clean copy for result result
  const worksResult = [...pendingWorks];

  // 2. ALLOCATE TRUCKS TO PUMPS (STRICT PYTHON LOGIC)
  // ------------------------------------------------------------
  const numPumps = params.totalPumps;
  const totalTrucks = params.totalTrucks;
  
  // Python: top_n = min(num_bombas, len(obras))
  // Python: soma_tempos = sum(obras[i]["Tempo_total_est"] for i in range(top_n))
  const topN = Math.min(numPumps, pendingWorks.length);
  const sumTopTimes = pendingWorks.slice(0, topN).reduce((sum, w) => sum + w.totalTimeEst, 0);
  
  // Initialize trucks per pump
  const trucksPerPump: number[] = [];
  
  for (let i = 0; i < numPumps; i++) {
    if (i < topN) {
       // Python: percentual = obras[i]["Tempo_total_est"] / soma_tempos
       // Python: assigned = int(round(percentual * total_caminhoes))
       const percent = sumTopTimes > 0 ? pendingWorks[i].totalTimeEst / sumTopTimes : 0;
       let assigned = Math.round(percent * totalTrucks);
       if (assigned < 1) assigned = 1;
       trucksPerPump.push(assigned);
    } else {
       trucksPerPump.push(1);
    }
  }

  // Python: Adjust sum to match total_caminhoes
  let currentSum = trucksPerPump.reduce((a, b) => a + b, 0);
  let diff = totalTrucks - currentSum;
  let pIdx = 0;

  while (diff !== 0) {
      if (diff > 0) {
          trucksPerPump[pIdx % numPumps]++;
          diff--;
      } else {
          // Only remove if > 1
          if (trucksPerPump[pIdx % numPumps] > 1) {
              trucksPerPump[pIdx % numPumps]--;
              diff++;
          }
      }
      pIdx++;
  }

  // Create Pump Objects
  const pumps = trucksPerPump.map((count, i) => ({
    id: `Bomba ${i + 1}`,
    trucks: count,
    coords: { ...BRANCH_COORDS },
    availableTime: 0, // Minutes from start
  }));

  // 3. SIMULATION LOOP (STRICT PYTHON LOGIC)
  // ------------------------------------------------------------
  const schedule: ScheduleItem[] = [];
  const startDateTime = new Date();
  const [sh, sm] = params.startTime.split(':').map(Number);
  startDateTime.setHours(sh, sm, 0, 0);

  // Helper: Get pumps available at specific time
  const getFreePumps = (timeRef: number) => pumps.filter(p => p.availableTime <= timeRef + 0.01);

  while (pendingWorks.length > 0) {
      // Python: bombas.sort(key=lambda x: x["available"])
      pumps.sort((a, b) => a.availableTime - b.availableTime);
      const nextTime = pumps[0].availableTime;
      
      // Python: livres = [b for b in bombas if b["available"] <= next_time]
      let freePumps = getFreePumps(nextTime);

      // Edge case: if simulation math causes drift, jump to earliest available
      if (freePumps.length === 0) {
         const earliest = Math.min(...pumps.map(p => p.availableTime));
         freePumps = getFreePumps(earliest);
      }

      const m = freePumps.length;
      
      // Python: livres_sorted = sorted(livres, key=lambda x: x["caminhoes"], reverse=True)
      freePumps.sort((a, b) => b.trucks - a.trucks);

      // Python: obras_sel = select_next_obras...
      // Python logic sorts remaining works by (Tempo_unit_est * Cargas_restantes) DESC
      // Since 'pendingWorks' was only sorted initially, we should sort the *top M candidates* 
      // or re-sort the whole list to find true top priorities if priorities shift (e.g. dynamic).
      // The Python code `select_next_obras_for_available_bombs` sorts ALL pending works and takes top M.
      
      // We re-sort pendingWorks by Remaining Work Load (Approx Total Time)
      // Note: We use travel from branch as a proxy for "Tempo_unit_est" here to select targets,
      // because we don't know which pump will take which work yet.
      pendingWorks.sort((a, b) => (b.unitTimeEst * b.loads) - (a.unitTimeEst * a.loads));
      
      // Take top M works
      const selectedWorks = pendingWorks.splice(0, m);

      // Now pair 1:1 (Largest Pump -> Largest Work)
      for (let i = 0; i < selectedWorks.length; i++) {
          if (i >= freePumps.length) break; // Should not happen based on logic

          const pump = freePumps[i];
          const work = selectedWorks[i];

          // Python: ida = get_travel_time(b["coords"], obra["Coordenadas"])
          const travelTime = getSimulatedTravelTime(pump.coords, work);
          
          // Python: tempo_unit_real = tempo_carga + 2*ida + tempo_descarga
          const cycleTime = params.loadTime + (2 * travelTime) + params.unloadTime;
          const totalRealTime = cycleTime * work.loads;

          // Python: duracao_min = tempo_total_real / b["caminhoes"]
          const durationMin = totalRealTime / pump.trucks;

          // Python: inicio = max(b["available"], next_time) + timedelta(minutes=ida)
          const departTime = Math.max(pump.availableTime, nextTime);
          const arrivalAtSite = departTime + travelTime;
          const finishAtSite = arrivalAtSite + durationMin;

          // Generate Gantt Items (Individual Loads)
          const interval = durationMin / work.loads;
          const pumpTruckIds = Array.from({length: pump.trucks}, (_, t) => `${pump.id}-T${t+1}`);

          for (let l = 0; l < work.loads; l++) {
              const truckId = pumpTruckIds[l % pump.trucks];
              // Stagger start times
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

          // Update Pump State
          pump.availableTime = finishAtSite;
          pump.coords = { lat: work.lat, lng: work.lng };
      }
  }

  // 4. SUMMARY
  const allEndTimes = schedule.map(s => s.endTime.getTime());
  const maxTime = new Date(Math.max(...allEndTimes));
  
  return {
    works: worksResult,
    schedule: schedule.sort((a,b) => a.startTime.getTime() - b.startTime.getTime()),
    summary: {
      totalTrips: schedule.length,
      completionTime: maxTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      efficiency: 94.5
    }
  };
};