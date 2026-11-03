import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
// Precache only the shell and everyday read/logging screens, after first paint.
// Optional AI, onboarding and analytics chunks stay on-demand.
export function offlinePlugin(){return {name:'gymiq-offline-shell',enforce:'post',generateBundle(options,bundle){
 const paths=new Set(['/index.html','/manifest.webmanifest','/app-icon.svg']);
 const visit=file=>{
  if(paths.has('/'+file))return;
  const chunk=bundle[file];if(!chunk)return;
  paths.add('/'+file);
  if(chunk.type==='chunk'){
   chunk.imports.forEach(visit);
   for(const css of chunk.viteMetadata?.importedCss||[])paths.add('/'+css);
  }
 };
 for(const chunk of Object.values(bundle))if(chunk.type==='chunk'&&(chunk.isEntry||['WorkoutTab','BankTab','WorkoutSummary','SessionPlayer','HistoryList','HistoryDetail','Login','MoreMenu','Privacy'].includes(chunk.name)))visit(chunk.fileName);
 const precache=[...paths].sort();
 const template=readFileSync(new URL('./service-worker.js',import.meta.url),'utf8');
 const version=createHash('sha256').update(JSON.stringify(precache)+String(bundle['index.html']?.source||'')+template+readFileSync(new URL('../public/manifest.webmanifest',import.meta.url),'utf8')+readFileSync(new URL('../public/app-icon.svg',import.meta.url),'utf8')).digest('hex').slice(0,16);
 this.emitFile({type:'asset',fileName:'sw.js',source:template.replace('__BUILD_ID__',version).replace('__PRECACHE__',JSON.stringify(precache))});
 }};}
