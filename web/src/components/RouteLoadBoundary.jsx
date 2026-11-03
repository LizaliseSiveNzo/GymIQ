import {Component} from 'react';
import {claimScreenRecovery,isScreenDownloadError,refreshScreen} from '../lib/screenRecovery.js';
export default class RouteLoadBoundary extends Component{
 state={error:null,retrying:false};
 static getDerivedStateFromError(error){return {error};}
 componentDidCatch(error){
  try{if(navigator.onLine&&isScreenDownloadError(error)&&claimScreenRecovery(sessionStorage,window.location.pathname+window.location.search))this.retry();}catch{/* Manual recovery remains available if browser storage is blocked. */}
 }
 retry=()=>{if(this.state.retrying)return;this.setState({retrying:true});void refreshScreen();};
 render(){if(!this.state.error)return this.props.children;
  const download=isScreenDownloadError(this.state.error),offline=!navigator.onLine;
  return <main className="container" style={{padding:'40px 20px'}}>
   <h1>{this.state.retrying?'Updating this screen…':download&&offline?'This screen isn’t saved on this device yet':'This screen couldn’t open'}</h1>
   <p>{download&&offline?'Connect to download it, then try again.':download?'An app update or interrupted download may have prevented this screen from opening. Try again to load the current version.':'The screen encountered an unexpected problem. Try again, or return to training.'} Your queued logs stay on this device. Workouts already saved can be found in History.</p>
   <div style={{display:'flex',flexWrap:'wrap',gap:12}}><a className="btn btn-primary" href="/workout">Return to training</a><button className="btn btn-secondary" disabled={this.state.retrying} onClick={this.retry}>{this.state.retrying?'Opening…':'Try again'}</button></div>
  </main>;
 }
}
