/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import {useEffect} from 'react';
import {useSearchParams} from 'react-router-dom';
import TabShell from '../../shell/TabShell.jsx';
import NutritionHub from '../../components/NutritionHub.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import BankMenu,{bankSection} from '../../components/ui/BankMenu.jsx';

// Food planning and actual intake share one dated calorie guide.
export default function BankTab() {
  const { session, profile } = useAuth();
  const [search,setSearch]=useSearchParams();
  const section=bankSection(search);
  useEffect(()=>{window.scrollTo({top:0});},[section]);
  const navigateSection=next=>{if(next!==section)setSearch(next==='home'?{}:{section:next});};
  if (session?.demo || !profile) {
    return <TabShell active="bank" title="Calorie Bank"><div className="mf-card">Loading…</div></TabShell>;
  }
  return (
    <TabShell active="bank" title="Calorie Bank">
      <div className="bank-page-intro"><p className="bank-intro">Build meals, track the extras and keep your longer-term goal in view.</p><BankMenu section={section}/></div>
      {section!=='home'&&<button className="btn btn-ghost bank-section-back" onClick={()=>navigateSection('home')}>← Calorie overview</button>}
      <NutritionHub userId={profile.id} section={section} onSectionChange={navigateSection}/>
    </TabShell>
  );
}
