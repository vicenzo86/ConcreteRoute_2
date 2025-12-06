
import React, { useRef, useEffect } from 'react';
import { SimulationParams, UploadedWork, WorkConstraint } from '../types';
import { Settings, Play, Truck, Activity, FileSpreadsheet, Upload, Sliders, Calculator, Zap, Trash2, Lock, Unlock } from 'lucide-react';

// Declare global variable loaded via script tag in index.html
declare const readXlsxFile: any;

interface SidebarProps {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  onRun: () => void;
  isRunning: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ params, setParams, onRun, isRunning }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync manual constraints when uploaded data changes
  useEffect(() => {
    // If we have uploaded data, ensure the constraints array matches its length exactly
    if (params.uploadedData && params.uploadedData.length > 0) {
        setParams(prev => {
            const currentLen = prev.manualConstraints.length;
            const targetLen = (prev.uploadedData || []).length;
            
            // Only update if lengths differ to avoid infinite loops or resetting user edits on unrelated renders
            if (targetLen !== currentLen) {
                const newConstraints: WorkConstraint[] = (prev.uploadedData || []).map((_, idx) => ({
                    workIndex: idx,
                    forcedTrucks: 4, 
                    forcedPumpId: (idx % prev.totalPumps) + 1,
                    forcedStartTime: prev.startTime,
                    locked: false // Default to Auto
                }));
                return { ...prev, manualConstraints: newConstraints };
            }
            return prev;
        });
    } else if (params.manualConstraints.length === 0) {
        // Init default placeholders for Demo Mode if nothing exists
        const placeholders = Array.from({length: 5}).map((_, idx) => ({
            workIndex: idx,
            forcedTrucks: 4,
            forcedPumpId: idx + 1,
            forcedStartTime: params.startTime,
            locked: idx < 3 // Demo: Lock first 3, leave 2 Auto to show feature
        }));
        setParams(prev => ({ ...prev, manualConstraints: placeholders }));
    }
  }, [params.uploadedData, params.totalPumps, params.startTime, setParams]);

  const handleChange = (field: keyof SimulationParams, value: any) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const handleConstraintChange = (index: number, field: keyof WorkConstraint, value: any) => {
      setParams(prev => {
          const newConstraints = [...prev.manualConstraints];
          newConstraints[index] = { ...newConstraints[index], [field]: value };
          return { ...prev, manualConstraints: newConstraints };
      });
  };

  const toggleLock = (index: number) => {
      setParams(prev => {
          const newConstraints = [...prev.manualConstraints];
          newConstraints[index] = { ...newConstraints[index], locked: !newConstraints[index].locked };
          return { ...prev, manualConstraints: newConstraints };
      });
  };

  const processParsedData = (data: UploadedWork[]) => {
      if (data.length > 0) {
         // 1. Set the uploaded data
         // 2. Immediately reset manualConstraints to match this new data
         const newConstraints: WorkConstraint[] = data.map((_, idx) => ({
            workIndex: idx,
            forcedTrucks: 4,
            forcedPumpId: (idx % params.totalPumps) + 1,
            forcedStartTime: params.startTime,
            locked: false // Start as Auto
         }));

         setParams(prev => ({ 
             ...prev, 
             uploadedData: data,
             manualConstraints: newConstraints 
         }));
         
         alert(`Successfully imported ${data.length} works!`);
      } else {
         alert('Could not parse file. Please ensure format includes LOADS (Cargas) and ADDRESS columns.');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearData = () => {
      // Clear upload and reset to demo mode
      const placeholders = Array.from({length: 5}).map((_, idx) => ({
        workIndex: idx,
        forcedTrucks: 4,
        forcedPumpId: idx + 1,
        forcedStartTime: params.startTime,
        locked: idx < 3
      }));
      
      setParams(prev => ({ 
          ...prev, 
          uploadedData: undefined, 
          manualConstraints: placeholders 
      }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx')) {
        try {
            const rows = await readXlsxFile(file);
            const parsedData: UploadedWork[] = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;
                let loads = 0;
                let address = '';
                const isLoad = (val: any) => typeof val === 'number' && val > 0 && val < 500;
                
                if (isLoad(row[0])) {
                    loads = row[0] as number;
                    if (typeof row[1] === 'string') address = row[1] as string;
                } else if (isLoad(row[1])) {
                    if (typeof row[0] === 'string') address = row[0] as string;
                    loads = row[1] as number;
                }
                if (!address) {
                    const stringParts = row.filter((c: any) => typeof c === 'string');
                    if (stringParts.length > 0) address = stringParts.join(' ');
                }
                if (loads > 0 && address) parsedData.push({ loads, address });
            }
            processParsedData(parsedData);
        } catch (error) {
            console.error(error);
            alert('Error reading Excel file.');
        }
        return;
    }
  };

  const isUsingUploadedData = params.uploadedData && params.uploadedData.length > 0;

  return (
    <div className="w-80 bg-slate-900 text-white flex flex-col h-full border-r border-slate-700 shadow-xl z-20 overflow-hidden">
      <div className="p-5 border-b border-slate-700 bg-slate-900 z-20">
        <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Truck className="text-yellow-500" />
          Concrete Router
        </h1>
        
        {/* MODE TOGGLE SWITCH */}
        <div className="bg-slate-800 p-1 rounded-lg flex relative">
            <button 
                onClick={() => handleChange('mode', 'optimizer')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all z-10 ${params.mode === 'optimizer' ? 'text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
                <Zap size={14} /> Auto
            </button>
            <button 
                onClick={() => handleChange('mode', 'simulator')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all z-10 ${params.mode === 'simulator' ? 'text-slate-900' : 'text-slate-400 hover:text-white'}`}
            >
                <Sliders size={14} /> Sim
            </button>
            <div className={`absolute top-1 bottom-1 w-1/2 bg-yellow-500 rounded shadow transition-all duration-300 ${params.mode === 'simulator' ? 'translate-x-full' : 'translate-x-0'}`}></div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* SIMULATOR: Work Configuration */}
        {params.mode === 'simulator' && (
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-semibold uppercase text-yellow-500 tracking-wider flex items-center gap-1">
                        <Calculator size={12} /> 
                        {isUsingUploadedData ? 'Project List' : 'Demo Data List'}
                    </h2>
                    {isUsingUploadedData && (
                        <button onClick={clearData} className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1">
                            <Trash2 size={10} /> Reset
                        </button>
                    )}
                </div>

                <div className="bg-slate-800 rounded border border-slate-700 p-1 space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
                    {params.manualConstraints.map((constraint, idx) => {
                        const workData = params.uploadedData && params.uploadedData[idx];
                        const displayName = workData 
                            ? `${workData.address.substring(0, 20)}${workData.address.length > 20 ? '...' : ''}` 
                            : `Demo Work ${idx + 1}`;
                        
                        return (
                            <div key={idx} className={`p-2 rounded border text-xs transition-colors ${constraint.locked ? 'bg-slate-900 border-yellow-500/50' : 'bg-slate-800/50 border-slate-700'}`}>
                                <div className="flex justify-between items-center mb-2">
                                    <div className={`font-bold truncate w-3/4 ${constraint.locked ? 'text-yellow-400' : 'text-slate-400'}`} title={workData?.address || "Demo"}>
                                        {displayName}
                                    </div>
                                    <button 
                                      onClick={() => toggleLock(idx)}
                                      className={`p-1 rounded hover:bg-slate-700 ${constraint.locked ? 'text-yellow-500' : 'text-slate-600'}`}
                                      title={constraint.locked ? "Manual Mode (Locked)" : "Auto Mode"}
                                    >
                                        {constraint.locked ? <Lock size={14} /> : <Unlock size={14} />}
                                    </button>
                                </div>
                                
                                {constraint.locked ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-0.5">Trucks</label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                value={constraint.forcedTrucks}
                                                onChange={(e) => handleConstraintChange(idx, 'forcedTrucks', Number(e.target.value))}
                                                className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-1 text-center text-white focus:border-yellow-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-0.5">Pump</label>
                                            <input 
                                                type="number" 
                                                min="1"
                                                max={params.totalPumps}
                                                value={constraint.forcedPumpId}
                                                onChange={(e) => handleConstraintChange(idx, 'forcedPumpId', Number(e.target.value))}
                                                className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-1 text-center text-white focus:border-yellow-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 block mb-0.5">Start</label>
                                            <input 
                                                type="time" 
                                                value={constraint.forcedStartTime}
                                                onChange={(e) => handleConstraintChange(idx, 'forcedStartTime', e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-600 rounded px-1 py-1 text-center text-white focus:border-yellow-500 outline-none p-0"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center py-1 bg-slate-800/50 rounded border border-dashed border-slate-700 text-slate-500 text-[10px] gap-2">
                                        <Zap size={10} /> Auto-Allocation
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="p-2 bg-blue-900/20 border border-blue-500/20 rounded text-[10px] text-blue-200/80 italic text-center">
                    <span className="font-bold">Tip:</span> Lock specific works to set their pump & time. Unlocked works will be automatically assigned to the remaining pumps.
                </div>
            </div>
        )}

        {/* API Settings - Collapsible or Compact */}
        <div className="space-y-3 border-t border-slate-800 pt-3">
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
          
          {/* Branch Details */}
          <div className="space-y-2">
             {/* ... (Kept compact for brevity in mind, but code below includes full logic) ... */}
            <div className="space-y-1">
                <label className="text-xs text-slate-400">Branch Address</label>
                <input 
                  type="text" 
                  value={params.branchAddress}
                  onChange={(e) => handleChange('branchAddress', e.target.value)}
                  placeholder="Street, City..."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs focus:outline-none focus:border-yellow-500"
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                 <input 
                   type="text" 
                   placeholder="Lat"
                   value={params.branchLat}
                   onChange={(e) => handleChange('branchLat', e.target.value)}
                   className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                 />
                 <input 
                   type="text" 
                   placeholder="Lng"
                   value={params.branchLng}
                   onChange={(e) => handleChange('branchLng', e.target.value)}
                   className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                 />
            </div>
          </div>
        </div>

        {/* Data Import */}
        <div className="space-y-3 border-t border-slate-800 pt-3">
            <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-1">
                <FileSpreadsheet size={12} /> Import Data
            </h2>
            <div className="p-3 bg-slate-800 rounded border border-slate-700 border-dashed hover:border-slate-500 transition-colors group">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".csv,.txt,.tsv,.xlsx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                />
                <label htmlFor="file-upload" className="flex flex-col items-center cursor-pointer">
                    <Upload className="text-slate-400 mb-2 group-hover:text-white transition-colors" size={20} />
                    <span className="text-xs text-slate-300 font-medium">Upload Excel</span>
                    <span className="text-[10px] text-slate-500 mt-1">Columns: Loads, Address</span>
                </label>
            </div>
        </div>

        {/* Global Operational Params (Always visible but subordinated in Sim mode) */}
        <div className="space-y-3 border-t border-slate-800 pt-3">
          <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Global Settings</h2>
          
          {/* Resources */}
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Total Pumps</label>
                <input 
                    type="number"
                    min="1"
                    value={params.totalPumps}
                    onChange={(e) => handleChange('totalPumps', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-yellow-500 outline-none"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Total Trucks</label>
                <input 
                    type="number"
                    min="1"
                    value={params.totalTrucks}
                    onChange={(e) => handleChange('totalTrucks', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-yellow-500 outline-none"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Capacity (m³)</label>
                <input 
                    type="number"
                    min="1"
                    value={params.truckCapacity}
                    onChange={(e) => handleChange('truckCapacity', Number(e.target.value))}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-yellow-500 outline-none"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Load (min)</label>
              <input 
                type="number" 
                value={params.loadTime}
                onChange={(e) => handleChange('loadTime', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-yellow-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400">Unload (min)</label>
              <input 
                type="number" 
                value={params.unloadTime}
                onChange={(e) => handleChange('unloadTime', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-yellow-500 outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1">
                <label className="text-[10px] text-slate-400">Start Time</label>
                <input 
                    type="time" 
                    value={params.startTime}
                    onChange={(e) => handleChange('startTime', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-yellow-500 outline-none"
                />
             </div>
             {params.mode === 'optimizer' && (
                <div className="space-y-1">
                    <label className="text-[10px] text-slate-400">Generations</label>
                    <input 
                        type="number" 
                        value={params.generations}
                        onChange={(e) => handleChange('generations', Number(e.target.value))}
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-yellow-500 outline-none"
                    />
                </div>
             )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onRun}
          disabled={isRunning}
          className={`w-full py-3 px-4 rounded font-bold shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 mt-auto ${
            isRunning 
              ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-slate-900'
          }`}
        >
          {isRunning ? (
            <>
              <Settings className="animate-spin" size={18} />
              Running...
            </>
          ) : (
            <>
              <Play size={18} />
              {params.mode === 'simulator' ? 'Simulate Plan' : 'Optimize Routes'}
            </>
          )}
        </button>

      </div>
    </div>
  );
};
