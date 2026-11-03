import {lazy,Suspense,useEffect,useState} from 'react';
const Analytics=lazy(()=>import('@vercel/analytics/react').then(m=>({default:m.Analytics})));
export default function DeferredAnalytics(){
 const [ready,setReady]=useState(false);
 useEffect(()=>{if(!navigator.onLine)return;const id=setTimeout(()=>setReady(true),4000);return()=>clearTimeout(id);},[]);
 return ready?<Suspense fallback={null}><Analytics/></Suspense>:null;
}
