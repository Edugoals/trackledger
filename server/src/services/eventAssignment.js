/**
 * Lightweight suggestion engine: event title -> Task/TrackTask.
 * Case-insensitive keyword matching against task names.
 * Easy to extend.
 */

const KEYWORD_TO_TASK_NAME = [
  { keywords: ['vocal', 'vocals', 'zang'], name: 'Recording Vocals' },
  { keywords: ['record', 'opname'], name: 'Recording Vocals' },
  { keywords: ['mix', 'mixing'], name: 'Mixing' },
  { keywords: ['master', 'mastering'], name: 'Mastering' },
  { keywords: ['edit', 'editing'], name: 'Editing' },
  { keywords: ['prod', 'production'], name: 'Production' },
  { keywords: ['stem', 'stems'], name: 'Rendering Stems' },
];

/**
 * @param {string} title - Event title/summary
 * @param {Array<{id: number, task: {name: string}}>} trackTasks - TrackTasks with task included
 * @returns {{ trackTaskId: number, taskName: string } | null}
 */
export function suggestTrackTaskFromTitle(title, trackTasks) {
  if (!title || typeof title !== 'string') return null;
  const lower = title.toLowerCase().trim();
  if (!lower) return null;

  for (const { keywords, name } of KEYWORD_TO_TASK_NAME) {
    if (keywords.some((kw) => lower.includes(kw))) {
      const match = trackTasks.find(
        (tt) => tt.task?.name?.toLowerCase() === name.toLowerCase()
      );
      if (match) return { trackTaskId: match.id, taskName: match.task.name };
    }
  }
  return null;
}
