
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { OptimizationResult } from '../types';
import L from 'leaflet';
import { Map as MapIcon, Truck } from 'lucide-react';

interface MapTabProps {
  data: OptimizationResult;
}

const MARKER_COLORS = [ '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316' ];

const createCustomIcon = (label: string | number, color: string, isSquare = false) => {
  return L.divIcon({
    className: 'custom-marker-container',
    html: `
      <div class="${isSquare ? 'rounded-md' : 'rounded-full'} border-2 border-white text-white flex items-center justify-center font-bold shadow-lg text-sm relative z-10" 
           style="background-color: ${color}; width: 32px; height: 32px;">
        ${label}
      </div>
      ${!isSquare ? `<div class="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px]" style="border-t-color: ${color}; opacity: 0.8;"></div>` : ''}
    `,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36]
  });
};

const MapBounds: React.FC<{ works: any[]; branch: { lat: number, lng: number } }> = ({ works, branch }) => {
    const map = useMap();
    useEffect(() => {
        if (works.length > 0) {
            const points = works.map(w => [w.lat, w.lng] as [number, number]);
            if (branch) points.push([branch.lat, branch.lng]);
            const bounds = L.latLngBounds(points);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [works, branch, map]);
    return null;
};

export const MapTab: React.FC<MapTabProps> = ({ data }) => {
    if (data.works.length === 0) return <div className="p-10 text-center text-slate-500">No data available.</div>;
    const branchCoords: [number, number] = data.branchLocation ? [data.branchLocation.lat, data.branchLocation.lng] : [-26.89, -48.65];

    return (
        <div className="h-full flex flex-col relative">
            <style>{`.leaflet-div-icon { background: transparent !important; border: none !important; }`}</style>
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
                <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                    <MapIcon className="text-indigo-600" size={20} /> Route Overview
                </h2>
            </div>
            <div className="flex-1 relative z-0">
                <MapContainer center={branchCoords} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer attribution='&copy; OSM' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapBounds works={data.works} branch={data.branchLocation || {lat: branchCoords[0], lng: branchCoords[1]}} />
                    <Marker position={branchCoords} icon={createCustomIcon('DP', '#1e293b', true)} />
                    {data.works.map((work, idx) => {
                        const workItems = data.schedule.filter(s => s.workId === work.id);
                        const sorted = workItems.sort((a,b) => a.startTime.getTime() - b.startTime.getTime());
                        const hasItems = sorted.length > 0;
                        const pump = hasItems ? sorted[0].pumpId : 'N/A';
                        const markerColor = MARKER_COLORS[idx % MARKER_COLORS.length];
                        const trucks = work.trucksAssigned || 0;

                        return (
                            <React.Fragment key={work.id}>
                                <Polyline positions={[branchCoords, [work.lat, work.lng]]} pathOptions={{ color: markerColor, weight: 2, opacity: 0.6 }} />
                                <Marker position={[work.lat, work.lng]} icon={createCustomIcon(idx + 1, markerColor)}>
                                    <Popup className="min-w-[200px]">
                                        <div className="p-1">
                                            <div className="flex items-center gap-2 mb-2 border-b border-slate-100 pb-2">
                                                <div className="w-6 h-6 rounded-full text-white flex items-center justify-center font-bold text-xs" style={{backgroundColor: markerColor}}>{idx + 1}</div>
                                                <h3 className="font-bold text-slate-800 text-sm">{work.name}</h3>
                                            </div>
                                            <div className="space-y-1 text-xs text-slate-600">
                                                <div className="flex justify-between items-center bg-blue-50 p-1.5 rounded mb-1">
                                                    <span className="flex items-center gap-1 font-semibold"><Truck size={12}/> Alocados:</span>
                                                    <span className="font-bold text-blue-700 text-sm">{trucks} Caminhões</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Bomba:</span> <span className="font-bold text-indigo-600">{pump}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Cargas:</span> <span className="font-bold">{work.loads}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>Volume:</span> <span className="font-bold">{work.volume} m³</span>
                                                </div>
                                                <div className="pt-2 mt-1 text-[10px] text-slate-400 border-t border-slate-100 italic">{work.address}</div>
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
