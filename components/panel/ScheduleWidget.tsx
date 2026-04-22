'use client';

import { useEffect, useState } from 'react';
import { DRAFT_SCHEDULE, getDraftStatus } from '@/lib/data/draftSchedule';

function fmt12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function ScheduleWidget() {
  const [, setTick] = useState(0);

  // Re-render every minute so status stays current
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const { session, status, nextSession } = getDraftStatus();
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <section className="border-t border-gray-800 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Draft Schedule
      </h2>

      {/* Status banner */}
      {status === 'live' && session && (
        <div className="mb-2 px-2 py-1.5 rounded bg-yellow-500/10 border border-yellow-500/30">
          <p className="text-xs font-semibold text-yellow-400">● CAMPUS OPEN NOW</p>
          <p className="text-xs text-yellow-300 mt-0.5">{session.label}</p>
        </div>
      )}
      {status === 'upcoming' && session && (
        <div className="mb-2 px-2 py-1.5 rounded bg-gray-800">
          <p className="text-xs text-gray-400">Next up</p>
          <p className="text-xs font-semibold text-white mt-0.5">{session.label}</p>
        </div>
      )}
      {status === 'done' && nextSession && (
        <div className="mb-2 px-2 py-1.5 rounded bg-gray-800">
          <p className="text-xs text-gray-400">Up next</p>
          <p className="text-xs font-semibold text-white mt-0.5">{nextSession.label}</p>
        </div>
      )}
      {status === 'done' && !nextSession && (
        <div className="mb-2 px-2 py-1.5 rounded bg-gray-800">
          <p className="text-xs text-gray-500">Draft weekend complete</p>
        </div>
      )}

      {/* Full schedule */}
      <div className="space-y-2">
        {DRAFT_SCHEDULE.map((s) => {
          const isToday  = s.date === todayStr;
          const isPast   = s.date < todayStr;
          return (
            <div
              key={s.date}
              className={`text-xs rounded px-2 py-1.5 ${
                isToday  ? 'bg-yellow-500/10 border border-yellow-500/20' :
                isPast   ? 'opacity-40' : 'bg-gray-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`font-semibold ${isToday ? 'text-yellow-400' : 'text-gray-300'}`}>
                  {s.day}
                </span>
                {isToday && (
                  <span className="text-yellow-500 font-bold text-xs">TODAY</span>
                )}
              </div>
              <div className="text-gray-400">
                <span className="font-medium text-gray-200">{s.rounds}</span>
                {' · '}picks {fmt12(s.broadcastStart)}
              </div>
              <div className="text-gray-600 mt-0.5">
                Campus {fmt12(s.campusOpen)}–{fmt12(s.campusClose)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
