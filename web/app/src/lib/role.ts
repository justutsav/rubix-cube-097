/**
 * Who is holding the phone.
 *
 * Three people use this product and they must not share a navigation bar:
 *
 *   · the **beneficiary**, who cannot read, is answering seven questions once, and needs exactly
 *     one thing on screen at a time;
 *   · the **district officer** (District PIU / DL-PACC), who prepares the district's projects and
 *     watches the April deadline;
 *   · the **state officer** (SL-PACC), who ranks districts and rolls their projects into the
 *     State's Perspective Plan.
 *
 * The first build put all six screens in one flat tab bar, which meant a beneficiary's phone
 * displayed a District Collector's console two taps from the consent script. That is not a layout
 * problem, it is a disclosure problem — the officer console lists other people's answers.
 *
 * The role is stored on the device, not on the server, because the kiosk case has no server.
 *
 * **The mobiliser role was removed on 2026-09-28.** The assisted-doorstep case is served by the
 * kiosk in a CSC Village Level Entrepreneur's hands, which is the problem statement's own answer
 * to "inadequate technical and support team at ground level". Outcome tracking, which used to be
 * the mobiliser's call list, now lives in the district officer's console — see `Outcomes` below.
 * The follow-up call that is meant to replace manual entry is not built yet.
 */

import { openStore } from './db';

export type Role = 'beneficiary' | 'district_officer' | 'state_officer';

const KEY = 'app.role';

/** Roles that see other people's data. Used to gate the officer routes. */
export const OFFICER_ROLES: Role[] = ['district_officer', 'state_officer'];

export function isOfficer(role: Role | null): boolean {
  return role !== null && OFFICER_ROLES.includes(role);
}

export interface RoleMeta {
  id: Role;
  label: string;
  labelLocal: string;
  blurb: string;
  icon: string;
}

export const ROLES: RoleMeta[] = [
  {
    id: 'beneficiary',
    label: 'I want to find training',
    labelLocal: 'मुझे काम-धंधे की ट्रेनिंग चाहिए',
    blurb: 'Seven short questions, in your own language. About four minutes.',
    icon: '🙋',
  },
  {
    id: 'district_officer',
    label: 'I am a district officer',
    labelLocal: 'मैं ज़िला अधिकारी हूँ',
    blurb: 'District demand, project preparation, the consent register.',
    icon: '🏛️',
  },
  {
    id: 'state_officer',
    label: 'I am a state officer',
    labelLocal: 'मैं राज्य अधिकारी हूँ',
    blurb: 'Rank districts, roll their projects into the Perspective Plan.',
    icon: '🗺️',
  },
];

/**
 * Roles stored by builds before 2026-09-28. `officer` became `district_officer`; `mobiliser` no
 * longer exists, so those devices fall back to the chooser rather than silently landing somewhere
 * they did not pick.
 */
const LEGACY: Record<string, Role | null> = {
  officer: 'district_officer',
  mobiliser: null,
};

export async function getRole(): Promise<Role | null> {
  const store = await openStore();
  const raw = await store.get<string>(KEY);
  if (!raw) return null;
  if (raw in LEGACY) {
    const migrated = LEGACY[raw];
    if (migrated) await store.set(KEY, migrated);
    else await store.set<Role | null>(KEY, null);
    return migrated;
  }
  return ROLES.some((r) => r.id === raw) ? (raw as Role) : null;
}

export async function setRole(role: Role): Promise<void> {
  const store = await openStore();
  await store.set(KEY, role);
}

export async function clearRole(): Promise<void> {
  const store = await openStore();
  await store.set<Role | null>(KEY, null);
}

export interface Tab {
  to: string;
  label: string;
  icon: string;
}

/** The navigation each role actually gets. Nobody sees another role's screens. */
export const TABS: Record<Role, Tab[]> = {
  // Her tabs are in her language. The officers' stay in English — they read, she does not,
  // and an English label under an icon is decoration to someone who cannot read it.
  beneficiary: [
    { to: '/home', label: 'घर', icon: '🏠' },
    { to: '/interview', label: 'सवाल', icon: '🎤' },
    { to: '/chat', label: 'पूछिए', icon: '💬' },
    { to: '/me', label: 'मेरी योजना', icon: '📄' },
  ],
  district_officer: [
    { to: '/home', label: 'Home', icon: '🏠' },
    { to: '/officer', label: 'District', icon: '🏛️' },
    { to: '/outcomes', label: 'Outcomes', icon: '📋' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ],
  state_officer: [
    { to: '/home', label: 'Home', icon: '🏠' },
    { to: '/state', label: 'Districts', icon: '🗺️' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ],
};
