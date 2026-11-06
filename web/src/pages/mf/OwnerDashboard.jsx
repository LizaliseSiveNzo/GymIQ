import OwnerAccessCodes from '../../components/ui/OwnerAccessCodes.jsx';
import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {QRCodeSVG} from 'qrcode.react';
import TabShell from '../../shell/TabShell.jsx';
import {supabase} from '../../lib/supabaseClient.js';
import {useAuth} from '../../context/AuthContext.jsx';
import {referralLink} from '../../lib/referrals.js';
import './ownerDashboard.css';

const money=cents=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(Number(cents||0)/100);
const count=n=>Number(n||0).toLocaleString('en-ZA');
const date=value=>value?new Intl.DateTimeFormat('en-ZA',{day:'numeric',month:'short',year:'numeric',timeZone:'Africa/Johannesburg'}).format(new Date(value)):'—';
const percent=(value,total)=>total?`${Math.round(value/total*100)}%`:'—';

export function OwnerReport({data,loading,error,filters,onFilters,onRefresh}){
 const [metric,setMetric]=useState('active'),[selected,setSelected]=useState(null);
 const [source,setSource]=useState(''),[share,setShare]=useState(''),[message,setMessage]=useState('');
 const s=data?.summary||{},daily=data?.daily||[],maximum=Math.max(1,...daily.map(d=>Number(d[metric])));
 const selectedDay=daily.find(d=>d.day===selected);
 const stats=[['Total customers',count(s.total_users),'Owner and test accounts excluded'],['New sign-ups',count(s.signups_7d),'Last 7 calendar days'],['Weekly active',count(s.active_7d),'Logged a workout or food · 7 days'],['Paying members',count(s.paying_members),'Active access with a live payment'],['Revenue',money(s.revenue_30d_cents),'Confirmed live payments · 30 days'],['Renewals due',count(s.renewals_due_7d),'Paid access expires within 7 days']];
 function generate(event){event.preventDefault();try{setShare(referralLink(source));setMessage('');}catch(e){setMessage(e.message);}}
 async function copy(){try{await navigator.clipboard.writeText(share);setMessage('Link copied.');}catch{setMessage('Select and copy the link below.');}}
 return <div className="owner-dashboard">
  <div className="owner-intro"><div><span className="owner-eyebrow">GYMIQ BUSINESS</span><p className="subtle">See who joins, returns and renews.</p></div><button className="btn btn-secondary" disabled={loading} onClick={onRefresh}>{loading?'Refreshing…':'Refresh'}</button></div>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {!data&&loading&&<p role="status">Loading your business report…</p>}
  {data&&<>
   <OwnerAccessCodes/>
   <p className="owner-updated subtle">Updated {new Intl.DateTimeFormat('en-ZA',{hour:'2-digit',minute:'2-digit',timeZone:'Africa/Johannesburg'}).format(new Date(data.as_of))} SAST · {count(data.excluded_accounts)} owner/test accounts excluded</p>
   <div className="owner-metrics">{stats.map(([label,value,detail])=><section className="mf-card" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></section>)}</div>
   <section className="mf-card owner-trends"><div className="owner-section-heading"><h2>Growth & activity</h2><div className="owner-segments">{[['active','Active users'],['signups','Sign-ups']].map(([key,label])=><button key={key} type="button" className={`btn ${metric===key?'btn-primary':'btn-ghost'}`} aria-pressed={metric===key} onClick={()=>{setMetric(key);setSelected(null);}}>{label}</button>)}</div></div><p className="subtle">Last 28 days · South African calendar dates</p>
    <div className="owner-chart" role="group" aria-label={`Daily ${metric==='active'?'active users':'sign-ups'}`}>{daily.map(d=><button type="button" key={d.day} aria-label={`${date(d.day+'T12:00:00Z')}: ${d[metric]} ${metric==='active'?'active users':'sign-ups'}`} aria-pressed={selected===d.day} onClick={()=>setSelected(d.day)}><span style={{height:`${Math.max(2,Number(d[metric])/maximum*100)}%`}}/></button>)}</div>
    <div className="owner-chart-axis"><span>{date(daily[0]?.day+'T12:00:00Z')}</span><span>{date(daily.at(-1)?.day+'T12:00:00Z')}</span></div>
    <p className="owner-chart-detail" aria-live="polite">{selectedDay?`${date(selectedDay.day+'T12:00:00Z')} · ${selectedDay.active} active users · ${selectedDay.signups} sign-ups`:'Tap a bar to view its daily totals.'}</p>
    <div className="owner-mini-stats"><div><strong>{count(s.active_30d)}</strong><span>Active · 30 days</span></div><div><strong>{percent(s.first_workout_completed,s.total_users)}</strong><span>Completed a first workout</span></div><div><strong>{percent(s.week2_returned,s.week2_cohort)}</strong><span>Week-two return · {count(s.week2_returned)}/{count(s.week2_cohort)}</span></div></div>
   </section>
   <div className="owner-panels"><section className="mf-card"><h2>Memberships & payments</h2><dl className="owner-key-values"><div><dt>Active trials</dt><dd>{count(s.trial_members)}</dd></div><div><dt>Free · premium ended</dt><dd>{count(s.expired_members)}</dd></div><div><dt>Invited premium members</dt><dd>{count(s.invite_members)}</dd></div><div><dt>Renewal payments · 30 days</dt><dd>{count(s.renewal_payments_30d)}</dd></div><div><dt>Total confirmed revenue</dt><dd>{money(s.revenue_total_cents)}</dd></div></dl><p className="subtle">Gross payments before fees or refunds. Manual renewals are counted when paid, rather than projected as recurring revenue.</p><button className="btn btn-secondary" onClick={()=>{onFilters({...filters,status:'paid',page:0});document.getElementById('owner-users')?.scrollIntoView({behavior:'smooth'});}}>View paying members</button></section>
   <section className="mf-card"><h2>Where customers come from</h2>{data.sources.length?<ul className="owner-sources">{data.sources.map(r=><li key={r.source}><span>{r.source==='unknown'?'Unknown · earlier sign-ups':r.source==='direct'?'Direct / no referral':r.source}</span><strong>{count(r.signups)} <small>sign-ups · {count(r.paying_members)} paid</small></strong></li>)}</ul>:<p className="subtle">Referral sources will appear when your first customers sign up.</p>}</section></div>
   <section className="mf-card owner-referrals"><h2>Share a referral link</h2><p className="subtle">Use a different code for WhatsApp, each gym or each trainer. Tracks the first valid referral within 30 days before sign-up.</p><form onSubmit={generate}><label>Source code<input maxLength={64} placeholder="e.g. trainer-senzo" value={source} onChange={event=>setSource(event.target.value)} required/></label><button type="submit" className="btn btn-primary">Create link & QR</button></form>{share&&<div className="owner-share"><QRCodeSVG value={share} size={136} bgColor="#ffffff" fgColor="#111111" marginSize={3}/><div><label>Shareable link<input readOnly value={share} onFocus={event=>event.target.select()}/></label><button type="button" className="btn btn-secondary" onClick={copy}>Copy link</button></div></div>}{message&&<p role="status">{message}</p>}</section>
   <section id="owner-users" className="mf-card"><div className="owner-section-heading"><h2>Customers</h2><span className="subtle">{count(data.user_count)} results</span></div><form className="owner-user-filters" onSubmit={event=>event.preventDefault()}><label>Search name or email<input type="search" maxLength={100} value={filters.search} placeholder="Find a customer" onChange={event=>onFilters({...filters,search:event.target.value,page:0})}/></label><label>Membership<select value={filters.status} onChange={event=>onFilters({...filters,status:event.target.value,page:0})}>{[['all','All memberships'],['paid','Paying'],['trial','Trial'],['invite','Invited premium'],['expired','Free · premium ended'],['none','No paid access']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label></form><label className="owner-test-toggle"><input type="checkbox" checked={filters.include_test} onChange={event=>onFilters({...filters,include_test:event.target.checked,page:0})}/>Show owner/test accounts in this list</label>
    {loading?<p role="status">Updating customer list…</p>:data.users.length?<div className="owner-user-list">{data.users.map(u=><article key={u.id}><div className="owner-user-name"><strong>{u.name||'Unnamed customer'}</strong><span className={`owner-status is-${u.membership}`}>{u.excluded?'Owner / test':u.membership==='none'?'No paid access':u.membership}</span></div><p>{u.email}</p><dl><div><dt>Joined</dt><dd>{date(u.created_at)}</dd></div><div><dt>Last logged activity</dt><dd>{date(u.last_activity)}</dd></div><div><dt>Access until</dt><dd>{date(u.expires_at)}</dd></div><div><dt>Finished workouts</dt><dd>{count(u.completed_workouts)}</dd></div><div><dt>Source</dt><dd>{u.source}</dd></div></dl></article>)}</div>:<p className="owner-empty subtle">{s.total_users?'No customers match these filters.':'Your first customers will appear here. Owner and test accounts are excluded from business totals.'}</p>}
    <div className="owner-pagination"><button type="button" className="btn btn-secondary" disabled={loading||filters.page===0} onClick={()=>onFilters({...filters,page:filters.page-1})}>Previous</button><span>Page {filters.page+1} of {Math.max(1,Math.ceil(data.user_count/25))}</span><button type="button" className="btn btn-secondary" disabled={loading||(filters.page+1)*25>=data.user_count} onClick={()=>onFilters({...filters,page:filters.page+1})}>Next</button></div>
   </section>
   <details className="mf-card owner-methods"><summary>How these figures work & reliability reports</summary><p>Activity means a synced finished workout or saved food entry, not simply opening the app. Offline records appear after syncing. Cancelled workouts and mock records are excluded. Week-two return uses customers who joined 14–20 days ago and logged activity during days 7–13 after joining; a dash means there is no eligible cohort yet.</p><p>Reliability reports cover reported sync and workout-save failures over 28 days, starting with this update. Repeated reports are limited to one per user/category every 10 minutes. Unreported and fully offline failures may not appear.</p>{['sync_failed','workout_save_failed'].map(kind=>{const r=data.reliability.find(r=>r.kind===kind);return <p key={kind}>{kind==='sync_failed'?'Sync':'Workout save'}: {count(r?.reports)} reports · {count(r?.affected_users)} affected users</p>;})}</details>
  </>}
 </div>;
}

export default function OwnerDashboard(){
 const {profile}=useAuth();
 const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[denied,setDenied]=useState(false);
 const [filters,setFilters]=useState({search:'',status:'all',include_test:false,page:0}),[refresh,setRefresh]=useState(0);
 const request=useRef(0);
 useEffect(()=>{
  const version=++request.current;let active=true;setLoading(true);setError('');
  const timer=setTimeout(async()=>{
   if(!navigator.onLine){if(active){setData(null);setError('Connect to load the owner dashboard.');setLoading(false);}return;}
   try{const {data,error}=await supabase.functions.invoke('owner-dashboard',{body:{action:'report',...filters}});if(!active||version!==request.current)return;if(error){if(error.context?.status===403){setDenied(true);setData(null);return;}throw error;}setDenied(false);setData(data);}
   catch{if(active&&version===request.current){setData(null);setError('Could not load your business report. Try Refresh.');}}
   finally{if(active&&version===request.current)setLoading(false);}
  },filters.search?350:0);
  return()=>{active=false;clearTimeout(timer);};
 },[profile?.id,filters,refresh]);
 return <TabShell active="more" title="Owner dashboard"><Link className="btn btn-ghost" to="/more">← Account</Link>{denied?<section className="mf-card"><h1>Owner access required</h1><p>This dashboard is available only to the GymIQ owner.</p></section>:<OwnerReport data={data} loading={loading} error={error} filters={filters} onFilters={setFilters} onRefresh={()=>setRefresh(n=>n+1)}/>}</TabShell>;
}
