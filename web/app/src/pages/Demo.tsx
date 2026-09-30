/**
 * `#/demo` — seed a district's worth of rows and drop into the officer console.
 *
 * For showing the console with data in it, and for screenshots. The rows are labelled as demo
 * data on the console itself; this route never pretends to be a real register.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { seedDemo } from '../lib/demo';
import { setRole, type Role } from '../lib/role';
import { openStore } from '../lib/db';
import { ONBOARDED_KEY } from './Onboarding';

export default function Demo({ onRole }: { onRole: (r: Role) => void }) {
  const nav = useNavigate();
  const [note, setNote] = useState('Seeding a district…');

  useEffect(() => {
    void (async () => {
      try {
        const n = await seedDemo();
        const store = await openStore();
        await store.set(ONBOARDED_KEY, true);
        await setRole('district_officer');
        onRole('district_officer');
        setNote(`Seeded ${n} beneficiaries.`);
        nav('/officer', { replace: true });
      } catch (e) {
        setNote(`Seed failed: ${String(e)}`);
      }
    })();
  }, [nav, onRole]);

  return (
    <div className="flex min-h-dvh items-center justify-center p-6 text-center text-sand-700">
      {note}
    </div>
  );
}
