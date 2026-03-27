/**
 * Task template definitions for a user (matches typical studio workflow).
 */
export const DEMO_TASK_TEMPLATES = [
  {
    name: 'Recording Vocals',
    slug: 'recording-vocals',
    description: 'Lead and backing vocal sessions.',
    defaultEstimatedHours: 2,
    isActive: true,
  },
  {
    name: 'Production',
    slug: 'production',
    description: 'Arrangement, programming, sound design.',
    defaultEstimatedHours: 4,
    isActive: true,
  },
  {
    name: 'Editing',
    slug: 'editing',
    description: 'Comping, tuning, cleanup.',
    defaultEstimatedHours: 1,
    isActive: true,
  },
  {
    name: 'Mixing',
    slug: 'mixing',
    description: 'Full mix, revisions.',
    defaultEstimatedHours: 3,
    isActive: true,
  },
  {
    name: 'Mastering',
    slug: 'mastering',
    description: 'Final master, references.',
    defaultEstimatedHours: 1,
    isActive: true,
  },
  {
    name: 'Rendering Stems',
    slug: 'rendering-stems',
    description: 'Export stems and alt mixes.',
    defaultEstimatedHours: 0.5,
    isActive: true,
  },
];

/** Smaller set for the second demo user (tenancy isolation). */
export const OTHER_USER_TASK_TEMPLATES = [
  { name: 'Rehearsal', slug: 'rehearsal', defaultEstimatedHours: 2, isActive: true },
  { name: 'Live recording', slug: 'live-recording', defaultEstimatedHours: 3, isActive: true },
];
