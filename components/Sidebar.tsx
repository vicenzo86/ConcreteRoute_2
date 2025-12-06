import React, { useRef } from 'react';
import { SimulationParams, UploadedWork } from '../types';
import { Settings, Play, Truck, Activity, FileSpreadsheet, Upload } from 'lucide-react';
// @ts-ignore - Importing from CDN via importmap
import readXlsxFile from 'read-excel-file';

interface SidebarProps {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  onRun: () => void;
  isRunning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ params, setParams, onRun, isRunning }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (field: keyof SimulationParams, value: any) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const processParsedData = (data: UploadedWork[]) => {
      if (data.length > 0) {
         setParams(prev => ({ ...prev, uploadedData: data }));
         alert(`Successfully imported ${data.length} works!`);
      } else {
         alert('Could not parse file. Please ensure format includes VOLUME and ADDRESS columns.');
      }
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Handle Excel (.xlsx)
    if (file.name.endsWith('.xlsx')) {
        try {
            const rows = await readXlsxFile(file);
            const parsedData: UploadedWork[] = [];
            
            // Skip header (row 0)
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                let volume = 0;
                let address = '';

                // Strategy: Find number for volume, string for address
                // We check the first few columns usually
                
                // Helper to check if a cell is likely volume
                const isVol = (val: any) => typeof val === 'number' && val > 0 && val < 10000;
                
                if (isVol(row[0])) {
                    volume = row[0] as number;
                    // Address might be next
                    if (typeof row[1] === 'string') address = row[1] as string;
                } else if (isVol(row[1])) {
                    // Maybe Address first?
                    if (typeof row[0] === 'string') address = row[0] as string;
                    volume = row[1] as number;
                }

                // Fallback for address if it's spread or different
                if (!address) {
                    const stringParts = row.filter((c: any) => typeof c === 'string');
                    if (stringParts.length > 0) address = stringParts.join(' ');
                }

                if (volume > 0 && address) {
                    parsedData.push({ volume, address });
                }
            }
            processParsedData(parsedData);

        } catch (error) {
            console.error(error);
            alert('Error reading Excel file. Please ensure it is a valid .xlsx file.');
        }
        return;
    }

    // Handle CSV/Text
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n');
      const parsedData: UploadedWork[] = [];
      
      // Simple parser for CSV or Tab-Separated Values (TSV)
      lines.forEach((line, idx) => {
         if (!line.trim()) return;
         
         // Detect separator
         const separator = line.includes('\t') ? '\t' : (line.includes(';') ? ';' : ',');
         const cols = line.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
         
         // Heuristic: Skip header row
         if (idx === 0) {
             const headerStr = cols.join(' ').toLowerCase();
             if (headerStr.includes('volume') || headerStr.includes('endereco')) {
                 return;
             }
         }

         let volume = 0;
         let address = '';

         // Check if first col is number (Volume)
         if (!isNaN(parseFloat(cols[0])) && cols[0].length < 10) {
             volume = parseFloat(cols[0]);
             address = cols.slice(1).join(' '); // Join rest as address
         } else if (!isNaN(parseFloat(cols[cols.length - 1])) && cols[cols.length - 1].length < 10) {
             // Maybe last col is volume
             volume = parseFloat(cols[cols.length - 1]);
             address = cols.slice(0, cols.length - 1).join(' ');
         } else {
             if (cols[0]) volume = parseFloat(cols[0]);
             if (cols[1]) address = cols[1];
         }

         if (address && !isNaN(volume) && volume > 0) {
            parsedData.push({ volume, address });
         }
      });
      processParsedData(parsedData);
    };
    reader.readAsText(file);
  };

  return (
    <div className="w-80 bg-slate-900 text-white flex flex-col h-full border-r border-slate-700 shadow-xl z-20 overflow-y-auto">
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Truck className="text-yellow-500" />
          Concrete Router
        </h1>
        <p className="text-xs text-slate-400 mt-1">Intelligent Routing System</p>
      </div>

      <div className="p-6 space-y-6 flex-1">
        
        {/* API Settings */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Configuration</h2>
          <div className="space-y-1">
            <label className="text-sm text-slate-300">HERE API Key</label>
            <input 
              type="password" 
              value={params.apiKey}
              onChange={(e) => handleChange('apiKey', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Branch Address</label>
            <input 
              type="text" 
              value={params.branchAddress}
              onChange={(e) => handleChange('branchAddress', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500 transition-colors"
            />
          </div>
        </div>

        {/* Data Import */}
        <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <FileSpreadsheet size={12} /> Import Data
            </h2>
            <div className="p-3 bg-slate-800 rounded border border-slate-700 border-dashed hover:border-slate-500 transition-colors">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".csv,.txt,.tsv,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                />
                <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
                    <Upload className="text-slate-400 mb-2" size={20} />
                    <span className="text-xs text-slate-300 font-medium">Upload Spreadsheet</span>
                    <span className="text-[10px] text-slate-500 mt-1">Supports .xlsx, .csv (Cols: Volume, Address)</span>
                </label>
            </div>
            {params.uploadedData && params.uploadedData.length > 0 && (
                <div className="text-xs text-emerald-400 flex items-center gap-1">
                    ✓ {params.uploadedData.length} works loaded
                </div>
            )}
        </div>

        {/* Operational Params */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Operations</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Load Time (min)</label>
              <input 
                type="number" 
                value={params.loadTime}
                onChange={(e) => handleChange('loadTime', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Unload Time (min)</label>
              <input 
                type="number" 
                value={params.unloadTime}
                onChange={(e) => handleChange('unloadTime', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Total Trucks</label>
              <input 
                type="number" 
                value={params.totalTrucks}
                onChange={(e) => handleChange('totalTrucks', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300">Total Pumps</label>
              <input 
                type="number" 
                value={params.totalPumps}
                onChange={(e) => handleChange('totalPumps', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300">Start Time</label>
            <input 
              type="time" 
              value={params.startTime}
              onChange={(e) => handleChange('startTime', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
            />
          </div>
        </div>

        {/* GA Settings */}
        <div className="space-y-3 pt-2 border-t border-slate-700">
           <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1">
             <Activity size={12} /> Genetic Algo Params
           </h2>
           <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-xs text-slate-300">Generations</label>
                <input 
                  type="number" 
                  value={params.generations}
                  onChange={(e) => handleChange('generations', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                />
             </div>
             <div className="space-y-1">
                <label className="text-xs text-slate-300">Pop Size</label>
                <input 
                  type="number" 
                  value={params.popSize}
                  onChange={(e) => handleChange('popSize', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-yellow-500"
                />
             </div>
           </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`w-full py-3 px-4 rounded font-bold shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
            isRunning 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-slate-900'
          }`}
        >
          {isRunning ? (
            <>
              <Settings className="animate-spin" size={18} />
              Optimizing...
            </>
          ) : (
            <>
              <Play size={18} />
              Run Optimization
            </>
          )}
        </button>

      </div>
    </div>
  );
};
