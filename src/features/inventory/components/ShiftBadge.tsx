import { Clock, Calendar } from 'lucide-react';
import { useShifts } from '../ShiftContext';
import { ShiftActions } from './ShiftActions';

export function ShiftBadge() {
  const { currentShift, currentDate, currentTime } = useShifts();

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-4 rounded-lg bg-slate-800 px-4 py-2 text-sm text-white border border-slate-700">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-400" />
          <span className="font-semibold">{currentShift.name}</span>
          <span className="text-slate-400">({currentShift.description})</span>
        </div>
        <div className="h-4 w-px bg-slate-600" />
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-green-400" />
          <span>{currentDate}</span>
        </div>
        <div className="h-4 w-px bg-slate-600" />
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-yellow-400" />
          <span className="font-mono">{currentTime}</span>
        </div>
      </div>
      <ShiftActions />
    </div>
  );
}
