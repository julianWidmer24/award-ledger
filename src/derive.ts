// Pure progress calculations over a participant's data. Nothing here touches the network.
import { AREAS, GOAL_AREAS, LEVELS, PACE_WEEKS, areaByKey, levelById, type Area, type AreaKey, type Level, type Screen } from './data';
import type { Activity, Entry, Expedition, ExpeditionInvite, Goal, MyMembership, Profile, Resource } from './types';
import { DAY_MS, addDays, addMonths, addYears, fmtDate, fmtMonth, monthsBetween, parseISODate, startOfToday } from './lib/dates';

export interface Snapshot {
  profile: Profile;
  activities: Activity[];
  entries: Entry[];
  goals: Goal[];
  expeditions: Expedition[];          // owned + accepted shared
  memberships: MyMembership[];
  expeditionInvites: ExpeditionInvite[];
  resources: Resource[];
}

export const RING_CIRCUMFERENCE = 263.9; // 2π × r42
const round1 = (n: number) => Math.round(n * 10) / 10;

export const activityById = (s: Snapshot, id: string) => s.activities.find(a => a.id === id);

// ─── Time ────────────────────────────────────────────────────────────────────
export interface Timeline {
  today: Date; registered: Date; deadline: Date | null;
  daysLeft: number; weeksLeft: number; timePct: number; monthsElapsed: number; weeksElapsed: number;
}

export function timeline(profile: Profile): Timeline {
  const today = startOfToday();
  const registered = parseISODate(profile.registered_on) ?? parseISODate(profile.created_at) ?? today;
  const birthday = parseISODate(profile.birthday);
  const deadline = birthday ? addYears(birthday, 24) : null;
  const daysLeft = deadline ? Math.max(0, Math.round((deadline.getTime() - today.getTime()) / DAY_MS)) : Infinity;
  const totalDays = deadline ? Math.max(1, (deadline.getTime() - registered.getTime()) / DAY_MS) : Infinity;
  const timePct = deadline ? Math.min(100, Math.max(0, Math.round((today.getTime() - registered.getTime()) / DAY_MS / totalDays * 100))) : 0;
  return {
    today, registered, deadline, daysLeft, weeksLeft: Math.max(1, daysLeft / 7), timePct,
    monthsElapsed: Math.max(0, monthsBetween(registered, today)),
    weeksElapsed: Math.max(0, (today.getTime() - registered.getTime()) / DAY_MS / 7),
  };
}

// ─── Hours ───────────────────────────────────────────────────────────────────
export function hoursByArea(s: Snapshot, filter?: (e: Entry) => boolean): Record<AreaKey, number> {
  const areaOf = new Map(s.activities.map(a => [a.id, a.area]));
  const out: Record<AreaKey, number> = { vps: 0, pd: 0, pf: 0 };
  for (const e of s.entries) {
    if (filter && !filter(e)) continue;
    const area = areaOf.get(e.activity_id);
    if (area) out[area] += Number(e.hours);
  }
  return { vps: round1(out.vps), pd: round1(out.pd), pf: round1(out.pf) };
}

/** Average hours per week over the trailing PACE_WEEKS (or since registration, if shorter). */
export function paceByArea(s: Snapshot, t: Timeline): Record<AreaKey, number> {
  const weeks = Math.max(1, Math.min(PACE_WEEKS, Math.ceil(t.weeksElapsed) || 1));
  const from = addDays(t.today, -weeks * 7 + 1);
  const recent = hoursByArea(s, e => (parseISODate(e.date) ?? t.today) >= from);
  return { vps: recent.vps / weeks, pd: recent.pd / weeks, pf: recent.pf / weeks };
}

/** Hours logged in the seven days up to and including today. */
export function weekHours(s: Snapshot, t: Timeline): number {
  const h = hoursByArea(s, e => (parseISODate(e.date) ?? t.today) >= addDays(t.today, -6));
  return round1(h.vps + h.pd + h.pf);
}

// ─── Expedition credit ───────────────────────────────────────────────────────
export const expeditionNights = (x: Expedition) => {
  const a = parseISODate(x.start_date), b = parseISODate(x.end_date);
  return a && b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY_MS)) : 0;
};

export function expeditionCredit(s: Snapshot) {
  const done = s.expeditions.filter(x => x.status === 'completed');
  const nights = Math.max(0, ...done.map(expeditionNights));
  return { nights, days: done.length ? nights + 1 : 0, best: done.sort((a, b) => expeditionNights(b) - expeditionNights(a))[0] ?? null };
}

export const expeditionMeets = (level: Level, credit: { nights: number; days: number }) =>
  level.expNights ? credit.nights >= level.expNights : credit.days >= level.expDays;

// ─── Progress per area ───────────────────────────────────────────────────────
export interface AreaProgress extends Area {
  done: number; req: number; remaining: number; pct: number; onPace: boolean;
  pace: number; need: number; eta: string; paceLabel: string; paceDetail: string;
}

export function areaProgress(s: Snapshot, target: Level, t: Timeline): AreaProgress[] {
  const hours = hoursByArea(s);
  const pace = paceByArea(s, t);
  return AREAS.map(a => {
    const done = hours[a.key], req = target[a.key];
    const remaining = round1(Math.max(0, req - done));
    const pct = Math.min(1, done / req);
    const need = t.deadline ? remaining / t.weeksLeft : 0;
    const p = pace[a.key];
    const onPace = remaining === 0 || p >= need;
    const etaWeeks = p > 0 ? remaining / p : Infinity;
    const eta = remaining === 0 ? 'Complete' : etaWeeks === Infinity ? 'Never at 0 h/wk' : fmtMonth(addDays(t.today, etaWeeks * 7));
    return {
      ...a, done, req, remaining, pct, onPace, pace: p, need, eta,
      paceLabel: remaining === 0 ? 'Complete' : onPace ? 'On pace' : 'Behind pace',
      paceDetail: remaining === 0 ? 'Requirement met for this level'
        : t.deadline ? `${p.toFixed(1)} h/wk logged · ${need.toFixed(1)} h/wk needed` : `${p.toFixed(1)} h/wk logged`,
    };
  });
}

// ─── Level ladder ────────────────────────────────────────────────────────────
export interface LadderStep extends Level {
  earned: boolean; expMet: boolean; isTarget: boolean; status: string; reqs: string; monthsText: string;
}

export function ladder(s: Snapshot, t: Timeline): LadderStep[] {
  const hours = hoursByArea(s);
  const credit = expeditionCredit(s);
  return LEVELS.map(l => {
    const short = AREAS.filter(a => hours[a.key] < l[a.key]).map(a => `${round1(l[a.key] - hours[a.key])} h ${a.label}`);
    const monthsShort = Math.max(0, l.months - t.monthsElapsed);
    const expMet = expeditionMeets(l, credit);
    const earned = !short.length && !monthsShort && expMet;
    const isTarget = l.id === s.profile.target_level;
    let status = earned ? 'Earned' : short.length ? 'Short ' + short.join(', ') : monthsShort ? `Time gate: ${monthsShort} mo` : 'Expedition pending';
    if (isTarget) status = earned ? 'Earned · target' : 'Target · ' + status.toLowerCase();
    return { ...l, earned, expMet, isTarget, status, reqs: `${l.vps} · ${l.pd} · ${l.pf} h`, monthsText: l.months ? l.months + ' mo' : 'no wait' };
  });
}

export function gate(target: Level, t: Timeline) {
  const gateDate = addMonths(t.registered, target.months);
  const open = t.monthsElapsed >= target.months;
  return {
    pct: target.months ? Math.min(100, Math.round(t.monthsElapsed / target.months * 100)) : 100,
    text: open ? `Time requirement met on ${fmtDate(gateDate)}.` : `${target.short} cannot be awarded before ${fmtDate(gateDate)}, even with all hours complete.`,
  };
}

export function expeditionSummary(s: Snapshot, target: Level) {
  const credit = expeditionCredit(s);
  if (expeditionMeets(target, credit) && credit.best) {
    return { name: credit.best.name, status: 'Complete', tagClass: 'tag-accent-2', detail: `${credit.days} days · ${credit.nights} consecutive overnights · covers ${target.short} (${target.expText}).`, meta: credit.best.validator_name ? `Validated by ${credit.best.validator_name}` : 'Add a validator on the Expedition page' };
  }
  const planned = s.expeditions.filter(x => x.status === 'planned').sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  if (planned) {
    const nights = expeditionNights(planned);
    const enough = expeditionMeets(target, { nights, days: nights + 1 });
    return { name: planned.name, status: 'Planned', tagClass: 'tag-neutral', detail: `${target.short} requires ${target.expText}, consecutive. Planned ${fmtDate(parseISODate(planned.start_date)!)} – ${fmtDate(parseISODate(planned.end_date)!)} · ${nights + 1} days · ${nights} overnights${enough ? '' : ' — not enough for this level'}.`, meta: credit.best ? `Completed so far: ${credit.best.name}, ${credit.nights} overnights` : 'Nothing completed yet' };
  }
  return { name: 'No expedition planned', status: 'Missing', tagClass: 'tag-accent', detail: `${target.short} requires ${target.expText}, consecutive. Plan one on the Expedition page.`, meta: credit.best ? `Completed so far: ${credit.best.name}, ${credit.nights} overnights` : 'Nothing completed yet' };
}

// ─── Log form rules ──────────────────────────────────────────────────────────
export interface LogForm { area: AreaKey; activityId: string; date: string; mins: number; desc: string; paid: boolean; privateBiz: boolean }
export interface Warning { text: string; block: boolean }

export function logWarnings(form: LogForm, s: Snapshot, t: Timeline): Warning[] {
  const act = activityById(s, form.activityId);
  const date = parseISODate(form.date);
  const w: Warning[] = [];
  if (!act) w.push({ text: 'Add an activity in this area first, so the hours have a validator to go with them.', block: true });
  if (form.paid) w.push({ text: 'Paid work never counts toward any program area. This session cannot be saved.', block: true });
  if (form.privateBiz && form.area === 'vps') w.push({ text: 'Volunteering at a private business does not count as Voluntary Public Service.', block: true });
  if (!date) w.push({ text: 'Pick the date of the session.', block: true });
  else if (date < t.registered) w.push({ text: `Hours before your registration date (${fmtDate(t.registered)}) do not count.`, block: true });
  else if (date > t.today) w.push({ text: 'Sessions can only be logged once they have happened.', block: true });
  if (act && !act.validator_name) w.push({ text: 'This activity has no validator. You can save, but it cannot be sent for validation until a supervisor is added.', block: false });
  return w;
}

// ─── This-week tasks (derived, so they disappear when resolved) ─────────────
export interface DerivedTask { id: string; title: string; sub: string; screen: Screen; urgent: boolean }

export function tasks(s: Snapshot, target: Level, t: Timeline): DerivedTask[] {
  const out: DerivedTask[] = [];
  const withValidator = new Set(s.activities.filter(a => a.validator_name).map(a => a.id));
  const logged = s.entries.filter(e => e.status === 'logged' && withValidator.has(e.activity_id));
  if (logged.length) {
    const names = [...new Set(logged.map(e => activityById(s, e.activity_id)?.name.split(' — ')[0] ?? ''))].slice(0, 3).join(', ');
    out.push({ id: 'send', title: `Send ${logged.length} logged ${logged.length === 1 ? 'entry' : 'entries'} for validation`, sub: names, screen: 'dash', urgent: logged.length >= 3 });
  }
  const hoursByAct = new Map<string, number>();
  for (const e of s.entries) hoursByAct.set(e.activity_id, (hoursByAct.get(e.activity_id) ?? 0) + Number(e.hours));
  for (const a of s.activities) {
    if (!a.archived && !a.validator_name && (hoursByAct.get(a.id) ?? 0) > 0) {
      out.push({ id: 'val-' + a.id, title: `Add a validator for ${a.name.split(' — ')[0]}`, sub: `${round1(hoursByAct.get(a.id)!)} h at risk without a supervisor on file`, screen: 'settings', urgent: true });
    }
  }
  for (const g of GOAL_AREAS) {
    const goal = s.goals.find(x => x.area === g.key);
    if (!goal || !goal.text.trim()) out.push({ id: 'goal-' + g.key, title: `Write your ${g.name} goal`, sub: 'Goals are dated before the hours start; the advisor signs each version', screen: 'goals', urgent: false });
    else if (goal.status === 'awaiting') out.push({ id: 'sign-' + g.key, title: `Follow up on ${g.name} goal v${goal.version} signature`, sub: `Awaiting advisor since ${fmtDate(parseISODate(goal.dated)!)}`, screen: 'goals', urgent: false });
  }
  for (const a of areaProgress(s, target, t)) {
    if (!a.onPace && a.remaining > 0) {
      out.push({ id: 'pace-' + a.key, title: `${a.name} is behind pace`, sub: `Logging ${a.pace.toFixed(1)} h/wk, need ${a.need.toFixed(1)} h/wk to finish by your deadline`, screen: 'log', urgent: true });
    }
  }
  for (const inv of s.expeditionInvites) {
    out.push({ id: 'inv-' + inv.expedition.id, title: `${inv.invitedByName ?? 'A friend'} invited you to “${inv.expedition.name}”`, sub: 'Accept to plan it together and have it count toward your expedition', screen: 'exp', urgent: true });
  }
  const credit = expeditionCredit(s);
  if (!expeditionMeets(target, credit) && !s.expeditions.some(x => x.status === 'planned')) {
    out.push({ id: 'exp', title: 'Plan your expedition', sub: `${target.short} requires ${target.expText}, consecutive`, screen: 'exp', urgent: false });
  }
  return out;
}

// ─── Record book ─────────────────────────────────────────────────────────────
export interface BookSection { n: string; title: string; sub: string; pct: number; state: string; tagClass: string; issues: string[] }

export function recordBookSections(s: Snapshot, target: Level, t: Timeline): BookSection[] {
  const sec = (n: string, title: string, sub: string, pct: number, state: string, issues: string[]): BookSection => ({
    n, title, sub, pct: Math.min(100, Math.max(0, Math.round(pct))), state, issues,
    tagClass: state === 'Complete' ? 'tag-accent-2' : state === 'Blocked' ? 'tag-accent' : 'tag-neutral',
  });
  const p = s.profile;
  const hours = hoursByArea(s);
  const validated = hoursByArea(s, e => e.status === 'validated');
  const progress = areaProgress(s, target, t);

  const regIssues: string[] = [];
  if (!p.birthday) regIssues.push('Date of birth missing — it sets your 24th-birthday deadline');
  if (!p.registered_on) regIssues.push('Program registration date missing');
  const reg = sec('01', 'Participant & registration', `Registered ${p.registered_on ? fmtDate(t.registered) : '—'} · 24th birthday ${t.deadline ? fmtDate(t.deadline) : '—'}`, regIssues.length ? 50 : 100, regIssues.length ? 'Blocked' : 'Complete', regIssues);

  const goalIssues: string[] = [];
  let signed = 0;
  for (const g of GOAL_AREAS) {
    const goal = s.goals.find(x => x.area === g.key);
    if (!goal || !goal.text.trim()) goalIssues.push(`${g.name} goal not written`);
    else if (goal.status !== 'signed') goalIssues.push(`${g.name} goal v${goal.version} ${goal.status === 'awaiting' ? 'awaiting advisor signature' : 'is still a draft'}`);
    else signed++;
  }
  const goals = sec('02', 'Written goals', `${signed} of 4 signed by advisor`, signed / 4 * 100, signed === 4 ? 'Complete' : 'In progress', goalIssues);

  const areaSections = progress.map((a, i) => {
    const acts = s.activities.filter(x => x.area === a.key && !x.archived);
    const entries = s.entries.filter(e => acts.some(x => x.id === e.activity_id));
    const issues: string[] = [];
    if (a.remaining > 0) issues.push(`${a.remaining} h short of the ${a.req} h minimum${a.onPace ? '' : ' · behind pace'}`);
    const sent = entries.filter(e => e.status === 'sent').length, logged = entries.filter(e => e.status === 'logged').length;
    if (sent || logged) issues.push([sent && `${sent} sent, not yet validated`, logged && `${logged} logged, not sent`].filter(Boolean).join(' · '));
    for (const x of acts) if (!x.validator_name && entries.some(e => e.activity_id === x.id)) issues.push(`${x.name} has no validator`);
    const validators = new Set(acts.filter(x => x.validator_name).map(x => x.validator_name)).size;
    const state = a.remaining === 0 && !issues.length ? 'Complete' : !a.onPace && a.remaining > 0 ? 'Blocked' : 'In progress';
    return sec(`0${3 + i}`, `${a.name} log`, `${hours[a.key]} of ${a.req} h (${validated[a.key]} validated) · ${acts.length} ${acts.length === 1 ? 'activity' : 'activities'} · ${validators} ${validators === 1 ? 'validator' : 'validators'}`, a.pct * 100, state, issues);
  });

  const credit = expeditionCredit(s);
  const expMet = expeditionMeets(target, credit);
  const planned = s.expeditions.find(x => x.status === 'planned');
  const expIssues = expMet ? [] : [planned ? `${target.short} expedition planned, not completed` : 'No expedition planned'];
  if (expMet && credit.best && !credit.best.validator_name) expIssues.push(`${credit.best.name}: no trip leader / validator on file`);
  const expNeed = target.expNights || target.expDays;
  const expHave = target.expNights ? credit.nights : credit.days;
  const exp = sec('06', 'Expedition', target.expNights ? `${Math.min(expHave, expNeed)} of ${expNeed} consecutive overnights completed` : `${Math.min(expHave, expNeed)} of ${expNeed} days completed`, expHave / expNeed * 100, expMet && !expIssues.length ? 'Complete' : 'In progress', expIssues);

  const used = s.activities.filter(a => s.entries.some(e => e.activity_id === a.id));
  const full = used.filter(a => a.validator_name && a.validator_title && a.validator_contact);
  const valIssues = used.filter(a => !(a.validator_name && a.validator_title && a.validator_contact)).map(a => `${a.name}: ${a.validator_name ? 'validator is missing a title or contact' : 'no supervisor on file'}`);
  const val = sec('07', 'Validator directory', used.length ? `${full.length} of ${used.length} with name, title and contact` : 'No activities with hours yet', used.length ? full.length / used.length * 100 : 0, valIssues.length ? 'Blocked' : used.length ? 'Complete' : 'Pending', valIssues);

  const others = [reg, goals, ...areaSections, exp, val];
  const ready = others.every(x => x.state === 'Complete');
  const adv = sec('08', 'Advisor sign-off', p.advisor_name ? `Advisor: ${p.advisor_name}` : 'No advisor named yet', 0, 'Pending',
    [...(p.advisor_name ? [] : ['Name your advisor in Settings']), ...(ready ? [] : ['Final advisor sign-off happens after all sections are complete'])]);

  return [...others, adv];
}

// ─── Getting-started checklist ───────────────────────────────────────────────
export interface StartItem { id: string; label: string; done: boolean; screen: Screen; why: string }

export function gettingStarted(s: Snapshot, friendCount: number): StartItem[] {
  return [
    { id: 'activity', label: 'Add an activity with a validator', done: s.activities.some(a => a.validator_name), screen: 'settings', why: 'Every hour you log attaches to an activity, and every activity needs an adult supervisor who can vouch for it.' },
    { id: 'goal', label: 'Write a goal for one program area', done: s.goals.some(g => g.text.trim()), screen: 'goals', why: 'The award asks for a written goal per area, dated before the hours start.' },
    { id: 'entry', label: 'Log your first session', done: s.entries.length > 0, screen: 'log', why: 'Four taps: area, activity, duration, save. The rules are checked as you go.' },
    { id: 'exp', label: 'Plan your expedition', done: s.expeditions.length > 0, screen: 'exp', why: 'Even a rough date range lets the dashboard show whether it meets your level.' },
    { id: 'friend', label: 'Add a friend', done: friendCount > 0, screen: 'friends', why: 'Friends see your pace, you see theirs. Nothing else is shared.' },
    { id: 'resource', label: 'Save a document or link', done: s.resources.length > 0, screen: 'resources', why: 'Validator forms, permits, syllabi — keep them where the record book will need them.' },
  ];
}

export { areaByKey, levelById };
