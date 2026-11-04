import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {supabase} from '../../lib/supabaseClient.js';
export default function OwnerDashboardLink({userId}){
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let active=true;setAllowed(false);if(userId&&navigator.onLine)void supabase.functions.invoke('owner-dashboard',{body:{action:'status'}}).then(({data,error})=>{if(active)setAllowed(!error&&data?.enabled===true);}).catch(()=>{});return()=>{active=false;};},[userId]);
 return allowed?<Link className="btn btn-secondary btn-block" style={{marginBottom:20}} to="/owner">Owner dashboard ↗</Link>:null;
}
