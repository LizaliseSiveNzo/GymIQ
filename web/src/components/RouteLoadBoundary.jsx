import {Component} from 'react';
export default class RouteLoadBoundary extends Component{
 state={error:false};
 static getDerivedStateFromError(){return {error:true};}
 render(){if(!this.state.error)return this.props.children;
  return <main className="container" style={{padding:'40px 20px'}}><h1>This screen needs a connection</h1><p>Reconnect to download this screen or load the latest app update. Your queued logs stay on this device.</p><a className="btn btn-primary" href="/workout">Open saved training</a><button className="btn btn-secondary" onClick={()=>window.location.reload()}>Try again</button></main>;
 }
}
