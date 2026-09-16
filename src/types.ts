// Row shapes as returned by Supabase (see supabase/schema.sql).
import type { AreaKey, GoalArea, LevelId, ShareKey } from './data';

export interface Profile {
  id: string;
  display_name: string;
  school: string | null;
  friend_code: string;
  birthday: string | null;      // YYYY-MM-DD
  registered_on: string | null; // YYYY-MM-DD
  target_level: LevelId;
  advisor_name: string | null;
  sharing: Record<ShareKey, boolean>;
  onboarded_at: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  user_id: string;
  area: AreaKey;
  name: string;
  validator_name: string | null;
  validator_title: string | null;
  validator_contact: string | null;
  archived: boolean;
  created_at: string;
}

export type EntryStatus = 'logged' | 'sent' | 'validated';

export interface Entry {
  id: string;
  user_id: string;
  activity_id: string;
  date: string;
  hours: number;
  description: string | null;
  status: EntryStatus;
  created_at: string;
}

export type GoalStatus = 'draft' | 'awaiting' | 'signed';

export interface GoalRevision { v: number; note: string; date: string; text: string }

export interface Goal {
  id: string;
  user_id: string;
  area: GoalArea;
  title: string;
  text: string;
  version: number;
  status: GoalStatus;
  dated: string;
  history: GoalRevision[];
  updated_at: string;
}

export interface ItineraryDay { day: string; route: string; miles: string; camp: string }

export interface Expedition {
  id: string;
  user_id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  status: 'planned' | 'completed';
  purpose: string | null;
  itinerary: ItineraryDay[];
  validator_name: string | null;
  validator_title: string | null;
  validator_contact: string | null;
  reflection: string | null;
  created_at: string;
}

export interface FriendSummary {
  friendship_id: string;
  id: string;
  display_name: string;
  school: string | null;
  target_level: LevelId | null;   // null when the friend hides it
  registered_on: string | null;
  hours_vps: number | null;       // null when the friend hides hours
  hours_pd: number | null;
  hours_pf: number | null;
  week_hours: number | null;
  last_logged: string | null;
  activity_names: string[] | null;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  display_name: string;
  school: string | null;
  created_at: string;
}

export interface Checkin {
  id: string;
  from_user: string;
  to_user: string;
  from_name: string;
  to_name: string;
  message: string;
  created_at: string;
}
