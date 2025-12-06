
import React from 'react';
import { OptimizationResult } from '../types';
import { Clock, Hammer } from 'lucide-react';

interface GanttTabProps {
  data: OptimizationResult;
}

export const GanttTab: React.FC<GanttTabProps> = ({ data }) => {
  if (data.schedule.length === 0) return <div className="p-10 text-center text-slate-500">No data available. Run simulation first.</div>;

  // Process data for Chart
  const works = data.works;
  const startTime = data.schedule.reduce((min, i) => i.startTime < min ? i.startTime : min, data.schedule[0].startTime);
  const endTime = data.schedule.reduce((max, i) => i.endTime > max ? i.endTime : max, data.schedule[0].endTime);

  // Buffer times
  const startTs = startTime.getTime() - 30 * 60000;
  const endTs = endTime.getTime() + 60 * 60000;
  const totalDuration = endTs - startTs;

  const getLeft = (date: Date) => {
    return `${((date.getTime() - startTs) / totalDuration) * 100}%`;
  };

  const getWidth = (start: Date, end: Date) => {
    return `${((end.getTime() - start.getTime()) / totalDuration) * 100}%`;
  };

  const timeMarkers: Date[] = [];
  for (let t = startTs; t <= endTs; t += 60 * 60000) { // Every hour
    timeMarkers.push(new Date(t));
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-10">
        <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <Clock className="text-blue-600" size={20} />
          Operational Gantt Timeline
        </h2>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-blue-500 rounded-sm"></span>
            <span className="text-slate-600">Active Pouring</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-400 rounded-sm"></span>
            <span className="text-slate-600">Setup/Pump</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto relative p-6">
        <div className="min-w-[1000px] relative">
          {/* Time Header */}
          <div className="flex border-b border-slate-300 pb-2 mb-4 sticky top-0 bg-slate-50 z-10">
            <div className="w-48 font-semibold text-slate-500 text-sm pl-2">Work Site / Pump</div>
            <div className="flex-1 relative h-6">
              {timeMarkers.map((time, idx) => (
                <div 
                  key={idx} 
                  className="absolute text-xs text-slate-400 transform -translate-x-1/2 flex flex-col items-center"
                  style={{ left: getLeft(time) }}
                >
                  <span>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {/* Show date if it's 00:00 or the first marker */}
                  {(idx === 0 || time.getHours() === 0) && (
                      <span className="text-[9px] text-slate-300 font-bold">{time.toLocaleDateString([], {day: '2-digit', month: '2-digit'})}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Rows */}
          <div className="space-y-6">
            {works.map((work) => {
              const workItems = data.schedule.filter(s => s.workId === work.id);
              if (workItems.length === 0) return null;
              
              // Sort items by start time
              workItems.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
              
              const pumpId = workItems[0]?.pumpId || 'Unassigned';
              const workStart = workItems[0].startTime;
              const workEnd = workItems[workItems.length - 1].endTime;

              return (
                <div key={work.id} className="group relative">
                  <div className="flex items-start">
                     {/* Row Label */}
                    <div className="w-48 pr-4 py-2">
                      <div className="font-bold text-slate-800 text-sm">{work.name}</div>
                      <div className="text-xs text-blue-600 font-medium flex items-center gap-1 mt-1">
                        <Hammer size={12} /> {pumpId}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {workStart.toLocaleString([], {day: '2-digit', month: '2-digit', hour:'2-digit', minute:'2-digit'})}
                      </div>
                    </div>

                    {/* Timeline Bar Container */}
                    <div className="flex-1 relative h-16 bg-slate-100 rounded-lg border border-slate-200">
                      
                      {/* Grid Lines */}
                      {timeMarkers.map((time, idx) => (
                        <div 
                          key={idx} 
                          className="absolute h-full border-r border-slate-200 border-dashed top-0"
                          style={{ left: getLeft(time) }}
                        />
                      ))}

                      {/* Main Work Span Background (Optional, light highlight) */}
                      <div 
                        className="absolute h-full bg-blue-50/50 border-l border-r border-blue-100 top-0"
                        style={{ 
                          left: getLeft(workStart), 
                          width: getWidth(workStart, workEnd) 
                        }}
                      />

                      {/* Individual Loads */}
                      {workItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="absolute h-10 top-3 rounded shadow-sm bg-blue-500 hover:bg-blue-600 border border-blue-700 transition-all cursor-pointer flex items-center justify-center group/item z-10"
                          style={{
                            left: getLeft(item.startTime),
                            width: getWidth(item.startTime, item.endTime)
                          }}
                        >
                          <span className="text-[10px] font-bold text-white truncate px-1">
                            {item.truckId}
                          </span>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 hidden group-hover/item:block bg-slate-800 text-white text-xs p-2 rounded shadow-lg whitespace-nowrap z-20">
                             <div><strong>Load #{item.loadNumber}</strong></div>
                             <div>Truck: {item.truckId}</div>
                             <div>Start: {item.startTime.toLocaleString([], {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</div>
                             <div>End: {item.endTime.toLocaleString([], {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
