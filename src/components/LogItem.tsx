import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { LogEntry } from '../types';

export const LogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = !!log.details;

  return (
    <div className="border-b border-white/5 last:border-0 py-1">
      <div 
        className={cn(
          "flex items-start gap-2 group cursor-pointer hover:bg-white/10 p-1.5 rounded transition-all duration-200",
          isExpanded ? "bg-white/5" : "text-white/60"
        )}
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
      >
        <span className="text-[10px] text-white/20 shrink-0 mt-0.5 tabular-nums">
          {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-tighter",
              log.type === 'info' ? "bg-blue-500/20 text-blue-400" :
              log.type === 'error' ? "bg-red-500/20 text-red-400" :
              log.type === 'warning' ? "bg-amber-500/20 text-amber-400" :
              log.type === 'sent' ? "bg-purple-500/20 text-purple-400" :
              "bg-green-500/20 text-green-400"
            )}>
              {log.type}
            </span>
            <span className={cn(
              "truncate text-[11px] font-medium leading-none",
              isExpanded ? "text-white" : ""
            )}>
              {log.message}
            </span>
            {hasDetails && (
              <span className="ml-auto opacity-40 group-hover:opacity-100 transition-opacity">
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            )}
          </div>
          {isExpanded && log.details && (
            <div className="mt-2 relative">
               <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-white/10 rounded-full" />
               <pre className="ml-3 p-3 bg-black/40 rounded-lg text-[10px] overflow-x-auto text-[#22C9E8] leading-relaxed border border-white/10 backdrop-blur-md">
                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
