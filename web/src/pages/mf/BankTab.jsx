/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import TabShell from '../../shell/TabShell.jsx';
import CalorieBank from '../../components/CalorieBank.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import AiReviewCard from '../../components/ui/AiReviewCard.jsx';

// Calorie Bank tab — full setup, balance ring, food/exercise logging, and ledger.
export default function BankTab() {
  const { session, profile } = useAuth();
  if (session?.demo || !profile) {
    return <TabShell active="bank" title="Calorie Bank"><div className="mf-card">Loading…</div></TabShell>;
  }
  return (
    <TabShell active="bank" title="Calorie Bank">
      <p className="bank-intro">Fuel the work you put in. Log food and activity, and keep your calorie balance in view.</p>
      <CalorieBank clientId={profile.id} />
      <AiReviewCard domain="nutrition"/>
    </TabShell>
  );
}
