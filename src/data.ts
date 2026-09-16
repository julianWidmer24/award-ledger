// Award rules and static reference data. Everything a participant does lives in Supabase (see types.ts).

export type AreaKey = 'vps' | 'pd' | 'pf';
export type GoalArea = AreaKey | 'exp';
export type LevelId = 'bc' | 'sc' | 'gc' | 'bm' | 'sm' | 'gm';
export type Screen = 'dash' | 'log' | 'goals' | 'exp' | 'friends' | 'friend' | 'book' | 'resources' | 'settings';
export type DashboardLayout = 'rings' | 'ledger' | 'pace';
export type ShareKey = 'hours' | 'target' | 'week' | 'activities' | 'goals' | 'logs';

export interface Level {
  id: LevelId; name: string; short: string;
  vps: number; pd: number; pf: number;
  expText: string; expNights: number; expDays: number; months: number;
}

export const LEVELS: Level[] = [
  { id: 'bc', name: 'Bronze Certificate', short: 'Bronze Cert', vps: 30, pd: 15, pf: 15, expText: '1 day', expNights: 0, expDays: 1, months: 0 },
  { id: 'sc', name: 'Silver Certificate', short: 'Silver Cert', vps: 60, pd: 30, pf: 30, expText: '2 days', expNights: 0, expDays: 2, months: 0 },
  { id: 'gc', name: 'Gold Certificate', short: 'Gold Cert', vps: 90, pd: 45, pf: 45, expText: '3 days', expNights: 0, expDays: 3, months: 6 },
  { id: 'bm', name: 'Bronze Medal', short: 'Bronze Medal', vps: 100, pd: 50, pf: 50, expText: '1 overnight', expNights: 1, expDays: 2, months: 7 },
  { id: 'sm', name: 'Silver Medal', short: 'Silver Medal', vps: 200, pd: 100, pf: 100, expText: '2 overnights', expNights: 2, expDays: 3, months: 12 },
  { id: 'gm', name: 'Gold Medal', short: 'Gold Medal', vps: 400, pd: 200, pf: 200, expText: '4 overnights', expNights: 4, expDays: 5, months: 24 },
];

export const levelById = (id: string | null | undefined): Level => LEVELS.find(l => l.id === id) ?? LEVELS[LEVELS.length - 1];

export interface Area { key: AreaKey; name: string; label: string; blurb: string }

export const AREAS: Area[] = [
  { key: 'vps', name: 'Voluntary Public Service', label: 'Public Service', blurb: 'Unpaid service that benefits others — a hospital, food bank, tutoring, community group.' },
  { key: 'pd', name: 'Personal Development', label: 'Personal Dev.', blurb: 'Learning a skill or pursuing an interest — a language, an instrument, a craft, a subject.' },
  { key: 'pf', name: 'Physical Fitness', label: 'Fitness', blurb: 'Regular activity that improves your fitness — a sport, a gym routine, running, climbing.' },
];

export const areaByKey = (key: string): Area => AREAS.find(a => a.key === key) ?? AREAS[0];

export const GOAL_AREAS: { key: GoalArea; name: string; hint: string }[] = [
  ...AREAS.map(a => ({ key: a.key, name: a.name, hint: a.blurb })),
  { key: 'exp', name: 'Expedition / Exploration', hint: 'A trip into an unfamiliar environment that you plan and carry out — the length grows with the award level.' },
];

export const GOAL_STATUS: Record<'draft' | 'awaiting' | 'signed', [string, string]> = {
  draft: ['Draft', 'tag-neutral'],
  awaiting: ['Awaiting advisor', 'tag-accent'],
  signed: ['Advisor signed', 'tag-accent-2'],
};

export const ENTRY_STATUS: Record<'logged' | 'sent' | 'validated', [string, string]> = {
  logged: ['Logged', 'tag-neutral'],
  sent: ['Sent for validation', 'tag-accent'],
  validated: ['Validated', 'tag-accent-2'],
};

export const SHARE: [ShareKey, string, string][] = [
  ['hours', 'Hours per area', 'Totals against your target level'],
  ['target', 'Target level and pace', 'On pace / behind, no numbers behind it'],
  ['week', 'Hours this week', 'Resets Monday'],
  ['activities', 'Activity names', 'e.g. "ED volunteering" — never descriptions or validators'],
  ['goals', 'Written goals', 'Title, statement and whether the advisor has signed'],
  ['logs', 'Your log', 'Date, activity, area and hours per entry — never what you wrote or who validated'],
];

/** Sharing keys added after launch default to on for existing profiles. */
export const shareOn = (sharing: Partial<Record<ShareKey, boolean>>, key: ShareKey) => sharing[key] ?? (key !== 'activities');

export const LOG_RULES = [
  'Hours only count after your program registration date. Nothing retroactive.',
  'Paid work and graduation requirements never count.',
  'Volunteering at a private business is not Voluntary Public Service.',
  'Every activity needs an adult validator who is not a relative, with name, title and contact.',
  'Entries start as Logged; send them for validation in batches, then mark them Validated once your validator has signed.',
];

/** Trailing window used to estimate a participant's weekly pace. */
export const PACE_WEEKS = 8;

export type ResourceCategory = 'record' | 'project' | 'official' | 'other';

export const RESOURCE_CATEGORIES: [ResourceCategory, string, string][] = [
  ['record', 'Record book', 'Signed forms, validator letters, draft write-ups'],
  ['project', 'My projects', 'Plans, itineraries, syllabi, training logs for your own activities'],
  ['other', 'Other', 'Anything else worth keeping to hand'],
];

export interface OfficialResource { title: string; url: string; blurb: string; kind: 'pdf' | 'site' | 'portal' }

/** Published by the Congressional Award Foundation (congressionalaward.org). URLs verified 16 Sep 2026. */
export const OFFICIAL_RESOURCES: OfficialResource[] = [
  { title: 'Program Book (2023)', url: 'https://www.congressionalaward.org/wp-content/uploads/Program-Book_2023.pdf', kind: 'pdf', blurb: 'The official guide: requirements for every level, sample activities, rules on what counts, and FAQs.' },
  { title: 'Participant Record Book', url: 'https://www.congressionalaward.org/wp-content/uploads/2021/06/recordbook.pdf', kind: 'pdf', blurb: 'The form your final submission follows — see exactly what goals, logs, validators and the expedition section must contain.' },
  { title: 'Award Workbook (fillable)', url: 'https://www.congressionalaward.org/wp-content/uploads/2021/11/Draft_Award_Workbook_Fillable.pdf', kind: 'pdf', blurb: 'A personal-use workbook for drafting goals and tracking activities. Not accepted for review; the record book is submitted online.' },
  { title: 'How to submit online (Submittable guide)', url: 'https://www.congressionalaward.org/wp-content/uploads/2021/09/How-to-Guide-for-Submittable.pdf', kind: 'pdf', blurb: 'Step-by-step guide to the online record-book submission portal.' },
  { title: 'Submittable portal', url: 'https://congressionalaward.submittable.com/submit', kind: 'portal', blurb: 'Where the finished record book is actually submitted for review.' },
  { title: 'Current participants page', url: 'https://www.congressionalaward.org/current/', kind: 'site', blurb: 'Updates, deadlines and resources for registered participants.' },
  { title: 'congressionalaward.org', url: 'https://www.congressionalaward.org/', kind: 'site', blurb: 'The program home page — registration, contact details for the national office, and regional program managers.' },
];
