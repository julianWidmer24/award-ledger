// Row shapes as returned by Supabase (see supabase/schema.sql).
import type { AreaKey, GoalArea, LevelId, ResourceCategory, ShareKey } from './data';

export interface Profile {
  id: string;
  display_name: string;
  school: string | null;
  avatar_url: string | null;
  friend_code: string;
  birthday: string | null;      // YYYY-MM-DD
  registered_on: string | null; // YYYY-MM-DD
  target_level: LevelId;
  advisor_name: string | null;
  sharing: Partial<Record<ShareKey, boolean>>;
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
  avatar_url: string | null;
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
  avatar_url: string | null;
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

export interface Resource {
  id: string;
  user_id: string;
  kind: 'file' | 'link';
  title: string;
  url: string | null;
  storage_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  category: ResourceCategory;
  notes: string | null;
  created_at: string;
}

export interface ExpeditionMember {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  role: 'owner' | 'member';
  status: 'invited' | 'accepted';
  invited_by_name: string | null;
}

/** My own membership row (reflection is personal, one per member). */
export interface MyMembership {
  expedition_id: string;
  role: 'owner' | 'member';
  status: 'invited' | 'accepted';
  reflection: string | null;
  invited_by: string | null;
}

export interface ExpeditionInvite { expedition: Expedition; invitedByName: string | null }

export interface FriendProfile {
  id: string;
  display_name: string;
  school: string | null;
  avatar_url: string | null;
  registered_on: string | null;
  target_level: LevelId | null;
  shares: { goals: boolean; logs: boolean; hours: boolean; target: boolean };
  hours: Partial<Record<AreaKey, number>> | null;
  goals: { area: GoalArea; title: string; text: string; status: GoalStatus; version: number; dated: string }[] | null;
  entries: { id: string; date: string; hours: number; status: EntryStatus; activity: string; area: AreaKey }[] | null;
}
