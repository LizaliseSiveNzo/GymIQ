import {useEffect,useState} from 'react';
import {loadMembership,savedMembership} from '../lib/membership.js';
import {hasPremium} from '../lib/premium.js';
export default function useMembership(userId){
 const [state,setState]=useState(()=>({userId,member:savedMembership(userId)?.data||null,checking:true,error:''}));
 const [now,setNow]=useState(Date.now());
 useEffect(()=>{
  if(!userId)return;
  let alive=true;
  const saved=savedMembership(userId)?.data||null;
  setState({userId,member:saved,checking:navigator.onLine,error:''});
  const load=()=>{
   if(!navigator.onLine){setState(s=>({...s,checking:false}));return;}
   setState(s=>({...s,checking:true,error:''}));
   loadMembership(userId).then(member=>{if(alive)setState({userId,member,checking:false,error:''});}).catch(e=>{if(alive)setState(s=>({...s,checking:false,error:e.message}));});
  };
  const refresh=()=>{const member=savedMembership(userId)?.data;if(member)setState({userId,member,checking:false,error:''});else load();};
  load();window.addEventListener('online',load);window.addEventListener('gymiq-membership-updated',refresh);
  const interval=setInterval(()=>setNow(Date.now()),30000);
  return()=>{alive=false;clearInterval(interval);window.removeEventListener('online',load);window.removeEventListener('gymiq-membership-updated',refresh);};
 },[userId]);
 const matching=state.userId===userId;
 return {...state,member:matching?state.member:null,checking:!matching||state.checking,premium:matching&&hasPremium(state.member,now)};
}
