/** Development-only demo constants (not secrets). */
export const BCRYPT_ROUNDS = 12;

export const DEMO_USER = {
  email: 'demo@trackledger.local',
  password: 'demo1234',
  name: 'Demo User',
};

/** Second user for quick tenancy checks (separate customers/tasks/events). */
export const OTHER_USER = {
  email: 'other@trackledger.local',
  password: 'other1234',
  name: 'Other User',
};

/** Fake calendar id for seeded data (no Google required). */
export const DEV_CALENDAR_ID = 'dev-seed-calendar';
