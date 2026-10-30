import {useEffect,useId,useRef} from 'react';
import {Link} from 'react-router-dom';
import './bankMenu.css';

export const BANK_SECTIONS={home:'Calorie overview',goals:'Monthly goal',plan:'Daily meal plan',quick:'Favourites & recent meals',builder:'Meal builder',diary:'Food diary',barcode:'Barcode lookup',weight:'Weight check-ins',insights:'Food & calorie insights',sources:'Estimates & food sources'};
export function bankSection(search){const value=search.get('section');if(value==='summary')return 'home';return Object.hasOwn(BANK_SECTIONS,value)?value:search.get('goals')==='1'?'goals':'home';}
const groups=[{label:'Food & logging',keys:['home','plan','quick','builder','diary','barcode']},{label:'Goals & progress',keys:['goals','weight','insights']},{label:'About the numbers',keys:['sources']}];
export default function BankMenu({section}){
 const details=useRef(null),menuId=useId();
 useEffect(()=>{
  function outside(event){if(details.current&&!details.current.contains(event.target))details.current.open=false;}
  function escape(event){if(event.key==='Escape'&&details.current?.open){event.preventDefault();details.current.open=false;details.current.querySelector('summary')?.focus();}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 const close=()=>{if(details.current)details.current.open=false;};
 return <details ref={details} className="bank-tools" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))event.currentTarget.open=false;}}>
  <summary aria-label="Calorie Bank menu" aria-controls={menuId}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg><span>Menu</span></summary>
  <nav id={menuId} className="bank-tools-panel" aria-label="Calorie Bank sections">{groups.map(group=><div key={group.label}><span className="bank-tools-group">{group.label}</span>{group.keys.map(key=><Link key={key} to={key==='home'?'/bank':`/bank?section=${key}`} aria-current={section===key?'page':undefined} onClick={close}><span>{BANK_SECTIONS[key]}</span><span aria-hidden="true">{section===key?'✓':'↗'}</span></Link>)}{group.label==='Goals & progress'&&<Link to="/workout/check-in" onClick={close}><span>Weekly check-in</span><span aria-hidden="true">↗</span></Link>}</div>)}</nav>
 </details>;
}
