import {useEffect,useId,useRef,useState} from 'react';
import {chartScale} from '../../lib/trainingAnalytics.js';
const dateLabel=date=>new Date(date).toLocaleDateString(undefined,{day:'numeric',month:'short'});
export default function TrainingLineChart({points,metric='load',name}){
 const box=useRef(null),[width,setWidth]=useState(640),[selected,setSelected]=useState(Math.max(0,points.length-1));
 const gradient=`training-fill-${useId().replace(/:/g,'')}`;
 useEffect(()=>{if(!box.current)return;const resize=()=>setWidth(Math.max(280,Math.floor(box.current.clientWidth)));resize();if(typeof ResizeObserver==='undefined')return;const observer=new ResizeObserver(resize);observer.observe(box.current);return()=>observer.disconnect();},[]);
 useEffect(()=>setSelected(Math.max(0,points.length-1)),[points]);
 const point=points[Math.min(selected,points.length-1)],unit=metric==='load'?'kg':'reps',field=metric==='load'?'load':'bestReps';
 const h=260,left=46,right=16,top=20,bottom=44,plotW=Math.max(1,width-left-right),plotH=h-top-bottom;
 const {max,ticks}=chartScale(points.map(p=>p[field]));
 const first=points.length?Date.parse(points[0].date):0,last=points.length?Date.parse(points[points.length-1].date):0;
 const x=p=>left+(last===first?plotW/2:(Date.parse(p.date)-first)/(last-first)*plotW),y=p=>top+plotH-p[field]/max*plotH;
 const coords=points.map(p=>`${x(p)},${y(p)}`).join(' '),dates=[...new Set([0,Math.floor((points.length-1)/2),points.length-1])].filter(i=>i>=0);
 return <div ref={box} className="analytics-line-chart">
  {!points.length?<div className="analytics-empty">No completed sets for this exercise in the selected period.</div>:<>
   <svg viewBox={`0 0 ${width} ${h}`} width="100%" height={h} role="img" aria-label={`${name}: ${metric==='load'?'heaviest working-set load':'highest recorded reps'} over ${points.length} sessions`}>
    <title>{name} · {unit} by completed session</title><defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c4ff31" stopOpacity=".2"/><stop offset="100%" stopColor="#c4ff31" stopOpacity="0"/></linearGradient></defs>
    {ticks.map(t=><g key={t}><line x1={left} x2={width-right} y1={top+plotH-t/max*plotH} y2={top+plotH-t/max*plotH} stroke="currentColor" opacity=".12"/><text x={left-9} y={top+plotH-t/max*plotH+4} textAnchor="end" className="analytics-axis">{t}</text></g>)}
    {points.length>1&&<polygon points={`${x(points[0])},${top+plotH} ${coords} ${x(points[points.length-1])},${top+plotH}`} fill={`url(#${gradient})`}/>}
    <polyline points={coords} fill="none" stroke="#c4ff31" strokeWidth="2.5" strokeLinejoin="round"/>
    {point&&<line x1={x(point)} x2={x(point)} y1={top} y2={top+plotH} stroke="#c4ff31" strokeDasharray="3 5" opacity=".3"/>}
    {points.map((p,i)=><g key={p.id} onMouseEnter={()=>setSelected(i)} onClick={()=>setSelected(i)}><circle cx={x(p)} cy={y(p)} r="12" fill="transparent"/><circle cx={x(p)} cy={y(p)} r={i===selected?5:3.5} fill={i===selected?'#fff':'#c4ff31'} stroke="#171717" strokeWidth="2"/><title>{dateLabel(p.date)} · {p[field]} {unit}</title></g>)}
    {dates.map(i=><text key={i} x={x(points[i])} y={h-13} textAnchor={points.length===1?'middle':i===0?'start':i===points.length-1?'end':'middle'} className="analytics-axis">{dateLabel(points[i].date)}</text>)}
   </svg>
   <div className="analytics-point-info" aria-live="polite"><strong>{point?metric==='load'?`${point.load} kg × ${point.loadReps} reps`:`${point.bestReps} reps at ${point.repsLoad} kg`:'—'}</strong><span>{point&&new Date(point.date).toLocaleString()} · {point?.sets} working sets</span></div>
   <label className="analytics-inspect">Inspect a session<select value={Math.min(selected,points.length-1)} onChange={e=>setSelected(Number(e.target.value))}>{points.map((p,i)=><option key={p.id} value={i}>{new Date(p.date).toLocaleString()} · {p[field]} {unit}</option>)}</select></label>
   <details className="analytics-data-table"><summary>View graph data</summary><div className="analytics-table-scroll"><table><thead><tr><th scope="col">Session</th><th scope="col">Top load</th><th scope="col">Reps at load</th><th scope="col">Best reps</th><th scope="col">Sets</th></tr></thead><tbody>{points.map(p=><tr key={p.id}><th scope="row">{new Date(p.date).toLocaleString()}</th><td>{p.load} kg</td><td>{p.loadReps}</td><td>{p.bestReps}</td><td>{p.sets}</td></tr>)}</tbody></table></div></details>
  </>}
 </div>;
}
