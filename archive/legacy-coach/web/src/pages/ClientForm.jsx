/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import AppShell from '../components/AppShell.jsx';
import FormCheck from '../components/FormCheck.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function ClientForm() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) return <AppShell role="player" active="Form AI" title="Form AI"><div className="card">Loading…</div></AppShell>;
  return <AppShell role="player" active="Form AI" title="Form check"><FormCheck clientId={profile.id} /></AppShell>;
}
