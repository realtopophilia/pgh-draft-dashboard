// 2026 NFL Draft — Pittsburgh, April 23–25
// All times Eastern. Campus hours from nfl.com/draft/event-info/registration.

export interface DraftSession {
  day:        string;         // display label
  date:       string;         // YYYY-MM-DD for comparison
  campusOpen: string;         // HH:MM 24h
  campusClose:string;
  broadcastStart: string;     // HH:MM 24h, when picks begin on air
  rounds:     string;
  label:      string;         // short summary for UI
}

export const DRAFT_SCHEDULE: DraftSession[] = [
  {
    day:           'Thursday, Apr 23',
    date:          '2026-04-23',
    campusOpen:    '12:00',
    campusClose:   '22:00',
    broadcastStart:'20:00',
    rounds:        'Round 1',
    label:         'Round 1 · 8 PM ET',
  },
  {
    day:           'Friday, Apr 24',
    date:          '2026-04-24',
    campusOpen:    '12:00',
    campusClose:   '22:00',
    broadcastStart:'19:00',
    rounds:        'Rounds 2–3',
    label:         'Rounds 2–3 · 7 PM ET',
  },
  {
    day:           'Saturday, Apr 25',
    date:          '2026-04-25',
    campusOpen:    '09:00',
    campusClose:   '18:00',
    broadcastStart:'12:00',
    rounds:        'Rounds 4–7',
    label:         'Rounds 4–7 · Noon ET',
  },
];

// Returns which session is active or coming next, and its status
export function getDraftStatus(): {
  session: DraftSession | null;
  status: 'live' | 'upcoming' | 'done';
  nextSession: DraftSession | null;
} {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowMins  = now.getHours() * 60 + now.getMinutes();

  function toMins(hhmm: string) {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  for (let i = 0; i < DRAFT_SCHEDULE.length; i++) {
    const s = DRAFT_SCHEDULE[i];
    if (s.date === todayStr) {
      const open  = toMins(s.campusOpen);
      const close = toMins(s.campusClose);
      if (nowMins >= open && nowMins < close) {
        return { session: s, status: 'live', nextSession: DRAFT_SCHEDULE[i + 1] ?? null };
      }
      if (nowMins < open) {
        return { session: s, status: 'upcoming', nextSession: null };
      }
      // Past close today — next session
      return {
        session: null,
        status: 'done',
        nextSession: DRAFT_SCHEDULE[i + 1] ?? null,
      };
    }
    if (s.date > todayStr) {
      // Future day
      return { session: s, status: 'upcoming', nextSession: null };
    }
  }

  // All sessions past
  return { session: null, status: 'done', nextSession: null };
}
