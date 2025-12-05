import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { OptimizationResult } from '../types';
import L from 'leaflet';
import { Map as MapIcon } from 'lucide-react';

// Fix for default Leaflet icons
const iconPerson = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconBranch = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/markers/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface MapTabProps {
  data: OptimizationResult;
}

// Component to auto-zoom to bounds
const MapBounds: React.FC<{ works: any[] }> = ({ works }) => {
    const map = useMap();
    
    useEffect(() => {
        if (works.length > 0) {
            const bounds = L.latLngBounds(works.map(w => [w.lat, w.lng]));
            // Add branch roughly
            bounds.extend([-26.89, -48.65]); 
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [works, map]);

    return null;
};

export const MapTab: React.FC<MapTabProps> = ({ data }) => {
    if (data.works.length === 0) return <div className="p-10 text-center text-slate-500">No data available. Run simulation first.</div>;

    const branchCoords: [number, number] = [-26.89, -48.65]; // Mock Branch Location

    return (
        <div className="h-full flex flex-col">
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <MapIcon className="text-indigo-600" size={20} />
                    Route Overview
                </h2>
                <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                        <span className="text-slate-600">Branch (Usina)</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
                        <span className="text-slate-600">Work Sites</span>
                    </div>
                </div>
            </div>
            
            <div className="flex-1 relative z-0">
                <MapContainer center={branchCoords} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    
                    <MapBounds works={data.works} />

                    {/* Branch Marker */}
                    <Marker position={branchCoords} icon={iconBranch}>
                        <Popup>
                            <div className="font-bold text-red-600">Central Branch</div>
                            <div className="text-xs">Navegantes - SC</div>
                        </Popup>
                    </Marker>

                    {/* Work Markers and Routes */}
                    {data.works.map((work) => {
                        const workItems = data.schedule.filter(s => s.workId === work.id);
                        if (workItems.length === 0) return null;
                        
                        const sorted = workItems.sort((a,b) => a.startTime.getTime() - b.startTime.getTime());
                        const start = sorted[0].startTime;
                        const end = sorted[sorted.length-1].endTime;
                        const pump = sorted[0].pumpId;

                        return (
                            <React.Fragment key={work.id}>
                                {/* Route Line (Straight line simulation) */}
                                <Polyline 
                                    positions={[branchCoords, [work.lat, work.lng]]} 
                                    pathOptions={{ color: '#6366f1', weight: 2, dashArray: '5, 10', opacity: 0.6 }} 
                                />

                                <Marker position={[work.lat, work.lng]} icon={iconPerson}>
                                    <Popup className="min-w-[200px]">
                                        <div className="p-1">
                                            <h3 className="font-bold text-slate-800 text-sm mb-1">{work.name}</h3>
                                            <div className="space-y-1 text-xs text-slate-600">
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span>Pump:</span>
                                                    <span className="font-bold text-indigo-600">{pump}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Start:</span>
                                                    <span>{start.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <div className="flex justify-between border-b border-slate-100 pb-1">
                                                    <span>End:</span>
                                                    <span>{end.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                </div>
                                                <div className="flex justify-between pt-1">
                                                    <span>Loads:</span>
                                                    <span className="font-bold">{work.loads}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Volume:</span>
                                                    <span className="font-bold">{work.volume} m³</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            </React.Fragment>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
};