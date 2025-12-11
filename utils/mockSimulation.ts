
import { OptimizationResult, ScheduleItem, SimulationParams, WorkSite } from '../types';

// ==========================================
// HELPERS & CONFIG
// ==========================================

const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60000);

const getMinutesFromMidnight = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

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

function getSimulatedTravelTime(from: { lat: number, lng: number }, to: { lat: number, lng: number }) {
  const dist = getDistanceFromLatLonInKm(from.lat, from.lng, to.lat, to.lng);
  return 10 + (dist * 2.0); 
}

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
    } catch (e) { console.warn(`Geocoding failed for ${address}`, e); }
    return null;
}

const REALISTIC_POINTS = [
    { lat: -26.8826, lng: -48.6658 }, { lat: -26.8900, lng: -48.6800 },
    { lat: -26.8700, lng: -48.6550 }, { lat: -26.9100, lng: -48.6900 },
    { lat: -26.9050, lng: -48.6700 }, { lat: -26.8950, lng: -48.7000 },
    { lat: -26.8600, lng: -48.6500 }, { lat: -26.9200, lng: -48.6800 },
    { lat: -26.8850, lng: -48.6600 }, { lat: -26.9000, lng: -48.6650 },
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
  let branchCoords = { lat: -26.8955, lng: -48.6757 };
  const manualLat = parseFloat(params.branchLat);
  const manualLng = parseFloat(params.branchLng);
  if (!isNaN(manualLat) && !isNaN(manualLng)) {
      branchCoords = { lat: manualLat, lng: manualLng };
  } else if (params.apiKey && params.branchAddress && params.branchAddress.length > 5) {
      const found = await getGeocodeFromHere(params.branchAddress, params.apiKey);
      if (found) branchCoords = found;
  }

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
        trucksAssigned: 0 // Placeholder
      };
    }));
  } else {
    const count = params.mode === 'simulator' ? 5 : 15;
    rawWorks = Array.from({ length: count }).map((_, i) => {
      const coords = getFallbackCoords(i);
      const loads = Math.floor(Math.random() * 8) + 3;
      return {
        id: `W-${i + 1}`,
        name: `Obra Exemplo ${i + 1}`,
        address: `Navegantes, SC`,
        loads: loads,
        volume: loads * params.truckCapacity,
        lat: coords.lat,
        lng: coords.lng,
        trucksAssigned: 0 // Placeholder
      };
    });
  }

  if (params.mode === 'simulator') {
      return runSimulator(rawWorks, branchCoords, params);
  } else {
      return runOptimizer(rawWorks, branchCoords, params);
  }
};

function runOptimizer(works: WorkSite[], branchCoords: {lat: number, lng: number}, params: SimulationParams): OptimizationResult {
  // Trabalhamos com os objetos reais para mutação direta de trucksAssigned
  let pendingWorks = works.map(w => {
    const travelTime = getSimulatedTravelTime(branchCoords, w);
    const unitTime = params.loadTime + (2 * travelTime) + params.unloadTime;
    return { ...w, unitTimeEst: unitTime, totalTimeEst: unitTime * w.loads };
  }).sort((a, b) => b.totalTimeEst - a.totalTimeEst);

  const numPumps = params.totalPumps;
  const totalTrucks = params.totalTrucks;
  
  // Distribuição proporcional de frota por bomba
  const totalEstimatedTime = pendingWorks.reduce((acc, w) => acc + w.totalTimeEst, 0);
  const trucksPerPump: number[] = new Array(numPumps).fill(0);
  let remainingTrucks = totalTrucks;

  for (let i = 0; i < numPumps; i++) {
    const workloadShare = (pendingWorks[i]?.totalTimeEst || 0) / (totalEstimatedTime || 1);
    let assigned = Math.max(1, Math.floor(workloadShare * totalTrucks));
    trucksPerPump[i] = assigned;
    remainingTrucks -= assigned;
  }

  // Ajuste fino da frota
  let pIdx = 0;
  while (remainingTrucks > 0) { trucksPerPump[pIdx % numPumps]++; remainingTrucks--; pIdx++; }
  while (remainingTrucks < 0) { if (trucksPerPump[pIdx % numPumps] > 1) { trucksPerPump[pIdx % numPumps]--; remainingTrucks++; } pIdx++; }

  const pumps = trucksPerPump.map((count, i) => ({
    id: `Bomba ${i + 1}`,
    trucks: count,
    coords: { ...branchCoords },
    availableTime: 0, 
  }));

  const schedule: ScheduleItem[] = [];
  const [year, month, day] = params.startDate.split('-').map(Number);
  const [sh, sm] = params.startTime.split(':').map(Number);
  const startDateTime = new Date(year, month - 1, day, sh, sm, 0, 0);

  // Mapeamos os pendentes de volta para os objetos de 'works' para garantir que trucksAssigned apareça no BI
  const workMap = new Map(works.map(w => [w.id, w]));

  while (pendingWorks.length > 0) {
      pumps.sort((a, b) => a.availableTime - b.availableTime);
      const pump = pumps[0];
      const nextWorkData = pendingWorks.shift();
      if (!nextWorkData) break;
      
      const realWork = workMap.get(nextWorkData.id);
      if (!realWork) continue;

      const travelTime = getSimulatedTravelTime(pump.coords, realWork);
      const cycleTime = params.loadTime + (2 * travelTime) + params.unloadTime;
      const durationMin = (cycleTime * realWork.loads) / pump.trucks;
      
      const departTime = pump.availableTime;
      const arrivalAtSite = departTime + travelTime;
      const interval = durationMin / realWork.loads;

      // ATRIBUIÇÃO CRÍTICA PARA O BI E MAPA
      realWork.trucksAssigned = pump.trucks;

      for (let l = 0; l < realWork.loads; l++) {
          const loadStart = arrivalAtSite + (l * interval);
          schedule.push({
              id: `${realWork.id}-L${l+1}`,
              workId: realWork.id,
              truckId: `T${(l % pump.trucks) + 1}`,
              pumpId: pump.id,
              loadNumber: l + 1,
              startTime: addMinutes(startDateTime, loadStart),
              endTime: addMinutes(startDateTime, loadStart + params.unloadTime),
              status: 'unloading'
          });
      }
      pump.availableTime = arrivalAtSite + durationMin;
      pump.coords = { lat: realWork.lat, lng: realWork.lng };
  }
  return buildResult(works, branchCoords, schedule);
}

function runSimulator(works: WorkSite[], branchCoords: {lat: number, lng: number}, params: SimulationParams): OptimizationResult {
    const schedule: ScheduleItem[] = [];
    const [year, month, day] = params.startDate.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const globalStartTimeMin = getMinutesFromMidnight(params.startTime);

    let manualTrucksTotal = 0;
    const manualIndices: number[] = [];
    const autoIndices: number[] = [];
    
    works.forEach((_, idx) => {
        const constraint = params.manualConstraints[idx];
        if (constraint && constraint.locked) { 
            manualIndices.push(idx); 
            manualTrucksTotal += constraint.forcedTrucks;
        } else { autoIndices.push(idx); }
    });

    const remainingTrucks = Math.max(0, params.totalTrucks - manualTrucksTotal);
    const autoPumpCount = Math.max(1, params.totalPumps); 
    const trucksPerAutoPump = Math.max(1, Math.floor(remainingTrucks / autoPumpCount));

    const pumpsState = Array.from({ length: params.totalPumps }).map((_, i) => ({
        id: i + 1,
        availableTime: globalStartTimeMin,
        coords: { ...branchCoords },
        // Se a bomba está sendo usada por um manual, usamos o valor do manual, senão o calculado
        trucks: trucksPerAutoPump 
    }));

    // Obras Manuais
    for (const workIdx of manualIndices) {
        const work = works[workIdx];
        const constraint = params.manualConstraints[workIdx];
        const pumpId = constraint.forcedPumpId; 
        const trucks = Math.max(1, constraint.forcedTrucks);
        const desiredStart = getMinutesFromMidnight(constraint.forcedStartTime);
        const pumpState = pumpsState[pumpId - 1] || pumpsState[0];
        
        const travelTime = getSimulatedTravelTime(pumpState.coords, work);
        let arrivalTime = Math.max(pumpState.availableTime + travelTime, desiredStart);
        
        const cycleTime = params.loadTime + (2 * travelTime) + params.unloadTime;
        const durationMin = (cycleTime * work.loads) / trucks;
        const interval = durationMin / work.loads;

        // GRAVAÇÃO DO DADO PARA O DASHBOARD
        work.trucksAssigned = trucks;

        for (let l = 0; l < work.loads; l++) {
            const loadStart = arrivalTime + (l * interval);
            schedule.push({
                id: `${work.id}-L${l+1}`, workId: work.id, truckId: `T${(l % trucks) + 1}`,
                pumpId: `Bomba ${pumpId}`, loadNumber: l + 1,
                startTime: addMinutes(baseDate, loadStart),
                endTime: addMinutes(baseDate, loadStart + params.unloadTime),
                status: 'unloading'
            });
        }
        pumpState.availableTime = arrivalTime + durationMin;
        pumpState.coords = { lat: work.lat, lng: work.lng };
    }

    // Obras Automáticas
    const autoWorks = autoIndices.map(i => works[i]);
    for (const work of autoWorks) {
        pumpsState.sort((a, b) => a.availableTime - b.availableTime);
        const bestPump = pumpsState[0];
        const travelTime = getSimulatedTravelTime(bestPump.coords, work);
        const arrivalTime = bestPump.availableTime + travelTime;
        const trucks = bestPump.trucks; 
        const cycleTime = params.loadTime + (2 * travelTime) + params.unloadTime;
        const durationMin = (cycleTime * work.loads) / trucks;
        const interval = durationMin / work.loads;

        // GRAVAÇÃO DO DADO PARA O DASHBOARD
        work.trucksAssigned = trucks;

        for (let l = 0; l < work.loads; l++) {
            const loadStart = arrivalTime + (l * interval);
            schedule.push({
                id: `${work.id}-L${l+1}`, workId: work.id, truckId: `T${(l % trucks) + 1}`,
                pumpId: `Bomba ${bestPump.id}`, loadNumber: l + 1,
                startTime: addMinutes(baseDate, loadStart),
                endTime: addMinutes(baseDate, loadStart + params.unloadTime),
                status: 'unloading'
            });
        }
        bestPump.availableTime = arrivalTime + durationMin;
        bestPump.coords = { lat: work.lat, lng: work.lng };
    }
    return buildResult(works, branchCoords, schedule);
}

function buildResult(works: WorkSite[], branchCoords: {lat: number, lng: number}, schedule: ScheduleItem[]): OptimizationResult {
    const allEndTimes = schedule.map(s => s.endTime.getTime());
    const maxTime = allEndTimes.length > 0 ? new Date(Math.max(...allEndTimes)) : new Date();
    return {
      works: [...works], // Retornamos o array mutado com trucksAssigned
      branchLocation: branchCoords,
      schedule: schedule.sort((a,b) => a.startTime.getTime() - b.startTime.getTime()),
      summary: {
        totalTrips: schedule.length,
        completionTime: maxTime.toLocaleString([], { day:'2-digit', month:'2-digit', hour: '2-digit', minute: '2-digit' }),
        efficiency: 95
      }
    };
}
