/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import TabShell from '../../shell/TabShell.jsx';
import NutritionHub from '../../components/NutritionHub.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import AiReviewCard from '../../components/ui/AiReviewCard.jsx';

// Food planning and actual intake share one dated calorie guide.
export default function BankTab() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) {
    return <TabShell active="bank" title="Calorie Bank"><div className="mf-card">Loading…</div></TabShell>;
  }
  return (
    <TabShell active="bank" title="Calorie Bank">
      <p className="bank-intro">Build meals, track the extras and keep your longer-term goal in view.</p>
      <NutritionHub userId={profile.id} />
      <AiReviewCard domain="nutrition"/>
    </TabShell>
  );
}
