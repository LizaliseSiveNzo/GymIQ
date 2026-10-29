import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient.js';
import { localDay } from '../../../../supabase/functions/_shared/nutrition/planner.js';
export default function CalorieBankCard({userId}){
 const [day,setDay]=useState(null),[error,setError]=useState(false);
 useEffect(()=>{let active=true;supabase.rpc('nutrition_period',{p_day:localDay(),p_offset:new Date().getTimezoneOffset()}).then(({data,error})=>{if(active){setError(!!error);setDay(data?.find(d=>d.day===localDay())||{});}});return()=>{active=false;};},[userId]);
 return <section className="mf-card"><div className="row between"><h4>Calorie Bank</h4><Link to="/bank">Food & goals →</Link></div>{error?<p className="subtle">Open Calorie Bank to reload your records.</p>:day===null?<p className="subtle">Loading…</p>:<><p style={{fontSize:24,fontWeight:800,marginBottom:4}}>{Number(day.kcal||0).toLocaleString()} <small style={{fontSize:13,fontWeight:400}}>kcal logged today</small></p><p className="subtle">{day.target?`${Number(day.target).toLocaleString()} kcal daily guide · estimate`:'Set your monthly goal for a daily calorie guide.'}</p></>}<Link to="/bank" className="btn btn-secondary">Build a meal / log food</Link></section>;
}
