/**
 * Who is holding the phone.
 *
 * Three people use this product and they must not share a navigation bar:
 *
 *   · the **beneficiary**, who cannot read, is answering seven questions once, and needs exactly
 *     one thing on screen at a time;
 *   · the **mobiliser** (ASHA / Anganwadi / VLCC member), who is doing twelve doorsteps in an
 *     afternoon, offline, and needs a list;
 *   · the **officer** (District PIU / DL-PACC), who is literate, indoors, and needs density.
 *
 * The first build put all six screens in one flat tab bar, which meant a beneficiary's phone
 * displayed a District Collector's console two taps from the consent script. That is not a layout
 * problem, it is a disclosure problem — the officer console lists other people's answers.
 *
 * The role is stored on the device, not on the server, because the kiosk case has no server and
 * the ASHA worker's phone is hers for months at a time.
 */

import { openStore } from './db';

export type Role = 'beneficiary' | 'mobiliser' | 'officer';

const KEY = 'app.role';

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
    id: 'mobiliser',
    label: 'I am a village worker',
    labelLocal: 'मैं आशा / आंगनवाड़ी दीदी हूँ',
    blurb: 'Run interviews at the doorstep, offline. Keep a call list.',
    icon: '🧑‍🌾',
  },
  {
    id: 'officer',
    label: 'I am a district officer',
    labelLocal: 'मैं ज़िला अधिकारी हूँ',
    blurb: 'District demand, the Perspective Plan, the consent register.',
    icon: '🏛️',
  },
];

export async function getRole(): Promise<Role | null> {
  const store = await openStore();
  return store.get<Role>(KEY);
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
  beneficiary: [
    { to: '/home', label: 'Home', icon: '🏠' },
    { to: '/interview', label: 'Questions', icon: '🎤' },
    { to: '/chat', label: 'Ask', icon: '💬' },
    { to: '/me', label: 'My plan', icon: '📄' },
  ],
  mobiliser: [
    { to: '/home', label: 'Home', icon: '🏠' },
    { to: '/field', label: 'Call list', icon: '📋' },
    { to: '/interview', label: 'Interview', icon: '🎤' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ],
  officer: [
    { to: '/home', label: 'Home', icon: '🏠' },
    { to: '/officer', label: 'District', icon: '🏛️' },
    { to: '/field', label: 'Register', icon: '📋' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
  ],
};
