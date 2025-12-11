
import React from 'react';
import { HistoryItem } from '../types';
import { History, Trash2, RotateCcw, Zap, Sliders, Calendar } from 'lucide-react';

interface HistoryTabProps {
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ history, onRestore, onDelete, onClear }) => {
  if (history.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400 p-10 bg-slate-50">
        <History size={64} className="mb-4 opacity-20" />
        <h3 className="text-xl font-medium">Histórico Vazio</h3>
        <p className="text-sm">Execute uma simulação para começar a salvar o histórico.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <div className="p-6 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <History className="text-blue-600" /> Histórico de Simulações
        </h2>
        <button 
          onClick={onClear}
          className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
        >
          <Trash2 size={14} /> Limpar Tudo
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-4">
        {history.sort((a, b) => b.timestamp - a.timestamp).map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center justify-between hover:border-blue-300 transition-all group">
            <div className="flex items-center gap-5">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.mode === 'optimizer' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}>
                {item.mode === 'optimizer' ? <Zap size={24} /> : <Sliders size={24} />}
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${item.mode === 'optimizer' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}>
                    {item.mode === 'optimizer' ? 'Otimizado' : 'Manual'}
                  </span>
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <Calendar size={12} /> {new Date(item.timestamp).toLocaleString()}
                  </span>
                </div>
                <h4 className="font-bold text-slate-800">
                  {item.result.summary.totalTrips} Viagens • Fim: {item.result.summary.completionTime}
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Frota: {item.params.totalTrucks} cam. | Bombas: {item.params.totalPumps} | Carga/Descarga: {item.params.loadTime}/{item.params.unloadTime}min
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => onRestore(item)}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-bold shadow-sm"
              >
                <RotateCcw size={14} /> Restaurar
              </button>
              <button 
                onClick={() => onDelete(item.id)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
