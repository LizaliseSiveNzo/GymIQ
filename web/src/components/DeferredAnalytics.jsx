import {Component,useEffect,useState} from 'react';
// Optional telemetry must never unmount the app if its script or render fails.
export class AnalyticsBoundary extends Component{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?null:this.props.children;}
}
export default function DeferredAnalytics(){
 const [Analytics,setAnalytics]=useState(null);
 useEffect(()=>{
  if(!navigator.onLine)return;
  let active=true;
  const id=setTimeout(()=>{
   // Do not throw a rejected lazy import through the entire React root.
   void import('@vercel/analytics/react').then(module=>{if(active)setAnalytics(()=>module.Analytics);}).catch(()=>{/* The workout continues without telemetry. */});
  },4000);
  return()=>{active=false;clearTimeout(id);};
 },[]);
 return Analytics?<AnalyticsBoundary><Analytics/></AnalyticsBoundary>:null;
}
