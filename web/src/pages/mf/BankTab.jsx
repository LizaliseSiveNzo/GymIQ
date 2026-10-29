/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import {Link,useSearchParams} from 'react-router-dom';
import './weeklyCheckIn.css';
import TabShell from '../../shell/TabShell.jsx';
import NutritionHub from '../../components/NutritionHub.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import AiReviewCard from '../../components/ui/AiReviewCard.jsx';

// Food planning and actual intake share one dated calorie guide.
export default function BankTab() {
  const { session, profile } = useAuth();
  const [search]=useSearchParams();
  if (session?.demo || !profile) {
    return <TabShell active="bank" title="Calorie Bank"><div className="mf-card">Loading…</div></TabShell>;
  }
  return (
    <TabShell active="bank" title="Calorie Bank">
      <p className="bank-intro">Build meals, track the extras and keep your longer-term goal in view.</p>
      <Link className="mf-card checkin-entry" to="/workout/check-in"><span><strong>Your weekly check-in</strong><small>See your food log alongside training & weight trends</small></span><span aria-hidden="true">↗</span></Link>
      <NutritionHub userId={profile.id} openGoals={search.get('goals')==='1'} />
      <AiReviewCard domain="nutrition"/>
    </TabShell>
  );
}
