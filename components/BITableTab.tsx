
import React from 'react';
import { OptimizationResult } from '../types';
import { Table, Download, Filter, Truck, Info } from 'lucide-react';

declare const XLSX: any;

interface BITableTabProps {
  data: OptimizationResult;
}

export const BITableTab: React.FC<BITableTabProps> = ({ data }) => {
  if (data.works.length === 0) return <div className="p-10 text-center text-slate-500">No data available. Run simulation first.</div>;

  const rows = data.works.map(work => {
    const workItems = data.schedule.filter(s => s.workId === work.id);
    if (workItems.length === 0) return null;

    const sortedItems = [...workItems].sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    const startTime = sortedItems[0].startTime;
    const endTime = sortedItems[sortedItems.length - 1].endTime;
    const pumpId = sortedItems[0].pumpId;
    const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    return {
      workId: work.id,
      name: work.name,
      address: work.address,
      startTime,
      endTime,
      durationMin,
      pumpId,
      loads: work.loads,
      volume: work.volume,
      trucks: work.trucksAssigned || 0
    };
  }).filter(Boolean);

  const handleExport = () => {
    if (typeof XLSX === 'undefined') {
        alert("Export library not loaded.");
        return;
    }
    const worksData = data.works.map(w => ({
        ID: w.id, Name: w.name, Address: w.address, Loads: w.loads, Volume_m3: w.volume, Trucks: w.trucksAssigned
    }));
    const timelineData = data.schedule.map(s => ({
        WorkID: s.workId, TruckID: s.truckId, PumpID: s.pumpId, LoadNum: s.loadNumber, 
        StartTime: s.startTime.toLocaleString(), EndTime: s.endTime.toLocaleString()
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(worksData), "Dados_Obras");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timelineData), "Linha_do_Tempo");
    XLSX.writeFile(wb, `Concrete_Plan_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Table className="text-emerald-600" /> Performance Dashboard
          </h2>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-md text-sm font-medium transition-colors">
          <Download size={16} /> Export Excel
        </button>
      </div>
      
      <div className="flex-1 overflow-auto p-6">
        <div className="mb-4 bg-blue-50 border border-blue-200 p-3 rounded flex items-center gap-3 text-sm text-blue-700">
           <Info size={18} />
           <span>A coluna <strong>Frota</strong> indica o número exato de caminhões dedicados a cada bomba durante o atendimento da obra.</span>
        </div>

        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4">Work Name</th>
                <th className="p-4">Pump Slot</th>
                <th className="p-4 text-center">Start Time</th>
                <th className="p-4 text-center">End Time</th>
                <th className="p-4 text-center">Frota (Caminhões)</th>
                <th className="p-4 text-center">Cargas</th>
                <th className="p-4 text-right">Volume (m³)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 font-medium text-slate-800 border-l-4 border-transparent group-hover:border-emerald-500 transition-all">
                    {row?.name}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {row?.pumpId}
                    </span>
                  </td>
                  <td className="p-4 text-center text-slate-600 font-mono text-sm">
                    {row?.startTime.toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4 text-center text-slate-600 font-mono text-sm">
                    {row?.endTime.toLocaleString([], {day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
                      <Truck size={14} />
                      <span className="font-bold">{row?.trucks} Unidades</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-slate-100 text-slate-700">
                      {row?.loads}
                    </span>
                  </td>
                  <td className="p-4 text-right font-bold text-slate-800">
                    {row?.volume}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
