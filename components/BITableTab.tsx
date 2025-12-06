import React from 'react';
import { OptimizationResult } from '../types';
import { Table, Download, Filter } from 'lucide-react';

// Declare global XLSX from index.html script
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
      volume: work.volume
    };
  }).filter(Boolean);

  // --- EXPORT FUNCTION (Using SheetJS) ---
  const handleExport = () => {
    if (typeof XLSX === 'undefined') {
        alert("Export library (SheetJS) not loaded. Please refresh the page.");
        return;
    }

    // 1. Prepare Data for "Dados_Obras"
    const worksData = data.works.map(w => ({
        ID: w.id,
        Name: w.name,
        Address: w.address,
        Loads: w.loads,
        Volume_m3: w.volume,
        Lat: w.lat,
        Lng: w.lng
    }));

    // 2. Prepare Data for "Linha_do_Tempo"
    const timelineData = data.schedule.map(s => ({
        WorkID: s.workId,
        TruckID: s.truckId,
        PumpID: s.pumpId,
        LoadNum: s.loadNumber,
        StartTime: s.startTime.toLocaleString(),
        EndTime: s.endTime.toLocaleString(),
        Status: s.status
    }));

    // Create Workbook
    const wb = XLSX.utils.book_new();

    // Append "Dados_Obras"
    const wsWorks = XLSX.utils.json_to_sheet(worksData);
    XLSX.utils.book_append_sheet(wb, wsWorks, "Dados_Obras");

    // Append "Linha_do_Tempo"
    const wsTimeline = XLSX.utils.json_to_sheet(timelineData);
    XLSX.utils.book_append_sheet(wb, wsTimeline, "Linha_do_Tempo");

    // 3. Append per-pump sheets
    const pumps = Array.from(new Set(data.schedule.map(s => s.pumpId))).sort();
    pumps.forEach(pumpId => {
        const pumpItems = data.schedule
            .filter(s => s.pumpId === pumpId)
            .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
            .map(s => ({
                WorkID: s.workId,
                TruckID: s.truckId,
                LoadNum: s.loadNumber,
                StartTime: s.startTime.toLocaleTimeString(),
                EndTime: s.endTime.toLocaleTimeString()
            }));
        
        // Clean sheet name (max 31 chars)
        const sheetName = String(pumpId).replace(/[^a-zA-Z0-9 ]/g, "").substring(0, 31);
        const wsPump = XLSX.utils.json_to_sheet(pumpItems);
        XLSX.utils.book_append_sheet(wb, wsPump, sheetName);
    });

    // Write File
    XLSX.writeFile(wb, `Concrete_Plan_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Table className="text-emerald-600" />
            Performance Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">Detailed breakdown of operational metrics per work site.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 text-sm font-medium">
            <Filter size={16} /> Filter
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-md text-sm font-medium transition-colors">
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4">Work Name</th>
                <th className="p-4">Address</th>
                <th className="p-4">Assigned Pump</th>
                <th className="p-4 text-center">Start Time</th>
                <th className="p-4 text-center">End Time</th>
                <th className="p-4 text-right">Duration</th>
                <th className="p-4 text-center">Loads</th>
                <th className="p-4 text-right">Volume (m³)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-4 font-medium text-slate-800 border-l-4 border-transparent group-hover:border-emerald-500 transition-all">
                    {row?.name}
                  </td>
                  <td className="p-4 text-slate-500 text-sm max-w-xs truncate" title={row?.address}>
                    {row?.address}
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {row?.pumpId}
                    </span>
                  </td>
                  <td className="p-4 text-center text-slate-600 font-mono text-sm">
                    {row?.startTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4 text-center text-slate-600 font-mono text-sm">
                    {row?.endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </td>
                  <td className="p-4 text-right text-slate-600 text-sm">
                    {Math.floor(row?.durationMin || 0 / 60)}h {(row?.durationMin || 0) % 60}m
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
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={6} className="p-4 text-right font-bold text-slate-600 uppercase text-xs tracking-wider">Total Volume</td>
                <td colSpan={2} className="p-4 text-right font-bold text-emerald-600 text-lg">
                  {rows.reduce((sum, r) => sum + (r?.volume || 0), 0)} m³
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};