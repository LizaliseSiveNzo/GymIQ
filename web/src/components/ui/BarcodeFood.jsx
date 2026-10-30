import {useEffect,useRef,useState} from 'react';
import {supabase} from '../../lib/supabaseClient.js';
import {validBarcode,barcodePortion} from '../../../../supabase/functions/_shared/nutrition/barcode.js';
export default function BarcodeFood({onUse,disabled=false,expanded=false}){
 const [barcode,setBarcode]=useState(''),[product,setProduct]=useState(null),[amount,setAmount]=useState('100'),[unit,setUnit]=useState('g'),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[scanning,setScanning]=useState(false);
 const video=useRef(null),stream=useRef(null),scanTimer=useRef(null),mounted=useRef(true);
 function stop(){clearTimeout(scanTimer.current);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;setScanning(false);}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(scanTimer.current);stream.current?.getTracks().forEach(t=>t.stop());};},[]);
 async function lookup(event){event.preventDefault();if(busy||disabled)return;setError('');setProduct(null);setConfirmed(false);
  if(!validBarcode(barcode)){setError('Check the barcode: use its 8, 12, 13 or 14 digits, including the final check digit.');return;}
  setBusy(true);try{const {data,error}=await supabase.functions.invoke('gymiq-barcode',{body:{barcode}});if(error){let message;try{message=(await error.context.json()).error;}catch{/* network failure */}throw Error(message||'Lookup unavailable. Enter the package label calories instead.');}if(data.error)throw Error(data.error);setProduct(data.product);setUnit(data.product.unit||'g');setAmount('100');}catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function start(){setError('');
  if(!('BarcodeDetector' in window)){setError('Camera scanning is unavailable in this browser. Enter the barcode digits below.');return;}
  try{
   const formats=(await window.BarcodeDetector.getSupportedFormats()).filter(f=>['ean_13','ean_8','upc_a','itf'].includes(f));if(!formats.length)throw Error('No supported barcode format');
   const media=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
   if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}stream.current=media;setScanning(true);
   const detector=new window.BarcodeDetector({formats});
   const detect=async()=>{if(!mounted.current||!stream.current)return;try{if(video.current){video.current.srcObject=media;await video.current.play();const values=await detector.detect(video.current);const match=values.find(v=>validBarcode(v.rawValue));if(match){setBarcode(match.rawValue);stop();return;}}}catch{/* wait for a clear frame */}scanTimer.current=setTimeout(detect,350);};void detect();
  }catch{stop();setError('Camera could not open. Enter the barcode digits below.');}
 }
 let kcal=null;try{if(product)kcal=barcodePortion(product,amount);}catch{/* show usable portion before selection */}
 const Container=expanded?'section':'details';
 return <Container className="mf-card">{expanded?<h2>Find packaged food by barcode</h2>:<summary>Find packaged food by barcode</summary>}<p className="subtle">Look up a product, check its label and choose your portion. Only the barcode is sent to Open Food Facts through GymIQ.</p>
  <div className="launch-actions"><button className="btn btn-secondary" disabled={disabled||busy||scanning} onClick={start}>Scan with camera</button>{scanning&&<button className="btn btn-ghost" onClick={stop}>Stop camera</button>}</div>{scanning&&<video ref={video} className="barcode-video" playsInline muted/>}
  <form className="barcode-form nutrition-form" onSubmit={lookup}><label>Barcode digits<input inputMode="numeric" maxLength="14" value={barcode} onChange={e=>{setBarcode(e.target.value.replace(/\D/g,''));setProduct(null);setConfirmed(false);}} required/></label><button className="btn btn-secondary" disabled={disabled||busy}>{busy?'Looking up…':'Look up barcode'}</button></form>
  {error&&<p className="inline-error" role="alert">{error}</p>}
  {product&&<div className="barcode-result"><h3>{product.name}</h3><p className="subtle">{product.brand} · {product.kcal_per_100} kcal per 100 {product.unit||'g/ml'} as declared in the source. {product.serving?`Listed serving: ${product.serving}.`:''}</p><a href={product.source_url} target="_blank" rel="noreferrer">Open Food Facts product record ↗</a><div className="nutrition-fields"><label>Amount eaten<input type="number" min="0.1" max="3000" step="0.1" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Unit on the nutrition label<select value={unit} onChange={e=>setUnit(e.target.value)}><option value="g">Grams · per 100 g label</option><option value="ml">Millilitres · per 100 ml label</option></select></label></div><label className="nutrition-check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>The product and calories per 100 {unit} match my package label.</label><p>Portion: <strong>{kcal==null?'Check amount':`${kcal} kcal`}</strong></p><button className="btn btn-primary" disabled={disabled||!confirmed||kcal==null} onClick={()=>onUse({name:`${product.name} (${amount} ${unit})`.slice(0,100),kcal})}>Use in meal builder</button></div>}
  <p className="subtle">Product coverage varies, including South African brands. Community data can be incomplete; use the package label if values differ. Data: <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">Open Food Facts</a> · <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer">ODbL</a>.</p>
 </Container>;
}
