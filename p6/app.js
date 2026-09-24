"use strict";
/* ================= Utilidades ================= */
const $ = (id) => document.getElementById(id);
function el(tag, cls, html){ const e=document.createElement(tag); if(cls) e.className=cls; if(html!==undefined) e.innerHTML=html; return e; }
function esc(s){ return s==null?'':String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(m){ const t=$('toast'); t.textContent=m; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2400); }
function todayISO(){ const d=new Date(),p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function nowTs(){ return new Date().toISOString(); }
function lsGet(k){ try{return localStorage.getItem(k)}catch(e){return null} }
function lsSet(k,v){ try{localStorage.setItem(k,v)}catch(e){} }

/* Pies-pulgadas → pulgadas decimales. Acepta 41'-1", 8'-9 3/4", 5 5/8, 0.625, 13'-10 13/16 */
function parseIn(raw){
  if(raw===null||raw===undefined) return NaN;
  if(typeof raw==='number') return isFinite(raw)?raw:NaN;
  let s=String(raw).trim(); if(!s) return NaN;
  s=s.replace(/[’‘´`′]/g,"'").replace(/[”“″]/g,'"').replace(/,/g,'.');
  s=s.replace(/pies|pie|feet|ft/gi,"'").replace(/pulgadas?|pulg\.?|inches|inch|in\b/gi,'"');
  let neg=false; if(/^-/.test(s)&&!/'/.test(s)){neg=true;s=s.slice(1);}
  let feet=0; const fm=s.match(/(\d+(?:\.\d+)?)\s*'/); if(fm){feet=parseFloat(fm[1]); s=s.replace(fm[0],' ');}
  s=s.replace(/"/g,' ').replace(/-/g,' ').trim();
  let inches=0;
  if(s){ let frac=0; const fr=s.match(/(\d+)\s*\/\s*(\d+)/); if(fr){ frac=parseInt(fr[1],10)/parseInt(fr[2],10); s=s.replace(fr[0],' '); }
    const wm=s.match(/\d*\.\d+|\d+/); const whole=wm?parseFloat(wm[0]):0; inches=whole+frac; }
  const v=feet*12+inches; if(!isFinite(v)) return NaN; return neg?-v:v;
}
function parseNum(raw){ if(raw===null||raw===undefined||raw==='') return NaN; const f=parseFloat(String(raw).replace(',','.').replace(/[^0-9.\-]/g,'')); return isFinite(f)?f:NaN; }
function r3(x){ return (x==null||isNaN(x))?NaN:Math.round(x*1000)/1000; }
function f3(x){ return (x==null||isNaN(x))?'':r3(x).toFixed(3); }
/* Decimal → fracción a 1/16 (para mostrar nominal en ft-in) */
function toFtIn(x){
  if(x==null||isNaN(x)) return '';
  const neg=x<0; x=Math.abs(x); let ft=Math.floor(x/12+1e-9); let inch=x-ft*12;
  let w=Math.floor(inch+1e-9); let n=Math.round((inch-w)*16);
  if(n===16){w+=1;n=0;} if(w===12){ft+=1;w=0;}
  let fr=''; if(n){ let d=16; while(n%2===0){n/=2;d/=2;} fr=' '+n+'/'+d; }
  const s=(ft?ft+"'-":'')+w+fr+'"';
  return (neg?'-':'')+s;
}
function fracStr(x){ // tolerancias
  if(x==null||isNaN(x)) return '';
  const m={0.015625:'1/64',0.03125:'1/32',0.0625:'1/16',0.125:'1/8',0.1875:'3/16',0.25:'1/4',0.375:'3/8',0.5:'1/2'};
  const k=Object.keys(m).find(k=>Math.abs(parseFloat(k)-x)<1e-6); return k?m[k]+'"':r3(x)+'"';
}

/* ================= Tolerancias por característica ================= */
const TIPOS = {
  largo:    {es:'Largo de miembro',        en:'Member length',            uni:'in'},
  contacto: {es:'Largo, extremos a contacto', en:'Length, ends finished for contact', uni:'in'},
  ubic:     {es:'Ubicación de conexión/placa', en:'Connection / plate location', uni:'in'},
  barreno:  {es:'Barreno: posición / gramil', en:'Hole location / gage',   uni:'in'},
  general:  {es:'Cota general de plano',   en:'General drawing dimension', uni:'in'},
  rectitud: {es:'Rectitud / flecha (sweep-camber)', en:'Straightness (sweep / camber)', uni:'in'},
  angulo:   {es:'Escuadra / ángulo',       en:'Squareness / angle',       uni:'deg'}
};
const PLANO_TOL_TXT='Plano Rev 0, bloque "Tolerances unless noted": FRAC ±1/8", ángulos ±0.5°';
function perfilKind(perfil){ const p=(perfil||'').toUpperCase(); if(/^(W|WT|S|M|MC|C|HP)\d/.test(p)) return 'W'; if(/^HSS/.test(p)) return 'HSS'; if(/^L\d/.test(p)) return 'L'; if(/^PL/.test(p)) return 'PL'; return 'OTRO'; }
/* Devuelve {tm, tp, clause} para una cota */
function tolFor(tipo, nominal, mk){
  switch(tipo){
    case 'largo':{ const L=nominal; if(isNaN(L)) return {tm:0.0625,tp:0.0625,clause:'AISC 303-22 §6.4.1 (≤30 ft ±1/16"; >30 ft ±1/8")'};
      return L>360? {tm:0.125,tp:0.125,clause:'AISC 303-22 §6.4.1 — miembro >30 ft: ±1/8"'} : {tm:0.0625,tp:0.0625,clause:'AISC 303-22 §6.4.1 — miembro ≤30 ft: ±1/16"'}; }
    case 'contacto': return {tm:0.03125,tp:0.03125,clause:'AISC 303-22 §6.4.1 — extremos acabados para contacto: ±1/32"'};
    case 'rectitud':{ const L=parseIn(mk&&mk.largo); const k=perfilKind(mk&&mk.perfil); const div=(k==='W')?10:5;
      if(isNaN(L)) return {tm:0,tp:0.125,clause:'ASTM A6 / A500 vía AISC 303-22 §6.4.2'};
      const tol=0.125*(L/12)/div; return {tm:0,tp:r3(tol),clause:'ASTM '+(k==='HSS'?'A500':'A6')+' vía AISC 303-22 §6.4.2: 1/8" × L(ft)/'+div+' = '+r3(tol)+'"'}; }
    case 'angulo': return {tm:0.5,tp:0.5,clause:PLANO_TOL_TXT};
    default: return {tm:0.125,tp:0.125,clause:PLANO_TOL_TXT};
  }
}
function newCota(tipo, etq, nominal, mk){
  const t=tolFor(tipo, typeof nominal==='number'?nominal:parseIn(nominal), mk);
  return {tipo, etq: etq||TIPOS[tipo].es, nom: (nominal===''||nominal==null||isNaN(nominal))?'':nominal, tm:t.tm, tp:t.tp, clause:t.clause, auto:true, lect:['']};
}
function letra(n){ let s=''; n=Math.max(1,n); while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=Math.floor((n-1)/26); } return s; }
function relabel(m){ m.cotas.forEach((c,i)=>{ c.L=letra(i+1); }); }
const MIEMBRO=['VIGA','COLUMNA','POST','BRACE','KICKER'];
function plantillaPlano(mk,m){
  const P=COTAS[mk.label]; if(!P) return null;
  const out=[]; const seen={};
  P.cotas.forEach(q=>{
    const k=q.x+','+q.y; const off=(seen[k]||0); seen[k]=off+1;
    const c=newCota(q.tipo,q.etq,q.nom,mk);
    c.ref={x:q.x+off*30,y:q.y+(off?-6:0)}; c.src=q.src; if(q.na){ c.na=true; c.naWhy='Posible tamaño de soldadura (no es cota de fabricación)'; }
    out.push(c);
  });
  const b=P.box, cx=(b[0]+b[2])/2, cy=(b[1]+b[3])/2;
  /* rectitud y escuadra no son cotas del plano: se ubican sobre el miembro, bajo la cota de largo */
  const lg=out.find(c=>c.tipo==='largo'&&c.ref); const my=lg?Math.min(b[3]-20,lg.ref.y+75):cy;
  const xs=out.filter(c=>c.ref).map(c=>c.ref.x); const x0=xs.length?Math.min(...xs):b[0]+40;
  if(mk.familia!=='PLACA'){ const r=newCota('rectitud','Rectitud (sweep)',0,mk); r.ref={x:lg?lg.ref.x:cx,y:my}; out.push(r); }
  if(MIEMBRO.includes(mk.familia)){ const e=newCota('angulo','Escuadra de extremo',90,mk); e.ref={x:Math.max(b[0]+20,x0-10),y:my}; out.push(e); }
  return out;
}
function plantilla(mk){
  const pp=plantillaPlano(mk); if(pp){ pp.forEach((c,i)=>c.L=letra(i+1)); return pp; }
  const L=parseIn(mk.largo); const c=[];
  if(mk.familia==='PLACA'){
    c.push(newCota('general','Largo de placa',L,mk));
    c.push(newCota('general','Ancho de placa','',mk));
    c.push(newCota('barreno','Barrenos: posición desde borde','',mk));
  } else if(mk.familia==='ANGULO PERIMETRAL'||mk.familia==='ANGULO'){
    c.push(newCota('largo','Largo total',L,mk));
    c.push(newCota('barreno','Barrenos / clips: posición desde RD','',mk));
    c.push(newCota('rectitud','Rectitud',0,mk));
  } else {
    c.push(newCota('largo','Largo total del perfil',L,mk));
    c.push(newCota('ubic','Conexión extremo A (desde RD)','',mk));
    c.push(newCota('ubic','Conexión extremo B (desde RD)','',mk));
    c.push(newCota('barreno','Barrenos: gramil / paso','',mk));
    c.push(newCota('rectitud','Rectitud (sweep)',0,mk));
    c.push(newCota('angulo','Escuadra de extremo',90,mk));
  }
  c.forEach((x,i)=>x.L=letra(i+1));
  return c;
}
const CHECKS=[
  {k:'marca', es:'Marca de pieza legible y correcta', en:'Piece mark legible and correct'},
  {k:'perfil',es:'Perfil y material conforme a BOM',  en:'Shape and material per BOM'},
  {k:'comp',  es:'Componentes completos vs BOM',       en:'All components per BOM'},
  {k:'sold',  es:'Soldaduras presentes (VT aparte)',   en:'Welds present (VT reported separately)'},
  {k:'acab',  es:'Acabado según plano',                en:'Finish per drawing'}
];
const PHOTO_TAGS=['General','Marca','Conexión A','Conexión B','Medición','Detalle','No conformidad'];

/* ================= Muestreo Z1.4 ================= */
const Z_LETTER=[[8,'A'],[15,'B'],[25,'C'],[50,'D'],[90,'E'],[150,'F'],[280,'G'],[500,'H'],[1200,'J'],[3200,'K']];
const Z_PLAN={ /* Nivel II, normal, simple → [n, Ac, Re] */
  '2.5':{A:[5,0,1],B:[5,0,1],C:[5,0,1],D:[5,0,1],E:[20,1,2],F:[20,1,2],G:[32,2,3],H:[50,3,4],J:[80,5,6],K:[125,7,8]},
  '1.0':{A:[13,0,1],B:[13,0,1],C:[13,0,1],D:[13,0,1],E:[13,0,1],F:[13,0,1],G:[50,1,2],H:[50,1,2],J:[80,2,3],K:[125,3,4]}
};
function zPlan(N, aql, modo){
  if(!N) return {letter:'—',n:0,ac:0,re:1,full:false};
  if(modo==='100') return {letter:'100%',n:N,ac:0,re:1,full:true};
  if(modo==='MARCA') return {letter:'1/marca',n:0,ac:0,re:1,full:false,porMarca:true};
  const L=(Z_LETTER.find(x=>N<=x[0])||Z_LETTER[Z_LETTER.length-1])[1];
  const p=Z_PLAN[aql]||Z_PLAN['2.5']; let [n,ac,re]=p[L];
  let full=false; if(n>=N){n=N;full=true;ac=0;re=1;}
  return {letter:L,n,ac,re,full};
}

/* ================= Estado ================= */
let CAT=[], CATBY={}, FAMS=[], COTAS={};
let REPS={}, rep=null, MEDS={}, curMedId=null;
let MODE='ipad';
const blobCache={};

const FAM_ORDER=['VIGA','COLUMNA','POST','BRACE','KICKER','ANGULO PERIMETRAL','ANGULO','PLACA'];
function unitsOf(fam, marks){ const u=[]; CAT.filter(m=>m.familia===fam && (!marks||marks.includes(m.label))).forEach(m=>{ for(let i=1;i<=m.qty;i++) u.push(m.label+'#'+i); }); return u; }
function medId(label,pieza){ return rep.id+'__'+label+'-'+pieza; }

/* ================= Persistencia (db del artifact, con respaldo local) ================= */
/* IndexedDB en el iPad: reportes, mediciones y fotos (blobs). Todo funciona sin internet. */
let IDB=null;
function idbOpen(){ return new Promise((res,rej)=>{ const q=indexedDB.open('cami-dim-p6',1);
  q.onupgradeneeded=()=>{ const d=q.result; d.createObjectStore('reportes',{keyPath:'id'}); const m=d.createObjectStore('mediciones',{keyPath:'id'}); m.createIndex('rid','rid'); d.createObjectStore('fotos'); };
  q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error); }); }
function tx(store,mode,fn){ return new Promise((res,rej)=>{ const t=IDB.transaction(store,mode); const st=t.objectStore(store); let out; const r=fn(st); if(r) r.onsuccess=()=>{ out=r.result; }; t.oncomplete=()=>res(out); t.onerror=()=>rej(t.error); t.onabort=()=>rej(t.error||new Error('abortado')); }); }
const Store={
  listReps(){ return tx('reportes','readonly',st=>st.getAll()); },
  saveRep(r){ r.upd=nowTs(); return tx('reportes','readwrite',st=>st.put(r)); },
  delRep(id){ return tx('reportes','readwrite',st=>st.delete(id)); },
  listMeds(rid){ return tx('mediciones','readonly',st=>st.index('rid').getAll(rid)); },
  saveMed(m){ m.upd=nowTs(); return tx('mediciones','readwrite',st=>st.put(m)); },
  delMed(id){ return tx('mediciones','readwrite',st=>st.delete(id)); },
  putFoto(id,blob){ return tx('fotos','readwrite',st=>st.put(blob,id)); },
  getFoto(id){ return tx('fotos','readonly',st=>st.get(id)); },
  delFoto(id){ return tx('fotos','readwrite',st=>st.delete(id)); }
};
const fotoURL={};
async function fotoSrc(f){ if(fotoURL[f.id]) return fotoURL[f.id]; const b=await Store.getFoto(f.id); if(!b) return ''; fotoURL[f.id]=URL.createObjectURL(b); return fotoURL[f.id]; }
/* Cola de guardado: una escritura a la vez por documento, con debounce */
const pend={}, inflight={};
function setSync(txt,warn){ const c=$('chipSync'); c.textContent=txt; c.classList.toggle('warn',!!warn); }
function queueSaveMed(m, delay){
  clearTimeout(pend[m.id]); setSync('Guardando…');
  pend[m.id]=setTimeout(()=>flushMed(m.id), delay==null?700:delay);
}
async function flushMed(id){
  if(inflight[id]){ pend[id]=setTimeout(()=>flushMed(id),300); return; }
  const m=MEDS[id]; if(!m) return; inflight[id]=true;
  try{ await Store.saveMed(JSON.parse(JSON.stringify(m))); setSync('Guardado en el iPad'); }
  catch(e){ setSync('Error al guardar',true); toast('No se guardó: '+(e.code||e.message)+'. Reintenta en unos segundos.'); }
  finally{ inflight[id]=false; }
}
async function saveRep(){ try{ await Store.saveRep(JSON.parse(JSON.stringify(rep))); setSync('Guardado en el iPad'); }catch(e){ setSync('Error al guardar',true); toast('No se guardó el reporte: '+(e.code||e.message)); } }

/* ================= Cálculo ================= */
function cotaVal(c,v){ return TIPOS[c.tipo]&&TIPOS[c.tipo].uni==='deg'? parseNum(v) : parseIn(v); }
function cotaStats(c){
  if(c.na) return {reads:[],nom:NaN,tm:NaN,tp:NaN,lsl:NaN,usl:NaN,res:'na',avg:NaN,
    ...(()=>{ const nom=(c.nom===''||c.nom==null)?NaN:(TIPOS[c.tipo].uni==='deg'?parseNum(c.nom):parseIn(c.nom)); const tm=Math.abs(parseNum(c.tm)),tp=Math.abs(parseNum(c.tp)); return {nom,tm,tp,lsl:nom-tm,usl:nom+tp}; })()};
  const reads=(c.lect||[]).map(v=>cotaVal(c,v)).filter(x=>!isNaN(x));
  const nom=(c.nom===''||c.nom==null)?NaN:(TIPOS[c.tipo].uni==='deg'?parseNum(c.nom):parseIn(c.nom));
  const tm=Math.abs(parseNum(c.tm)), tp=Math.abs(parseNum(c.tp));
  let lsl=NaN,usl=NaN,res='pend';
  if(!isNaN(nom)&&!isNaN(tm)&&!isNaN(tp)){ lsl=nom-tm; usl=nom+tp;
    if(reads.length) res=reads.every(x=>x>=lsl-1e-9&&x<=usl+1e-9)?'ok':'nok'; }
  else if(reads.length) res='sinnom';
  return {reads,nom,tm,tp,lsl,usl,res,avg:reads.length?reads.reduce((a,b)=>a+b,0)/reads.length:NaN};
}
function medStats(m){
  let ok=0,nok=0,pendN=0,na=0;
  m.cotas.forEach(c=>{ const s=cotaStats(c); if(s.res==='ok')ok++; else if(s.res==='nok')nok++; else if(s.res==='na')na++; else pendN++; });
  let ckN=0,ckP=0; CHECKS.forEach(k=>{ const v=(m.checks||{})[k.k]; if(v==='NOK')ckN++; if(!v)ckP++; });
  const estado= (nok||ckN)?'nok' : (pendN||ckP)?'pend':'ok';
  return {ok,nok,pend:pendN,na,ckN,ckP,estado,tot:m.cotas.length-na};
}
const EST_TXT={ok:'ACEPTADA',nok:'RECHAZADA',pend:'INCOMPLETA'};
const EST_EN={ok:'ACCEPTED',nok:'REJECTED',pend:'INCOMPLETE'};

/* ================= Arranque ================= */
async function boot(){
  try{ CAT=await (await fetch('data/catalogo_p6.json')).json(); }catch(e){ CAT=[]; toast('No se pudo cargar el catálogo P6'); }
  try{ COTAS=await (await fetch('data/cotas_p6.json')).json(); }catch(e){ COTAS={}; }
  CAT.forEach(m=>{ CATBY[m.label]=m; });
  FAMS=FAM_ORDER.filter(f=>CAT.some(m=>m.familia===f));
  fillDatalist(); bindUI(); renderRepForm(null);
  try{ IDB=await idbOpen(); }catch(e){ setSync('Sin almacenamiento',true); toast('El iPad no permitió guardar datos: '+e.message); return; }
  try{ if(navigator.storage&&navigator.storage.persist) await navigator.storage.persist(); }catch(e){}
  setSync('Guardado en el iPad');
  await loadReps();
}
async function loadReps(){
  try{ (await Store.listReps()).forEach(r=>REPS[r.id]=r); }catch(e){ toast('No se pudieron leer los reportes: '+(e.code||e.message)); }
  const last=lsGet('dimp6_last'); const ids=Object.keys(REPS).sort().reverse();
  renderRepList();
  if(last&&REPS[last]) await selectRep(last); else if(ids.length) await selectRep(ids[0]);
}
async function selectRep(id){
  rep=REPS[id]; lsSet('dimp6_last',id); MEDS={}; curMedId=null;
  try{ (await Store.listMeds(id)).forEach(m=>MEDS[m.id]=m); }catch(e){ toast('No se pudieron leer las mediciones'); }
  $('chipFolio').textContent=rep.folio; renderRepList(); renderRepForm(rep); renderLots(); renderPend(); renderMk(); renderEnt();
}

/* ================= Borrado con confirmación ================= */
/* Panel rojo en la página: explica qué se borra y exige escribir una palabra antes de habilitar el botón */
function dangerConfirm(anchor, o){
  document.querySelectorAll('.danger-box').forEach(x=>x.remove());
  const box=el('div','danger-box');
  box.innerHTML='<div class="dz-t">'+esc(o.title)+'</div><div class="dz-d">'+o.detalle+'</div>'+
    '<label class="lbl" for="dzIn">Para confirmar escribe <b class="mono">'+esc(o.palabra)+'</b></label>';
  const inp=el('input'); inp.type='text'; inp.id='dzIn'; inp.autocomplete='off'; inp.autocapitalize='characters'; inp.spellcheck=false;
  const row=el('div','row'); const bOk=el('button','btn danger',esc(o.btn)); bOk.disabled=true; const bNo=el('button','btn ghost','Cancelar');
  const st=el('span','hint');
  inp.addEventListener('input',()=>{ bOk.disabled=inp.value.trim().toUpperCase()!==o.palabra.toUpperCase(); });
  inp.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!bOk.disabled){ e.preventDefault(); bOk.click(); } if(e.key==='Escape') box.remove(); });
  bNo.addEventListener('click',()=>box.remove());
  bOk.addEventListener('click',async()=>{ bOk.disabled=true; bNo.disabled=true; inp.disabled=true; st.textContent='Borrando…';
    try{ await o.onOk(msg=>{st.textContent=msg;}); box.remove(); }catch(e){ st.textContent='No se pudo borrar: '+(e.code||e.message); bNo.disabled=false; } });
  row.appendChild(bOk); row.appendChild(bNo); row.appendChild(st);
  box.appendChild(inp); box.appendChild(row);
  anchor.insertAdjacentElement('afterend',box); box.scrollIntoView({block:'nearest',behavior:'smooth'}); setTimeout(()=>inp.focus(),60);
  return box;
}
/* Borra mediciones (documentos + fotos) */
async function borrarMeds(list, prog){
  let i=0;
  for(const m of list){ i++; if(prog) prog('Borrando '+i+' de '+list.length+'…');
    clearTimeout(pend[m.id]); delete pend[m.id];
    await Store.delMed(m.id);
    for(const f of (m.fotos||[])){ try{ await Store.delFoto(f.id); }catch(e){} if(fotoURL[f.id]){ URL.revokeObjectURL(fotoURL[f.id]); delete fotoURL[f.id]; } }
    delete MEDS[m.id]; if(curMedId===m.id) curMedId=null; }
}
function pl(n,a,b){ return n+' '+(n===1?a:b); }
function contarFotos(list){ return list.reduce((a,m)=>a+(m.fotos||[]).length,0); }

async function eliminarReporte(id, anchor){
  const r=REPS[id]; if(!r) return;
  let meds=[]; try{ meds= (rep&&rep.id===id)? Object.values(MEDS) : await Store.listMeds(id); }catch(e){ toast('No se pudieron leer las mediciones de '+id); return; }
  dangerConfirm(anchor,{ title:'Eliminar el reporte '+r.folio,
    detalle:'Se borran para siempre: el encabezado, el muestreo de todos los lotes, <b>'+pl(meds.length,'medición','mediciones')+'</b> y <b>'+pl(contarFotos(meds),'foto','fotos')+'</b>. Los Excel y PDF que ya descargaste no se tocan. No se puede deshacer.',
    palabra:'ELIMINAR', btn:'Eliminar reporte',
    onOk:async(pr)=>{ await borrarMeds(meds,pr); await Store.delRep(id); delete REPS[id];
      if(rep&&rep.id===id){ rep=null; MEDS={}; curMedId=null; $('chipFolio').textContent='Sin reporte'; lsSet('dimp6_last',''); renderRepForm(null); $('lotPanel').hidden=true; renderMk(); }
      renderRepList(); toast('Reporte '+id+' eliminado'); } });
}
async function eliminarMuestreo(f, anchor){
  const L=rep.lotes[f]; const meds=Object.values(MEDS).filter(m=>m.familia===f);
  dangerConfirm(anchor,{ title:'Eliminar el muestreo de '+f,
    detalle:'Se borra la selección de piezas del lote ('+pl((L.muestra||[]).length,'pieza','piezas')+') y <b>'+pl(meds.length,'medición','mediciones')+'</b> de esta familia con <b>'+pl(contarFotos(meds),'foto','fotos')+'</b>. Las marcas del lote se conservan'+(L.porMarca?' y la app sortea de nuevo una pieza por marca.':'; después puedes volver a sortear.')+' No se puede deshacer.',
    palabra:'ELIMINAR', btn:'Eliminar muestreo',
    onOk:async(pr)=>{ await borrarMeds(meds,pr); L.muestra=[]; delete L.sorteo; recomputeLots(false); await saveRep(); renderLots(); openLot(f); renderPend(); renderMk(); toast('Muestreo de '+f+' eliminado'); } });
}

/* ================= UI: pestañas ================= */
function showView(v){
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected', String(t.dataset.v===v)));
  ['rep','med','ent'].forEach(x=>$('v-'+x).hidden=(x!==v));
  if(v==='ent') renderEnt(); if(v==='med') renderPend();
  window.scrollTo({top:0});
}
function bindUI(){
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{ if(t.dataset.v!=='rep'&&!rep){toast('Primero crea o elige un reporte');return;} showView(t.dataset.v); }));
  $('btnNewRep').addEventListener('click',()=>{ rep=null; $('chipFolio').textContent='Nuevo'; renderRepForm(null); renderRepList(); $('lotPanel').hidden=true; $('h_inspector').focus(); });
  $('btnSaveRep').addEventListener('click',onSaveRep);
  $('btnOpenMk').addEventListener('click',openFromSearch);
  $('mkSearch').addEventListener('input',fillPiezas);
  $('mkSearch').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); openFromSearch(); } });
  $('fileIn').addEventListener('change',onPhotos);
  $('btnXlsx').addEventListener('click',()=>runGen('xlsx'));
  $('btnPdf').addEventListener('click',()=>runGen('pdf'));
  $('btnBak').addEventListener('click',exportBackup);
  $('btnRes').addEventListener('click',()=>{ $('bakIn').value=''; $('bakIn').click(); });
  $('bakIn').addEventListener('change',e=>{ const f=e.target.files[0]; if(f) importBackup(f); });
  $('pmClose').addEventListener('click',()=>{$('planoModal').hidden=true});
  $('pmIn').addEventListener('click',()=>zoomPlano(1.4));
  enablePinch($('pmBody'),$('pmCv'),()=>pmScale,v=>{ pmScale=v; $('pmZ').textContent=Math.round(v*100)+'%'; },()=>sharpen($('pmCv'),pmMark,true)); $('pmOut').addEventListener('click',()=>zoomPlano(1/1.4));
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') $('planoModal').hidden=true; });
}
function fillDatalist(){
  const dl=$('dlMarks'); dl.innerHTML='';
  CAT.forEach(m=>{ const o=document.createElement('option'); o.value=m.label; o.label=(m.perfil||m.tipo)+' · '+(m.largo||'')+' · plano '+m.plano+(m.qty>1?' · '+m.qty+' pzas':''); dl.appendChild(o); });
}
function fillPiezas(){
  const m=CATBY[($('mkSearch').value||'').trim()]; const s=$('mkPieza'); s.innerHTML='';
  const q=m?m.qty:1; for(let i=1;i<=q;i++){ const o=document.createElement('option'); o.value=i; o.textContent=i+' de '+q; s.appendChild(o); }
}

/* ================= UI: reporte ================= */
function renderRepList(){
  const host=$('repList'); host.innerHTML='';
  const ids=Object.keys(REPS).sort().reverse();
  if(!ids.length){ host.appendChild(el('div','hint','Aún no hay reportes. Llena el encabezado y crea el primero.')); return; }
  ids.forEach(id=>{ const r=REPS[id]; const w=el('div','repline'); const b=el('button','repitem');
    b.setAttribute('aria-current', String(!!rep&&rep.id===id));
    b.innerHTML='<span class="mono" style="font-weight:600">'+esc(r.folio)+'</span><span class="hint">'+esc(r.h.embarque||'')+' · '+esc(r.h.fecha||'')+'</span><span class="spacer"></span><span class="hint">'+esc(r.h.inspector||'sin inspector')+'</span>';
    b.addEventListener('click',()=>selectRep(id));
    const d=el('button','btn sm ghost dz','Eliminar'); d.title='Eliminar reporte completo'; d.addEventListener('click',()=>eliminarReporte(id,w));
    w.appendChild(b); w.appendChild(d); host.appendChild(w); });
}
const H_FIELDS=['proyecto','cliente','oc','embarque','fecha','lugar','inspector','reviso','aprobo','inst','serie','res','cal','plan','nivel','aql'];
const H_DEFAULT={proyecto:'HARRISON-OWOW · 1523 Harrison St., Oakland, CA',cliente:'oWOW Construction LLC (vía PRIMA MSC Services)',oc:'4504608076',embarque:'Prioridad 6 — piezas terminadas',fecha:todayISO(),lugar:'Taller CAMI / PRIMA Apaxco',inspector:'',reviso:'',aprobo:'',inst:'Flexómetro digital Reekon T1M (Bluetooth)',serie:'',res:'',cal:'PENDIENTE — sin certificado de calibración vigente',plan:'MARCA',nivel:'II',aql:'2.5'};
function renderRepForm(r){
  const h=r?r.h:H_DEFAULT;
  H_FIELDS.forEach(k=>{ const e=$('h_'+k); if(e) e.value=h[k]!=null?h[k]:(H_DEFAULT[k]||''); });
  $('repTitle').textContent=r?('Reporte '+r.folio):'Nuevo reporte';
  $('btnSaveRep').textContent=r?'Guardar encabezado':'Crear reporte';
  $('repSaved').textContent=r?('Última edición '+(r.upd||'').replace('T',' ').slice(0,16)+' UTC'):'';
}
async function onSaveRep(){
  const h={}; H_FIELDS.forEach(k=>{ const e=$('h_'+k); h[k]=e?e.value.trim():''; });
  if(!h.cal) h.cal='PENDIENTE — sin certificado de calibración vigente';
  if(rep){ const planChanged=(rep.h.plan!==h.plan||rep.h.aql!==h.aql); rep.h=h; if(planChanged) recomputeLots(true); await saveRep(); renderRepForm(rep); renderLots(); toast('Encabezado guardado'); return; }
  const d=h.fecha.replace(/-/g,''); let seq=1; while(REPS['DIM-HAR-P6-'+d+'-'+String(seq).padStart(2,'0')]) seq++;
  const id='DIM-HAR-P6-'+d+'-'+String(seq).padStart(2,'0');
  rep={id,folio:id,rev:0,creado:nowTs(),h,lotes:{}};
  FAMS.forEach(f=>{ rep.lotes[f]={marks:CAT.filter(m=>m.familia===f).map(m=>m.label),muestra:[]}; });
  recomputeLots(false);
  REPS[id]=rep; await saveRep(); await selectRep(id); toast('Reporte '+id+' creado');
}
function recomputeLots(resetSample){
  FAMS.forEach(f=>{ const L=rep.lotes[f]||(rep.lotes[f]={marks:[],muestra:[]});
    const N=unitsOf(f,L.marks).length; const p=zPlan(N,rep.h.aql,rep.h.plan);
    Object.assign(L,{N,letter:p.letter,n:p.n,ac:p.ac,re:p.re,full:p.full,porMarca:!!p.porMarca});
    if(resetSample) L.muestra=[];
    if(p.full) L.muestra=unitsOf(f,L.marks);
    L.muestra=L.muestra.filter(u=>L.marks.includes(u.split('#')[0]));
    if(p.porMarca){ /* una pieza al azar por cada marca; conserva la ya sorteada */
      const ya={}; L.muestra.forEach(u=>{ ya[u.split('#')[0]]=u; });
      L.muestra=L.marks.map(lab=>ya[lab]||(lab+'#'+(1+Math.floor(Math.random()*((CATBY[lab]||{}).qty||1)))))
        .sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
      L.n=L.muestra.length; L.nMarcas=L.marks.length; }
  });
}
function unitState(u){ const [lab,p]=u.split('#'); const m=MEDS[rep.id+'__'+lab+'-'+p]; if(!m) return ''; return medStats(m).estado; }
/* Piezas que hay que medir: la muestra + (modo por marca) todas las piezas de una marca cuya pieza medida salió rechazada */
function reqUnits(f){
  const L=rep.lotes[f]; const out=(L.muestra||[]).slice(); if(!L.porMarca) return out;
  const set=new Set(out);
  L.marks.forEach(lab=>{ const q=(CATBY[lab]||{}).qty||1; if(q<2) return; let bad=false; for(let i=1;i<=q;i++){ if(unitState(lab+'#'+i)==='nok') bad=true; }
    if(bad) for(let i=1;i<=q;i++){ const u=lab+'#'+i; if(!set.has(u)){ set.add(u); out.push(u); } } });
  return out.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
}
function lotResult(f){
  const L=rep.lotes[f];
  if(L.porMarca){ const req=reqUnits(f); const meas=req.map(unitState); const done=meas.filter(s=>s==='ok'||s==='nok').length; const nok=meas.filter(s=>s==='nok').length;
    const marcasMed=new Set(req.filter(u=>{const s=unitState(u);return s==='ok'||s==='nok';}).map(u=>u.split('#')[0])).size;
    let v='pend'; if(nok>0) v='nok'; else if(L.marks.length&&done>=req.length) v='ok';
    return {done,nok,v,req:req.length,marcasMed}; }
  const meas=L.muestra.map(unitState); const done=meas.filter(s=>s==='ok'||s==='nok').length; const nok=meas.filter(s=>s==='nok').length;
  let v='pend'; if(nok>=L.re) v='nok'; else if(done>=L.n&&L.n>0) v='ok';
  return {done,nok,v};
}
function renderLots(){
  $('lotPanel').hidden=!rep; if(!rep) return; const host=$('lots'); host.innerHTML='';
  FAMS.forEach(f=>{ const L=rep.lotes[f]; const res=lotResult(f);
    const box=el('div','lot'); const hd=el('div','lot-h');
    hd.innerHTML='<div><div class="t">'+esc(f)+'</div><div class="lot-stats">'+(L.porMarca?
      '<span>Marcas <b>'+L.marks.length+'</b></span><span>Piezas en lote <b>'+L.N+'</b></span><span>a medir <b>'+res.req+'</b></span><span>marcas medidas <b>'+res.marcasMed+'/'+L.marks.length+'</b></span><span>NOK <b>'+res.nok+'</b></span>':
      '<span>N <b>'+L.N+'</b></span><span>Letra <b>'+esc(L.letter)+'</b></span><span>n <b>'+L.n+'</b></span><span>Ac/Re <b>'+L.ac+'/'+L.re+'</b></span><span>medidas <b>'+res.done+'/'+L.n+'</b></span><span>NOK <b>'+res.nok+'</b></span>')+'</div></div>'+
      '<span class="pill '+(res.v==='ok'?'ok':res.v==='nok'?'nok':'pend')+'">'+(res.v==='ok'?'LOTE ACEPTADO':res.v==='nok'?'LOTE RECHAZADO':'EN PROCESO')+'</span>';
    const bd=el('div','lot-b'); bd.hidden=true; hd.addEventListener('click',()=>{bd.hidden=!bd.hidden});
    const ck=el('div','marks-ck');
    CAT.filter(m=>m.familia===f).forEach(m=>{ const lb=el('label'); const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=L.marks.includes(m.label); cb.id='ck_'+f.replace(/\W/g,'')+'_'+m.label;
      cb.addEventListener('change',async()=>{ if(cb.checked){ if(!L.marks.includes(m.label)) L.marks.push(m.label);} else L.marks=L.marks.filter(x=>x!==m.label); recomputeLots(false); await saveRep(); renderLots(); openLot(f); });
      lb.appendChild(cb); lb.appendChild(el('span','mono',esc(m.label)+(m.qty>1?' ×'+m.qty:''))); ck.appendChild(lb); });
    const acts=el('div','row');
    const bAll=el('button','btn sm ghost','Todas'); bAll.addEventListener('click',async()=>{ L.marks=CAT.filter(m=>m.familia===f).map(m=>m.label); recomputeLots(false); await saveRep(); renderLots(); openLot(f); });
    const bNone=el('button','btn sm ghost','Ninguna'); bNone.addEventListener('click',async()=>{ L.marks=[]; recomputeLots(true); await saveRep(); renderLots(); openLot(f); });
    const bS=el('button','btn sm dark',L.full?'100% del lote':L.porMarca?'Volver a sortear pieza por marca':'Sortear muestra ('+L.n+')'); bS.disabled=L.full||!L.N;
    bS.addEventListener('click',async()=>{ if(L.porMarca){ const hecho=L.muestra.some(u=>unitState(u)); if(hecho){ toast('Ya hay piezas medidas en este lote; no se re-sortea'); return; } L.muestra=[]; recomputeLots(false); L.sorteo=nowTs(); await saveRep(); renderLots(); openLot(f); renderPend(); toast('Una pieza por marca sorteada'); return; } const u=unitsOf(f,L.marks); for(let i=u.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[u[i],u[j]]=[u[j],u[i]];} L.muestra=u.slice(0,L.n).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})); L.sorteo=nowTs(); await saveRep(); renderLots(); openLot(f); renderPend(); toast('Muestra sorteada: '+L.n+' piezas'); });
    const bX=el('button','btn sm ghost dz','Eliminar muestreo'); bX.disabled=!(L.muestra||[]).length&&!Object.values(MEDS).some(m=>m.familia===f);
    bX.addEventListener('click',()=>eliminarMuestreo(f,acts));
    acts.appendChild(bAll); acts.appendChild(bNone); acts.appendChild(el('div','spacer')); acts.appendChild(bX); acts.appendChild(bS);
    const smp=el('div','sample'); if(!L.muestra.length) smp.appendChild(el('span','hint','Sin muestra todavía.'));
    reqUnits(f).forEach(u=>{ const st=unitState(u); const extra=!L.muestra.includes(u); const b=el('button','unit '+(st||''),esc(u.replace('#',' · '))+(extra?' +':'')); if(extra) b.title='Agregada: otra pieza de esta marca salió rechazada'; b.addEventListener('click',()=>{ const [lab,p]=u.split('#'); openMark(lab,parseInt(p,10)); }); smp.appendChild(b); });
    bd.appendChild(ck); bd.appendChild(acts); bd.appendChild(el('div','lbl','Muestra'+(L.sorteo?' · sorteada '+L.sorteo.slice(0,16).replace('T',' ')+' UTC':''))); bd.appendChild(smp);
    box.dataset.f=f; box.appendChild(hd); box.appendChild(bd); host.appendChild(box);
  });
}
function openLot(f){ const b=[...document.querySelectorAll('.lot')].find(x=>x.dataset.f===f); if(b) b.querySelector('.lot-b').hidden=false; }
function renderPend(){
  if(!rep){ $('pendWrap').hidden=true; return; }
  const host=$('pendUnits'); host.innerHTML=''; let n=0;
  FAMS.forEach(f=>reqUnits(f).forEach(u=>{ const st=unitState(u); if(st==='ok'||st==='nok') return; n++;
    const b=el('button','unit '+(st||''),esc(u.replace('#',' · '))); b.addEventListener('click',()=>{ const [lab,p]=u.split('#'); openMark(lab,parseInt(p,10)); }); host.appendChild(b); }));
  $('pendWrap').hidden=!n; $('pendN').textContent=n;
}

/* ================= UI: medir ================= */
function openFromSearch(){ const lab=($('mkSearch').value||'').trim(); if(!CATBY[lab]){ toast('No encontré “'+lab+'” en el catálogo P6'); return; } openMark(lab, parseInt($('mkPieza').value||'1',10)); }
async function openMark(label,pieza){
  if(!rep){ toast('Primero crea o elige un reporte'); return; }
  const mk=CATBY[label]; const id=medId(label,pieza);
  if(!MEDS[id]){
    MEDS[id]={id,rid:rep.id,label,pieza,qty:mk.qty,familia:mk.familia,plano:mk.plano,rev:'0',perfil:mk.perfil,largo:mk.largo,material:mk.material,
      cotas:plantilla(mk),checks:{},fotos:[],obs:'',inicio:nowTs(),insp:rep.h.inspector||''};
    queueSaveMed(MEDS[id],0);
  }
  curMedId=id; $('mkSearch').value=label; fillPiezas(); $('mkPieza').value=String(pieza);
  if($('v-med').hidden) showView('med');
  renderMk(); setTimeout(()=>{ const i=document.querySelector('#mkHost input.rd'); if(i){i.focus();} },80);
}
function planoUrl(p,ext){ return 'planos/'+p+'.'+(ext||'jpg'); }
/* ---------- Plano con referencias A–Z ---------- */
const PAGE_W=2592, PAGE_H=1728; const IMGC={};
function planoImg(p){ if(!IMGC[p]) IMGC[p]=new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=()=>rej(new Error('No cargó el plano '+p)); i.src=planoUrl(p); }); return IMGC[p]; }
function letterIdx(L){ let n=0; for(const ch of (L||'')) n=n*26+(ch.charCodeAt(0)-64); return n; }
function nextLetter(m){ return letra(Math.max(0,...m.cotas.map(c=>letterIdx(c.L)))+1); }
function markBox(m){
  const P=COTAS[m.label]; let b=P?P.box.slice():null;
  const refs=m.cotas.filter(c=>c.ref).map(c=>c.ref);
  if(!b&&refs.length){ b=[Math.min(...refs.map(r=>r.x)),Math.min(...refs.map(r=>r.y)),Math.max(...refs.map(r=>r.x)),Math.max(...refs.map(r=>r.y))]; }
  if(!b) b=[0,0,PAGE_W,PAGE_H];
  refs.forEach(r=>{ b[0]=Math.min(b[0],r.x-40); b[1]=Math.min(b[1],r.y-50); b[2]=Math.max(b[2],r.x+60); b[3]=Math.max(b[3],r.y+20); });
  const pad=35; return [Math.max(0,b[0]-pad),Math.max(0,b[1]-pad-20),Math.min(PAGE_W,b[2]+pad),Math.min(PAGE_H,b[3]+pad)];
}
/* Dibuja plano (recorte de la vista o hoja completa) con globos A–Z. Devuelve {map(pt→canvas)} */
async function drawPlano(cv,m,o){
  o=o||{}; const img=await planoImg(m.plano); const k=img.naturalWidth/PAGE_W;
  const r=o.full?[0,0,PAGE_W,PAGE_H]:markBox(m);
  const sw=(r[2]-r[0])*k, sh=(r[3]-r[1])*k; const maxW=o.maxW||1500; const f=Math.min(1,maxW/sw)*(o.zoom||1);
  cv.width=Math.round(sw*f); cv.height=Math.round(sh*f);
  const g=cv.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,cv.width,cv.height);
  g.drawImage(img,r[0]*k,r[1]*k,sw,sh,0,0,cv.width,cv.height);
  const S=k*f; const tx=x=>(x-r[0])*S, ty=y=>(y-r[1])*S;
  const R0=Math.max(11,Math.min(22,15*S*1.3));
  const pos=[];
  m.cotas.forEach(c=>{ if(!c.ref||!c.L) return;
    const x=tx(c.ref.x), y=ty(c.ref.y); const bx=x+R0*1.25, by=y-R0*1.35;
    const act=o.active===c.L; const col=c.na?'#8A969B':(act?'#F37933':'#D0461B');
    g.strokeStyle=col; g.lineWidth=Math.max(1.5,R0/9); g.beginPath(); g.moveTo(x,y); g.lineTo(bx,by); g.stroke();
    g.fillStyle=col; g.beginPath(); g.arc(x,y,Math.max(2,R0/6),0,7); g.fill();
    g.beginPath(); g.arc(bx,by,R0,0,7); g.fillStyle=act?'#F37933':'rgba(255,255,255,.92)'; g.fill(); g.stroke();
    g.fillStyle=act?'#fff':col; g.font='700 '+Math.round(R0*(c.L.length>1?0.85:1.1))+'px -apple-system,Helvetica,Arial,sans-serif'; g.textAlign='center'; g.textBaseline='middle'; g.fillText(c.L,bx,by+1);
    pos.push({L:c.L,x:bx,y:by,r:R0});
  });
  return {pos, toPt:(cx,cy)=>({x:cx/S+r[0], y:cy/S+r[1]})};
}
let ACTIVE=null, PLACING=null, pmScale=1, pmMark=null;
/* Zoom con pellizco (dos dedos) y doble toque sobre un contenedor con scroll que tiene un canvas.
   getS/setS leen y fijan la escala (1 = ancho del contenedor). onEnd re-renderiza con más resolución. */
function enablePinch(wrap,cv,getS,setS,onEnd){
  let st=null, lastTap=0;
  const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  const mid=t=>({x:(t[0].clientX+t[1].clientX)/2,y:(t[0].clientY+t[1].clientY)/2});
  wrap.addEventListener('touchstart',e=>{
    if(e.touches.length===2){ e.preventDefault(); const r=wrap.getBoundingClientRect(), c=mid(e.touches);
      st={d0:dist(e.touches),s0:getS(),cx:c.x-r.left,cy:c.y-r.top,sl:wrap.scrollLeft,stp:wrap.scrollTop}; }
    else if(e.touches.length===1){ const now=Date.now(); if(now-lastTap<300){ e.preventDefault(); const r=wrap.getBoundingClientRect(); const t=e.touches[0]; zoomAt(getS()>1.2?1:2.5,t.clientX-r.left,t.clientY-r.top,getS(),wrap.scrollLeft,wrap.scrollTop); onEnd&&onEnd(); } lastTap=now; }
  },{passive:false});
  wrap.addEventListener('touchmove',e=>{ if(st&&e.touches.length===2){ e.preventDefault(); const f=dist(e.touches)/st.d0; zoomAt(Math.min(8,Math.max(1,st.s0*f)),st.cx,st.cy,st.s0,st.sl,st.stp); } },{passive:false});
  wrap.addEventListener('touchend',e=>{ if(st&&e.touches.length<2){ st=null; onEnd&&onEnd(); } });
  function zoomAt(ns,cx,cy,s0,sl,stp){ const k=ns/s0; setS(ns); cv.style.width=(ns*100)+'%'; wrap.scrollLeft=(sl+cx)*k-cx; wrap.scrollTop=(stp+cy)*k-cy; }
  // trackpad / ctrl+rueda en escritorio
  wrap.addEventListener('wheel',e=>{ if(!e.ctrlKey) return; e.preventDefault(); const r=wrap.getBoundingClientRect(); const s0=getS(); zoomAt(Math.min(8,Math.max(1,s0*(e.deltaY<0?1.12:1/1.12))),e.clientX-r.left,e.clientY-r.top,s0,wrap.scrollLeft,wrap.scrollTop); clearTimeout(wrap._t); wrap._t=setTimeout(()=>onEnd&&onEnd(),250); },{passive:false});
}
let thScale=1;
async function sharpen(cv,m,full,zoomS){ const need=Math.min(6000,Math.round(cv.getBoundingClientRect().width*(window.devicePixelRatio||2))); if(need>cv.width*1.15){ const geo=await drawPlano(cv,m,{full,active:ACTIVE,maxW:need}); if(!full) cv._geo=geo; } }
async function redrawThumb(){ const cv=$('plCv'); const m=curMedId&&MEDS[curMedId]; if(!cv||!m) return; try{ const w=cv.getBoundingClientRect().width||900; cv._geo=await drawPlano(cv,m,{active:ACTIVE,maxW:Math.min(6000,Math.max(1400,Math.round(w*(window.devicePixelRatio||2))))}); }catch(e){ } }
async function openPlano(p,label){ const m=curMedId&&MEDS[curMedId]; pmMark=m; $('pmTitle').textContent='Plano '+p+' · Rev 0'+(label?' · '+label:''); $('pmPdf').href=planoUrl(p,'pdf'); pmScale=1; $('pmZ').textContent='100%'; $('planoModal').hidden=false; await drawModal(); }
async function drawModal(){ const cv=$('pmCv'); if(!pmMark) return; cv.style.width=(pmScale*100)+'%'; await drawPlano(cv,pmMark,{full:true,active:ACTIVE,maxW:Math.min(6000,Math.round(cv.getBoundingClientRect().width*(window.devicePixelRatio||2))||3000)}); }
function zoomPlano(f){ const w=$('pmBody'); const r=w.getBoundingClientRect(); const s0=pmScale; pmScale=Math.min(8,Math.max(1,pmScale*f)); const k=pmScale/s0; $('pmCv').style.width=(pmScale*100)+'%'; w.scrollLeft=(w.scrollLeft+r.width/2)*k-r.width/2; w.scrollTop=(w.scrollTop+r.height/2)*k-r.height/2; $('pmZ').textContent=Math.round(pmScale*100)+'%'; clearTimeout(w._z); w._z=setTimeout(()=>sharpen($('pmCv'),pmMark,true),200); }

function renderMk(){
  const host=$('mkHost'); host.innerHTML='';
  const m=curMedId&&MEDS[curMedId]; if(!m){ host.appendChild(el('div','panel','<div class="hint">Elige una marca arriba o toca una pieza de la muestra. Cada pieza abre con las cotas de su familia y la tolerancia de cada una ya asignada.</div>')); return; }
  const mk=CATBY[m.label]||{}; const st=medStats(m);
  const top=el('div','panel');
  const head=el('div','mk-head');
  head.innerHTML='<div style="flex:1;min-width:220px"><div class="eyebrow">'+esc(m.familia)+' · pieza '+m.pieza+' de '+m.qty+'</div><div class="mk-title">'+esc(m.label)+'</div>'+
    '<div class="mk-meta"><span>Perfil <b class="mono">'+esc(m.perfil||'—')+'</b></span><span>Largo <b class="mono">'+esc(m.largo||'—')+'</b></span><span>Material <b>'+esc(m.material||'—')+'</b></span><span>Plano <b class="mono">'+esc(m.plano)+' Rev 0</b></span></div></div>'+
    '<span class="pill '+(st.estado==='ok'?'ok':st.estado==='nok'?'nok':'pend')+'" id="mkPill">'+EST_TXT[st.estado]+'</span>';
  top.appendChild(head);
  const two=el('div','view'); two.style.gap='14px';
  const left=el('div','view'); left.style.gap='8px';
  if(m.cotas.some(c=>!c.L)) relabel(m);
  const cv=el('canvas','plano-cv'); cv.id='plCv'; thScale=1; cv.style.width='100%';
  const cwrap=el('div','plwrap'); cwrap.appendChild(cv);
  enablePinch(cwrap,cv,()=>thScale,v=>{thScale=v;},()=>sharpen(cv,m,false));
  cv.addEventListener('click',ev=>{ const g=cv._geo; if(!g) return; const rc=cv.getBoundingClientRect(); const cx=(ev.clientX-rc.left)*cv.width/rc.width, cy=(ev.clientY-rc.top)*cv.height/rc.height;
    if(PLACING){ const c=m.cotas.find(x=>x.L===PLACING); if(c){ c.ref=g.toPt(cx,cy); queueSaveMed(m); toast('Referencia '+c.L+' ubicada'); } PLACING=null; $('placeNote').hidden=true; redrawThumb(); return; }
    const hit=g.pos.find(p=>Math.hypot(p.x-cx,p.y-cy)<p.r*1.6);
    if(hit){ ACTIVE=hit.L; redrawThumb(); const i=document.querySelector('#mkHost tr[data-l="'+hit.L+'"] input.rd:not([disabled])'); if(i) i.focus(); else { const r=document.querySelector('#mkHost tr[data-l="'+hit.L+'"]'); if(r) r.scrollIntoView({block:'center'}); } return; }
    openPlano(m.plano,m.label); });
  left.appendChild(cwrap);
  const zr=el('div','row zbar'); const bzo=el('button','btn sm','−'); const bzi=el('button','btn sm','+'); const bz1=el('button','btn sm ghost','Ajustar');
  const zset=v=>{ const r=cwrap.getBoundingClientRect(); const s0=thScale; const cx=r.width/2, cy=r.height/2; const k=v/s0; thScale=v; cv.style.width=(v*100)+'%'; cwrap.scrollLeft=(cwrap.scrollLeft+cx)*k-cx; cwrap.scrollTop=(cwrap.scrollTop+cy)*k-cy; sharpen(cv,m,false); };
  bzo.addEventListener('click',()=>zset(Math.max(1,thScale/1.5))); bzi.addEventListener('click',()=>zset(Math.min(8,thScale*1.5))); bz1.addEventListener('click',()=>zset(1));
  zr.appendChild(el('span','hint','Pellizca para acercar · doble toque para zoom')); zr.appendChild(el('span','spacer')); zr.appendChild(bzo); zr.appendChild(bzi); zr.appendChild(bz1); left.appendChild(zr);
  const pn=el('div','note','Toca el plano en el lugar donde está la cota <b id="placeL"></b>.'); pn.id='placeNote'; pn.hidden=!PLACING; left.appendChild(pn);
  const lrow=el('div','row'); lrow.appendChild(el('span','hint','Cada cota tiene su letra en el plano. Toca un globo para ir a su lectura; toca fuera para ampliar. Tolerancias del plano: FRAC ±1/8", ángulos ±0.5°.'));
  const bFull=el('button','btn sm','Ver plano completo'); bFull.addEventListener('click',()=>openPlano(m.plano,m.label)); lrow.appendChild(bFull);
  if(COTAS[m.label]&&!m.cotas.some(c=>c.ref)){ const bR=el('button','btn sm dark','Cargar cotas del plano'); bR.addEventListener('click',()=>{ const cf=el('div','confirm','Se reemplazan las cotas actuales de esta pieza por las del plano (se pierden sus lecturas). '); const y=el('button','btn sm danger','Reemplazar'); const n=el('button','btn sm ghost','Cancelar'); cf.appendChild(y); cf.appendChild(n); lrow.replaceWith(cf); n.addEventListener('click',()=>renderMk()); y.addEventListener('click',()=>{ m.cotas=plantilla(CATBY[m.label]); queueSaveMed(m,0); renderMk(); }); }); lrow.appendChild(bR); }
  left.appendChild(lrow);
  setTimeout(redrawThumb,0);
  const right=el('div','view'); right.style.gap='6px';
  right.appendChild(el('div','lbl','BOM del sub-ensamble'));
  const bt=el('table','bom'); (mk.componentes||[]).forEach(c=>{ const tr=el('tr'); tr.innerHTML='<td class="mono">'+esc(c.label)+'</td><td>'+esc(c.desc)+'</td><td class="mono">'+esc(c.length||'')+'</td><td class="q">×'+(c.qty||1)+'</td>'; bt.appendChild(tr); });
  if(!(mk.componentes||[]).length){ const tr=el('tr'); tr.innerHTML='<td class="hint">Sin composición en CAT_COMPOSICION; verificar contra plano.</td>'; bt.appendChild(tr); }
  right.appendChild(bt);
  two.appendChild(left); two.appendChild(right); top.appendChild(two);
  host.appendChild(top);

  /* Cotas */
  const pc=el('div','panel');
  pc.appendChild(el('div','row','<h3>Cotas</h3><span class="hint">Con el T1M en modo teclado (terminación Tab), cada lectura salta a la siguiente casilla.</span>'));
  const ncol=Math.max(1,...m.cotas.map(c=>(c.lect||[]).length));
  const tw=el('div','tbl-wrap'); const t=el('table','meas');
  let th='<thead><tr><th>Ref.</th><th class="l">Característica</th><th>Tipo</th><th>Nominal</th><th>Tol −</th><th>Tol +</th>';
  for(let i=0;i<ncol;i++) th+='<th>M'+(i+1)+'</th>'; th+='<th>Result.</th><th class="l">Criterio</th><th></th></tr></thead>'; t.innerHTML=th;
  const tb=el('tbody');
  m.cotas.forEach((c,ri)=>{
    const tr=el('tr'); const s=cotaStats(c); tr.dataset.l=c.L||''; if(c.na) tr.className='na-row';
    const tdRef=el('td'); const bL=el('button','ltr'+(c.ref?'':' noref'),esc(c.L||'?')); bL.tabIndex=-1; bL.title=c.ref?'Ver en el plano':'Ubicar en el plano';
    bL.addEventListener('click',()=>{ ACTIVE=c.L; if(!c.ref){ PLACING=c.L; const pn=$('placeNote'); if(pn){ pn.hidden=false; $('placeL').textContent=c.L; } toast('Toca el plano donde está la cota '+c.L); } redrawThumb(); const cvx=$('plCv'); if(cvx) cvx.scrollIntoView({block:'nearest',behavior:'smooth'}); });
    tdRef.appendChild(bL); tr.appendChild(tdRef);
    const tdL=el('td','l'); const iL=el('input','lbl-in'); iL.type='text'; iL.value=c.etq; iL.tabIndex=-1; iL.id='etq_'+ri; iL.addEventListener('input',()=>{c.etq=iL.value;queueSaveMed(m)}); tdL.appendChild(iL); tr.appendChild(tdL);
    const tdT=el('td'); const sT=document.createElement('select'); sT.tabIndex=-1; sT.id='tipo_'+ri;
    Object.keys(TIPOS).forEach(k=>{ const o=document.createElement('option'); o.value=k; o.textContent=TIPOS[k].es; if(k===c.tipo)o.selected=true; sT.appendChild(o); });
    sT.addEventListener('change',()=>{ c.tipo=sT.value; const tt=tolFor(c.tipo,parseIn(c.nom),m); c.tm=tt.tm;c.tp=tt.tp;c.clause=tt.clause;c.auto=true; if(c.tipo==='rectitud'&&c.nom==='')c.nom=0; if(c.tipo==='angulo'&&c.nom==='')c.nom=90; queueSaveMed(m); renderMk(); });
    tdT.appendChild(sT); tr.appendChild(tdT);
    const uni=TIPOS[c.tipo].uni;
    const mkIn=(cls,val,fn,id)=>{ const td=el('td'); const i=el('input',cls); i.type='text'; i.inputMode='decimal'; i.value=val; i.tabIndex=-1; i.id=id; i.addEventListener('input',()=>fn(i)); td.appendChild(i); return td; };
    tr.appendChild(mkIn('nom',c.nom===''?'':(uni==='deg'?c.nom:toFtIn(parseIn(c.nom))),i=>{ c.nom=i.value; if(c.auto&&(c.tipo==='largo')){ const tt=tolFor('largo',parseIn(i.value),m); c.tm=tt.tm;c.tp=tt.tp;c.clause=tt.clause; } recalc(); },'nom_'+ri));
    tr.appendChild(mkIn('tol',uni==='deg'?c.tm:fracStr(c.tm),i=>{ c.tm=uni==='deg'?parseNum(i.value):parseIn(i.value); c.auto=false; c.clause='Tolerancia de plano / nota específica (editada en campo)'; recalc(); },'tm_'+ri));
    tr.appendChild(mkIn('tol',uni==='deg'?c.tp:fracStr(c.tp),i=>{ c.tp=uni==='deg'?parseNum(i.value):parseIn(i.value); c.auto=false; c.clause='Tolerancia de plano / nota específica (editada en campo)'; recalc(); },'tp_'+ri));
    for(let k=0;k<ncol;k++){ (function(ci){
      const td=el('td'); const i=el('input','rd'); i.type='text'; i.inputMode='decimal'; i.value=(c.lect[ci]!=null?c.lect[ci]:''); i.id='rd_'+ri+'_'+ci; i.autocomplete='off';
      i.addEventListener('input',()=>{ while(c.lect.length<=ci) c.lect.push(''); c.lect[ci]=i.value; recalc(); });
      i.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); const all=[...document.querySelectorAll('#mkHost input.rd')]; const j=all.indexOf(i); if(j>-1&&j<all.length-1) all[j+1].focus(); else { i.blur(); toast('Última lectura de la marca'); } } });
      i.addEventListener('focus',()=>{ if(i.select) i.select(); if(ACTIVE!==c.L){ ACTIVE=c.L; redrawThumb(); } });
      if(c.na){ i.disabled=true; i.tabIndex=-1; i.placeholder='N/A'; }
      td.appendChild(i); tr.appendChild(td); })(k); }
    const tdR=el('td'); tdR.className='res'; tr.appendChild(tdR);
    const tdC=el('td'); tdC.appendChild(el('div','clause',esc(c.clause))); tr.appendChild(tdC);
    const tdX=el('td'); tdX.style.whiteSpace='nowrap';
    const bNA=el('button','btn sm ghost na-b'+(c.na?' on':''),'N/A'); bNA.tabIndex=-1; bNA.title=c.na?'Volver a medir esta cota':'Marcar como no aplica (no se mide)';
    bNA.addEventListener('click',()=>{ c.na=!c.na; if(!c.na) delete c.naWhy; else c.naWhy=c.naWhy||'No aplica / no medible con flexómetro'; queueSaveMed(m); renderMk(); updPill(m); });
    const bx=el('button','x','✕'); bx.tabIndex=-1; bx.title='Quitar cota'; bx.addEventListener('click',()=>{ m.cotas.splice(ri,1); queueSaveMed(m); renderMk(); });
    tdX.appendChild(bNA); tdX.appendChild(bx); tr.appendChild(tdX);
    function recalc(){ const s2=cotaStats(c); paint(tr,c,s2); queueSaveMed(m); updPill(m); }
    tb.appendChild(tr); paint(tr,c,s);
  });
  t.appendChild(tb); tw.appendChild(t); pc.appendChild(tw);
  const tools=el('div','row');
  const bAdd=el('button','btn sm','+ Cota'); bAdd.addEventListener('click',()=>{ const c=newCota('general','Cota agregada en campo','',m); c.L=nextLetter(m); m.cotas.push(c); queueSaveMed(m); PLACING=c.L; ACTIVE=c.L; renderMk(); toast('Toca el plano donde está la cota '+c.L); });
  const bCol=el('button','btn sm','+ Lectura (M'+(ncol+1)+')'); bCol.addEventListener('click',()=>{ m.cotas.forEach(c=>c.lect.push('')); queueSaveMed(m); renderMk(); });
  tools.appendChild(bAdd); tools.appendChild(bCol);
  if(ncol>1){ const bD=el('button','btn sm ghost','− Lectura'); bD.addEventListener('click',()=>{ m.cotas.forEach(c=>{ if(c.lect.length>1) c.lect.pop(); }); queueSaveMed(m); renderMk(); }); tools.appendChild(bD); }
  pc.appendChild(tools);
  host.appendChild(pc);

  /* Verificaciones */
  const pv=el('div','panel'); pv.appendChild(el('h3',null,'Verificaciones visuales'));
  const cg=el('div','checks');
  CHECKS.forEach(k=>{ const row=el('div','ck'); row.appendChild(el('span',null,esc(k.es))); const sg=el('div','seg');
    [['OK','o'],['NOK','n'],['N/A','a']].forEach(([v,c])=>{ const b=el('button',c,v); b.setAttribute('aria-pressed',String((m.checks||{})[k.k]===v)); b.addEventListener('click',()=>{ m.checks[k.k]=(m.checks[k.k]===v?'':v); queueSaveMed(m); sg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(m.checks[k.k]===x.textContent))); updPill(m); }); sg.appendChild(b); });
    row.appendChild(sg); cg.appendChild(row); });
  pv.appendChild(cg); host.appendChild(pv);

  /* Fotos */
  const pf=el('div','panel'); pf.appendChild(el('div','row','<h3>Fotografías</h3><span class="hint">Mínimo: vista general, marca y cada conexión. Se guardan en el servidor.</span>'));
  const grid=el('div','photos');
  (m.fotos||[]).forEach((f,fi)=>{ const card=el('div','ph'); const im=el('img'); im.alt=f.tag||'Foto'; fotoSrc(f).then(u=>{ im.src=u; }); card.appendChild(im);
    const sel=document.createElement('select'); sel.id='ph_'+fi; PHOTO_TAGS.forEach(tg=>{ const o=document.createElement('option'); o.value=tg; o.textContent=tg; if(tg===f.tag)o.selected=true; sel.appendChild(o); });
    sel.addEventListener('change',()=>{ f.tag=sel.value; queueSaveMed(m); }); card.appendChild(sel);
    const bx=el('button','x','✕'); bx.title='Quitar foto del reporte'; bx.addEventListener('click',()=>{ m.fotos.splice(fi,1); queueSaveMed(m); renderMk(); }); card.appendChild(bx);
    grid.appendChild(card); });
  const add=el('button','addph','<span style="font-size:22px">+</span><span>Tomar / subir foto</span>');
  add.addEventListener('click',()=>{ $('fileIn').value=''; $('fileIn').click(); });
  grid.appendChild(add); pf.appendChild(grid); host.appendChild(pf);

  /* Observaciones + cierre */
  const po=el('div','panel'); po.appendChild(el('label','lbl','Observaciones / disposición')); const ta=el('textarea'); ta.id='obs'; ta.value=m.obs||''; ta.placeholder='p. ej. Conexión B a +3/16": NCR abierta, se corrige antes de embarque'; ta.addEventListener('input',()=>{ m.obs=ta.value; queueSaveMed(m); }); po.appendChild(ta);
  host.appendChild(po);
  const bar=el('div','stickybar');
  bar.innerHTML='<span class="status-big" id="mkBarTxt"></span><span class="spacer"></span>';
  const bDel=el('button','btn sm ghost dz','Borrar medición');
  bDel.addEventListener('click',()=>{ const cf=el('div','confirm','¿Borrar la medición de <b>'+esc(m.label)+' pieza '+m.pieza+'</b> con sus '+(m.fotos||[]).length+' fotos? No se puede deshacer. '); const y=el('button','btn sm danger','Sí, borrar'); const n=el('button','btn sm ghost','Cancelar'); cf.appendChild(y); cf.appendChild(n); bar.replaceWith(cf);
    n.addEventListener('click',()=>renderMk()); y.addEventListener('click',async()=>{ y.disabled=true; try{ await borrarMeds([m]); }catch(e){ toast('No se pudo borrar: '+(e.code||e.message)); renderMk(); return; } curMedId=null; renderMk(); renderPend(); renderLots(); toast('Medición borrada'); }); });
  const bNext=el('button','btn primary','✓ Cerrar y siguiente');
  bNext.addEventListener('click',()=>{ m.cierre=nowTs(); queueSaveMed(m,0); renderLots(); renderPend(); const nxt=document.querySelector('#pendUnits .unit'); if(nxt){ nxt.click(); } else { curMedId=null; renderMk(); window.scrollTo({top:0}); $('mkSearch').focus(); toast('Marca cerrada'); } });
  bar.appendChild(bDel); bar.appendChild(bNext); host.appendChild(bar);
  updPill(m);
}
function paint(tr,c,s){
  tr.querySelectorAll('input.rd').forEach(i=>{ i.classList.remove('ok','nok'); const v=cotaVal(c,i.value); if(i.value.trim()!==''&&!isNaN(s.lsl)&&!isNaN(v)) i.classList.add(v>=s.lsl-1e-9&&v<=s.usl+1e-9?'ok':'nok'); });
  const td=tr.querySelector('td.res');
  const map={ok:['ok','OK'],nok:['nok','NOK'],pend:['neu','—'],sinnom:['pend','Falta nominal'],na:['neu','N/A']};
  const [cl,tx]=map[s.res]; td.innerHTML='<span class="pill '+cl+'">'+tx+'</span>'+(isNaN(s.lsl)?'':'<div class="clause mono" style="text-align:center;max-width:none">'+f3(s.lsl)+' – '+f3(s.usl)+'</div>');
}
function updPill(m){
  const st=medStats(m); const p=$('mkPill'); if(p){ p.className='pill '+(st.estado==='ok'?'ok':st.estado==='nok'?'nok':'pend'); p.textContent=EST_TXT[st.estado]; }
  const b=$('mkBarTxt'); if(b) b.textContent=st.ok+' OK · '+st.nok+' NOK · '+st.pend+' pendientes'+(st.na?' · '+st.na+' N/A':'')+(st.ckP?' · '+st.ckP+' verif. sin marcar':'');
}

/* Fotos: reducir a 1600 px y subir como asset */
async function shrink(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const max=1600; let w=img.naturalWidth,h=img.naturalHeight; const k=Math.min(1,max/Math.max(w,h)); w=Math.round(w*k); h=Math.round(h*k);
    const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h);
    const blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.82)); return {blob,w,h};
  } finally { URL.revokeObjectURL(url); }
}
async function onPhotos(e){
  const m=curMedId&&MEDS[curMedId]; if(!m) return; const files=[...e.target.files]; if(!files.length) return;
  for(const f of files){
    try{ setSync('Subiendo foto…'); const {blob,w,h}=await shrink(f); const tag=PHOTO_TAGS[Math.min((m.fotos||[]).length,PHOTO_TAGS.length-2)];
      const id='F'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); await Store.putFoto(id,blob); m.fotos.push({id,tag,w,h,ts:nowTs()});
      queueSaveMed(m,0); renderMk();
    }catch(err){ setSync('Error de foto',true); toast('No se subió la foto: '+(err.code||err.message)); }
  }
}

/* ================= UI: entregables ================= */
function sortedMeds(){ return Object.values(MEDS).sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true})||a.pieza-b.pieza); }
function renderEnt(){
  if(!rep) return; const meds=sortedMeds();
  const cnt={ok:0,nok:0,pend:0}; meds.forEach(m=>cnt[medStats(m).estado]++);
  $('entSummary').innerHTML='<div class="row"><span class="mono" style="font-weight:600">'+esc(rep.folio)+'</span><span class="pill ok">'+cnt.ok+' aceptadas</span><span class="pill nok">'+cnt.nok+' rechazadas</span><span class="pill pend">'+cnt.pend+' incompletas</span><span class="hint">'+meds.reduce((a,m)=>a+(m.fotos||[]).length,0)+' fotos</span></div>';
  const t=$('entTable'); t.innerHTML='<thead><tr><th>Marca</th><th>Pieza</th><th>Familia</th><th>Plano</th><th>Cotas</th><th>Fotos</th><th>Resultado</th></tr></thead>';
  const tb=el('tbody');
  if(!meds.length){ const tr=el('tr'); tr.innerHTML='<td colspan="7" class="hint">Aún no hay marcas medidas en este reporte.</td>'; tb.appendChild(tr); }
  meds.forEach(m=>{ const s=medStats(m); const tr=el('tr'); tr.style.cursor='pointer';
    tr.innerHTML='<td class="mono" style="font-weight:600">'+esc(m.label)+'</td><td class="mono">'+m.pieza+'/'+m.qty+'</td><td>'+esc(m.familia)+'</td><td class="mono">'+esc(m.plano)+' R0</td><td class="mono">'+s.ok+'/'+s.tot+'</td><td class="mono">'+(m.fotos||[]).length+'</td><td><span class="pill '+(s.estado==='ok'?'ok':s.estado==='nok'?'nok':'pend')+'">'+EST_TXT[s.estado]+'</span></td>';
    tr.addEventListener('click',()=>openMark(m.label,m.pieza)); tb.appendChild(tr); });
  t.appendChild(tb);
}
function prog(s){ $('prog').textContent=s; }
async function planoJpeg(m,o){ const cv=document.createElement('canvas'); await drawPlano(cv,m,Object.assign({maxW:2000},o||{})); const b=await new Promise(r=>cv.toBlob(r,'image/jpeg',0.85)); return {buf:await b.arrayBuffer(),w:cv.width,h:cv.height}; }
async function fetchBuf(url){ const r=await fetch(url); if(!r.ok) throw new Error('No se pudo leer '+url+' ('+r.status+')'); return await r.arrayBuffer(); }
async function photoBuf(f){ const b=await Store.getFoto(f.id); if(!b) throw new Error('Foto no encontrada'); return await b.arrayBuffer(); }
async function ensureLibs(){
  const need=[]; if(!window.ExcelJS) need.push('lib/exceljs.min.js'); if(!window.PDFLib) need.push('lib/pdf-lib.min.js');
  for(const src of need){ await new Promise((res,rej)=>{ const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('No cargó '+src)); document.head.appendChild(s); }); }
}
async function runGen(kind){
  if(!rep){ toast('Elige un reporte'); return; } const meds=sortedMeds(); if(!meds.length){ toast('No hay marcas medidas'); return; }
  const btns=[$('btnXlsx'),$('btnPdf')]; btns.forEach(b=>b.disabled=true);
  try{
    await Promise.all(Object.keys(pend).map(id=>{ clearTimeout(pend[id]); return flushMed(id); }));
    await ensureLibs();
    const data= kind==='xlsx'? await buildXlsx(meds) : await buildPdf(meds);
    const name=rep.folio+(kind==='xlsx'?'.xlsx':'.pdf');
    prog('Listo: '+name+' ('+(data.size/1048576).toFixed(1)+' MB).');
    offerFile(name,data);
  }catch(e){ console.error(e); prog('Error: '+e.message); toast('Falló la generación'); }
  finally{ btns.forEach(b=>b.disabled=false); }
}

/* Entrega del archivo en el iPad: hoja de compartir (Guardar en Archivos / Drive / Correo) o descarga */
function offerFile(name,blob){
  const host=$('outFiles'); const row=el('div','outrow'); row.appendChild(el('span','mono',esc(name)+' · '+(blob.size/1048576).toFixed(1)+' MB'));
  const file=new File([blob],name,{type:blob.type||'application/octet-stream'});
  const bS=el('button','btn primary sm','Compartir / Guardar…');
  bS.addEventListener('click',async()=>{ try{ if(navigator.canShare&&navigator.canShare({files:[file]})){ await navigator.share({files:[file],title:name}); } else { dl(); } }catch(e){ if(e.name!=='AbortError') { toast('No se pudo compartir; descargando'); dl(); } } });
  const bD=el('button','btn sm','Descargar'); function dl(){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },4000); }
  bD.addEventListener('click',dl);
  row.appendChild(el('span','spacer')); row.appendChild(bS); row.appendChild(bD); host.prepend(row);
}
/* Respaldo completo del reporte (datos + fotos) en un solo JSON */
async function exportBackup(){
  if(!rep){ toast('Elige un reporte'); return; }
  await Promise.all(Object.keys(pend).map(id=>{ clearTimeout(pend[id]); return flushMed(id); }));
  prog('Armando respaldo…'); const meds=Object.values(MEDS); const fotos={};
  for(const m of meds) for(const f of (m.fotos||[])){ const b=await Store.getFoto(f.id); if(b){ fotos[f.id]=await new Promise(r=>{ const fr=new FileReader(); fr.onload=()=>r(fr.result); fr.readAsDataURL(b); }); } }
  const data={tipo:'cami-dim-p6-respaldo',version:1,exportado:nowTs(),reporte:rep,mediciones:meds,fotos};
  const blob=new Blob([JSON.stringify(data)],{type:'application/json'}); const name=rep.folio+'_respaldo_'+nowTs().slice(0,16).replace(/[:T]/g,'-')+'.json';
  prog('Respaldo listo.'); offerFile(name,blob);
}
async function importBackup(file){
  try{ const o=JSON.parse(await file.text()); if(o.tipo!=='cami-dim-p6-respaldo') throw new Error('No es un respaldo de esta app');
    for(const [id,durl] of Object.entries(o.fotos||{})){ const b=await (await fetch(durl)).blob(); await Store.putFoto(id,b); }
    for(const m of o.mediciones) await Store.saveMed(m); await Store.saveRep(o.reporte); REPS[o.reporte.id]=o.reporte;
    await selectRep(o.reporte.id); toast('Respaldo '+o.reporte.folio+' restaurado ('+o.mediciones.length+' mediciones)');
  }catch(e){ toast('No se pudo restaurar: '+e.message); }
}

/* ---------- Textos del reporte (bilingüe) ---------- */
function decisionRule(h){
  return 'Decision rule / Regla de decisión: simple acceptance per ISO 14253-1 (no guard band); a reading equal to a limit is accepted. A characteristic is OK when every reading lies within [LSL, USL]; a piece is ACCEPTED when all characteristics and visual checks are OK. / Aceptación simple (ISO 14253-1, sin banda de guarda); una lectura igual al límite se acepta. La característica es OK si todas sus lecturas están en [LSL, USL]; la pieza se acepta si todas sus características y verificaciones son OK. Instrument calibration / Calibración: '+(h.cal||'PENDIENTE')+'. Resolution / Resolución: '+(h.res||'no declarada')+'.';
}
function samplingText(h){ if(h.plan==='MARCA') return '100% of piece marks inspected; one piece per mark selected at random. If that piece is rejected, every piece of the same mark is inspected. / Se inspecciona el 100% de las marcas, una pieza por marca elegida al azar; si esa pieza se rechaza, se inspeccionan todas las piezas de la misma marca.'; return h.plan==='100'?'100% inspection / Inspección al 100%':'ANSI/ASQ Z1.4, single sampling, normal, general level '+h.nivel+', AQL '+h.aql+' — plan pending oWOW approval (ITP hold point) / plan pendiente de aprobación de oWOW (punto H del ITP)'; }
const TOL_SOURCES='Tolerance sources / Fuentes: member length AISC 303-22 §6.4.1; straightness ASTM A6 / A500 via AISC 303-22 §6.4.2; other dimensions per shop drawing Rev 0 title block (FRAC ±1/8", angles ±0.5°) unless noted. Units: inches (decimal), angles in degrees.';

/* ---------- Excel ---------- */
async function buildXlsx(meds){
  const wb=new ExcelJS.Workbook(); wb.creator='CAMI — Aseguramiento de calidad'; wb.created=new Date();
  const NAVY='FF21353E', ORANGE='FFF37933', PAPER='FFFAF6EE', GREY='FFE2DBCD';
  const thin={style:'thin',color:{argb:'FFBFB6A4'}}; const box={top:thin,left:thin,bottom:thin,right:thin};
  prog('Cargando logos y planos…');
  const camiId=wb.addImage({buffer:await fetchBuf('img/cami.png'),extension:'png'});
  const primaId=wb.addImage({buffer:await fetchBuf('img/prima.png'),extension:'png'});
  const planoImg={};
  async function planoId(p){ if(planoImg[p]==null) planoImg[p]=wb.addImage({buffer:await fetchBuf(planoUrl(p)),extension:'jpeg'}); return planoImg[p]; }
  const h=rep.h;
  function header(ws,title,lastCol){
    ws.getRow(1).height=34;
    ws.addImage(camiId,{tl:{col:0,row:0},ext:{width:160,height:39}});
    ws.addImage(primaId,{tl:{col:Math.max(3,lastCol-2),row:0},ext:{width:150,height:34}});
    ws.mergeCells(2,1,2,lastCol); const c=ws.getCell(2,1); c.value='DIMENSIONAL INSPECTION REPORT / REPORTE DE INSPECCIÓN DIMENSIONAL'; c.font={name:'Arial',bold:true,size:13,color:{argb:NAVY}}; c.alignment={horizontal:'center',vertical:'middle'}; ws.getRow(2).height=22;
    ws.mergeCells(3,1,3,lastCol); const c2=ws.getCell(3,1); c2.value=title; c2.font={name:'Arial',size:10,color:{argb:'FF5B6A70'}}; c2.alignment={horizontal:'center'};
    for(let col=1;col<=lastCol;col++){ ws.getCell(4,col).fill={type:'pattern',pattern:'solid',fgColor:{argb:ORANGE}}; } ws.getRow(4).height=4;
  }
  function kv(ws,r,c,k,v,span){ const kc=ws.getCell(r,c); kc.value=k; kc.font={name:'Arial',size:8,bold:true,color:{argb:'FF5B6A70'}};
    ws.mergeCells(r,c+1,r,c+span); const vc=ws.getCell(r,c+1); vc.value=v; vc.font={name:'Arial',size:10,bold:true,color:{argb:NAVY}}; vc.border={bottom:{style:'thin',color:{argb:NAVY}}}; }
  function th(cell,txt){ cell.value=txt; cell.font={name:'Arial',size:8,bold:true,color:{argb:PAPER}}; cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:NAVY}}; cell.alignment={horizontal:'center',vertical:'middle',wrapText:true}; cell.border=box; }
  function td(cell,v,opt){ cell.value=v; cell.font=Object.assign({name:'Arial',size:9},opt&&opt.font||{}); cell.alignment=Object.assign({vertical:'middle',horizontal:'center',wrapText:true},opt&&opt.al||{}); cell.border=box; if(opt&&opt.fmt) cell.numFmt=opt.fmt; if(opt&&opt.fill) cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:opt.fill}}; }
  const RES_FILL={OK:'FFE3F2EA',NOK:'FFFBE6E4',PEND:'FFF8F0D6'}; const RES_FONT={OK:'FF1F7A4D',NOK:'FFB3261E',PEND:'FF8A6D12'};

  /* ---- RESUMEN ---- */
  const ws=wb.addWorksheet('RESUMEN',{views:[{showGridLines:false}],pageSetup:{orientation:'landscape',paperSize:1,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.4,right:.4,top:.5,bottom:.5,header:.2,footer:.2}}});
  ws.columns=[{width:18},{width:12},{width:12},{width:14},{width:14},{width:12},{width:12},{width:10},{width:26},{width:30}];
  header(ws,'Folio '+rep.folio+' · Rev. '+rep.rev+' · '+h.embarque,10);
  let r=6;
  kv(ws,r,1,'Folio',rep.folio,3); kv(ws,r,6,'Fecha / Date',h.fecha,4); r++;
  kv(ws,r,1,'Proyecto / Project',h.proyecto,3); kv(ws,r,6,'Cliente / Client',h.cliente,4); r++;
  kv(ws,r,1,'OC / PO',h.oc,3); kv(ws,r,6,'Embarque / Delivery',h.embarque,4); r++;
  kv(ws,r,1,'Lugar / Location',h.lugar,3); kv(ws,r,6,'Fabricante / Fabricator','CAMI — Comercializadora de Aceros Manufacturados / PRIMA',4); r++;
  kv(ws,r,1,'Instrumento',h.inst,3); kv(ws,r,6,'Serie / ID',h.serie||'NO REGISTRADO',4); r++;
  kv(ws,r,1,'Calibración',h.cal||'PENDIENTE',3); kv(ws,r,6,'Resolución',h.res||'NO DECLARADA',4); r++;
  kv(ws,r,1,'Planos / Drawings','Shop drawings 600–648, Rev 0 (Issued for fabrication 06/09/2026)',8); r+=2;
  ws.mergeCells(r,1,r,10); let c=ws.getCell(r,1); c.value='SAMPLING PLAN / PLAN DE MUESTREO — '+samplingText(h); c.font={name:'Arial',bold:true,size:9,color:{argb:NAVY}}; c.alignment={wrapText:true}; ws.getRow(r).height=26; r++;
  ['Lote / Lot','N (pzas)','Letra','n','Ac','Re','Medidas','NOK','Resultado lote','Muestra / Sample'].forEach((t,i)=>th(ws.getCell(r,i+1),t)); ws.getRow(r).height=24; r++;
  FAMS.forEach(f=>{ const L=rep.lotes[f]; if(!L||!L.N) return; const lr=lotResult(f); const v=lr.v==='ok'?'OK':lr.v==='nok'?'NOK':'PEND';
    td(ws.getCell(r,1),f,{al:{horizontal:'left'}}); td(ws.getCell(r,2),L.N); td(ws.getCell(r,3),L.letter); td(ws.getCell(r,4),L.porMarca?reqUnits(f).length:L.n); td(ws.getCell(r,5),L.porMarca?'0 x marca':L.ac); td(ws.getCell(r,6),L.porMarca?'1 x marca':L.re); td(ws.getCell(r,7),lr.done); td(ws.getCell(r,8),lr.nok);
    td(ws.getCell(r,9),v==='OK'?'ACCEPTED / ACEPTADO':v==='NOK'?'REJECTED / RECHAZADO':'IN PROGRESS / EN PROCESO',{font:{bold:true,color:{argb:RES_FONT[v]}},fill:RES_FILL[v]});
    const RU=reqUnits(f); td(ws.getCell(r,10),RU.map(u=>u.replace('#','-')).join(', '),{al:{horizontal:'left'},font:{size:8}}); ws.getRow(r).height=Math.max(18,Math.ceil(RU.length/4)*12); r++; });
  r++;
  ws.mergeCells(r,1,r,10); c=ws.getCell(r,1); c.value='PIECES INSPECTED / PIEZAS INSPECCIONADAS'; c.font={name:'Arial',bold:true,size:9,color:{argb:NAVY}}; r++;
  ['Marca / Mark','Pieza / Piece','Familia','Plano / Rev','Perfil','Largo','Cotas OK','Cotas NOK','Resultado','Hoja / Sheet'].forEach((t,i)=>th(ws.getCell(r,i+1),t)); ws.getRow(r).height=24; r++;
  const sheetNames={};
  meds.forEach(m=>{ let nm=(m.label+'-'+m.pieza).replace(/[\\\/\?\*\[\]:]/g,'_').slice(0,31); while(sheetNames[nm]) nm=nm.slice(0,28)+'_'+Math.floor(Math.random()*90+10); sheetNames[nm]=1; m._sheet=nm; });
  meds.forEach(m=>{ const s=medStats(m); const v=s.estado==='ok'?'OK':s.estado==='nok'?'NOK':'PEND';
    td(ws.getCell(r,1),m.label,{font:{bold:true}}); td(ws.getCell(r,2),m.pieza+' / '+m.qty); td(ws.getCell(r,3),m.familia); td(ws.getCell(r,4),m.plano+' / Rev 0'); td(ws.getCell(r,5),m.perfil||''); td(ws.getCell(r,6),m.largo||'');
    td(ws.getCell(r,7),s.ok); td(ws.getCell(r,8),s.nok+s.ckN); td(ws.getCell(r,9),EST_EN[s.estado]+' / '+EST_TXT[s.estado],{font:{bold:true,color:{argb:RES_FONT[v]}},fill:RES_FILL[v]});
    const lc=ws.getCell(r,10); td(lc,{text:m._sheet,hyperlink:"#'"+m._sheet+"'!A1"},{font:{color:{argb:'FF1F5FA8'},underline:true}}); r++; });
  r++;
  ws.mergeCells(r,1,r+2,10); c=ws.getCell(r,1); c.value=decisionRule(h)+'\n'+TOL_SOURCES; c.font={name:'Arial',size:8,color:{argb:'FF5B6A70'}}; c.alignment={wrapText:true,vertical:'top'}; r+=4;
  const sig=[['Elaboró / Prepared by (Inspector QC)',h.inspector],['Revisó / Reviewed by',h.reviso],['Aprobó / Approved by',h.aprobo]];
  sig.forEach((s,i)=>{ const col=1+i*3+(i>0?1:0); ws.mergeCells(r,col,r,col+2); const a=ws.getCell(r,col); a.value=''; a.border={bottom:{style:'thin',color:{argb:NAVY}}}; ws.getRow(r).height=36;
    ws.mergeCells(r+1,col,r+1,col+2); const b=ws.getCell(r+1,col); b.value=s[0]; b.font={name:'Arial',size:8,bold:true,color:{argb:'FF5B6A70'}};
    ws.mergeCells(r+2,col,r+2,col+2); const d=ws.getCell(r+2,col); d.value=(s[1]||'Nombre / Name')+'   Firma / Signature · Fecha / Date: ________'; d.font={name:'Arial',size:9,color:{argb:NAVY}}; });
  ws.headerFooter.oddFooter='&L'+rep.folio+' · CAMI QC&RPage &P of &N';

  /* ---- Una hoja por marca ---- */
  let idx=0;
  for(const m of meds){
    idx++; prog('Excel: hoja '+idx+' de '+meds.length+' ('+m.label+')…');
    const ncol=Math.max(1,...m.cotas.map(c=>(c.lect||[]).filter(x=>String(x).trim()!=='').length),1);
    const last=8+ncol+2; // A..H fijos, lecturas, resultado, criterio
    const w=wb.addWorksheet(m._sheet,{views:[{showGridLines:false}],pageSetup:{orientation:'landscape',paperSize:1,fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.4,right:.4,top:.5,bottom:.5,header:.2,footer:.2}}});
    const cols=[{width:30},{width:18},{width:11},{width:12},{width:8},{width:8},{width:10},{width:10}]; for(let i=0;i<ncol;i++) cols.push({width:10}); cols.push({width:12}); cols.push({width:42}); w.columns=cols;
    header(w,'Folio '+rep.folio+' · '+m.label+' · pieza '+m.pieza+' de '+m.qty,last);
    let rr=6; const s=medStats(m); const v=s.estado==='ok'?'OK':s.estado==='nok'?'NOK':'PEND';
    kv(w,rr,1,'Marca / Mark',m.label+'  ·  pieza '+m.pieza+' de '+m.qty,2); kv(w,rr,5,'Plano / Drawing',m.plano+' — Rev 0',3); rr++;
    kv(w,rr,1,'Perfil / Shape',m.perfil||'',2); kv(w,rr,5,'Material',m.material||'',3); rr++;
    kv(w,rr,1,'Largo BOM / Length',m.largo||'',2); kv(w,rr,5,'Familia / Type',m.familia,3); rr++;
    kv(w,rr,1,'Inspector',m.insp||h.inspector||'',2); kv(w,rr,5,'Fecha / Date',(m.cierre||m.upd||'').slice(0,10)||h.fecha,3); rr++;
    const rc=w.getCell(rr,1); rc.value='RESULT / RESULTADO: '+EST_EN[s.estado]+' / '+EST_TXT[s.estado]; rc.font={name:'Arial',bold:true,size:11,color:{argb:RES_FONT[v]}}; w.mergeCells(rr,1,rr,4); rc.fill={type:'pattern',pattern:'solid',fgColor:{argb:RES_FILL[v]}}; rr+=2;
    const hdr=['Característica / Characteristic','Tipo / Type','Nominal (in)','Nominal (ft-in)','Tol − ','Tol +','LSL','USL']; for(let i=0;i<ncol;i++) hdr.push('M'+(i+1)); hdr.push('Result.'); hdr.push('Criterio / Tolerance source');
    hdr.forEach((t,i)=>th(w.getCell(rr,i+1),t)); w.getRow(rr).height=28; rr++;
    const colL=(n)=>w.getColumn(n).letter;
    m.cotas.forEach(cq=>{
      const st=cotaStats(cq); const deg=TIPOS[cq.tipo].uni==='deg'; const fmt=deg?'0.0':'0.000';
      td(w.getCell(rr,1),(cq.L?cq.L+' · ':'')+cq.etq,{al:{horizontal:'left'}}); td(w.getCell(rr,2),TIPOS[cq.tipo].en,{font:{size:8}});
      td(w.getCell(rr,3),isNaN(st.nom)?null:st.nom,{fmt}); td(w.getCell(rr,4),deg?(isNaN(st.nom)?'':st.nom+'°'):toFtIn(st.nom));
      td(w.getCell(rr,5),isNaN(st.tm)?null:st.tm,{fmt}); td(w.getCell(rr,6),isNaN(st.tp)?null:st.tp,{fmt});
      const C=colL(3),E=colL(5),F=colL(6);
      td(w.getCell(rr,7),{formula:'IF(ISNUMBER('+C+rr+'),'+C+rr+'-'+E+rr+',"")',result:isNaN(st.lsl)?'':r3(st.lsl)},{fmt});
      td(w.getCell(rr,8),{formula:'IF(ISNUMBER('+C+rr+'),'+C+rr+'+'+F+rr+',"")',result:isNaN(st.usl)?'':r3(st.usl)},{fmt});
      const rv=(cq.lect||[]).map(x=>cotaVal(cq,x)).filter(x=>!isNaN(x));
      for(let i=0;i<ncol;i++){ const val=rv[i]; const cell=w.getCell(rr,9+i); const okv=(val!=null&&!isNaN(st.lsl))?(val>=st.lsl-1e-9&&val<=st.usl+1e-9):null;
        td(cell,val==null?null:val,{fmt,font:{bold:true,color:{argb:okv===false?'FFB3261E':'FF1D2A30'}}}); }
      const a=colL(9)+rr, b=colL(8+ncol)+rr, G=colL(7)+rr, H=colL(8)+rr;
      const resTxt=st.res==='ok'?'OK':st.res==='nok'?'NOK':'PEND';
      if(cq.na){ td(w.getCell(rr,9+ncol),'N/A',{font:{bold:true,color:{argb:'FF5B6A70'}},fill:'FFF2EDE3'}); td(w.getCell(rr,10+ncol),'N/A — '+(cq.naWhy||'no aplica'),{al:{horizontal:'left'},font:{size:8}}); w.getRow(rr).height=26; rr++; return; }
      td(w.getCell(rr,9+ncol),{formula:'IF(OR(COUNT('+a+':'+b+')=0,'+G+'=""),"PEND",IF(AND(MIN('+a+':'+b+')>='+G+'-0.000001,MAX('+a+':'+b+')<='+H+'+0.000001),"OK","NOK"))',result:resTxt},{font:{bold:true,color:{argb:RES_FONT[resTxt]}},fill:RES_FILL[resTxt]});
      td(w.getCell(rr,10+ncol),cq.clause,{al:{horizontal:'left'},font:{size:8}});
      w.getRow(rr).height=26; rr++;
    });
    rr++;
    th(w.getCell(rr,1),'Verificación visual / Visual check'); w.mergeCells(rr,2,rr,3); th(w.getCell(rr,2),'Resultado'); rr++;
    CHECKS.forEach(k=>{ const vv=(m.checks||{})[k.k]||'—'; td(w.getCell(rr,1),k.es+' / '+k.en,{al:{horizontal:'left'},font:{size:8}}); w.mergeCells(rr,2,rr,3);
      const key=vv==='OK'?'OK':vv==='NOK'?'NOK':'PEND'; td(w.getCell(rr,2),vv,{font:{bold:true,color:{argb:RES_FONT[key]}},fill:vv==='N/A'?'FFF2EDE3':RES_FILL[key]}); w.getRow(rr).height=22; rr++; });
    rr++;
    w.mergeCells(rr,1,rr,last); const oc=w.getCell(rr,1); oc.value='Observaciones / Remarks: '+(m.obs||'—'); oc.font={name:'Arial',size:9}; oc.alignment={wrapText:true,vertical:'top'}; w.getRow(rr).height=34; rr+=2;
    /* Fotos: 2 por renglón, 300x225 px */
    if((m.fotos||[]).length){
      w.getCell(rr,1).value='FOTOGRAFÍAS / PHOTOGRAPHS'; w.getCell(rr,1).font={name:'Arial',bold:true,size:10,color:{argb:NAVY}}; rr++;
      for(let i=0;i<m.fotos.length;i++){
        const f=m.fotos[i]; let buf; try{ buf=await photoBuf(f); }catch(e){ continue; }
        const iid=wb.addImage({buffer:buf,extension:'jpeg'});
        const ar=(f.w&&f.h)?f.h/f.w:0.75; const W=300, H=Math.round(W*ar);
        const colStart=(i%2===0)?0:2.2; const rowsPer=Math.ceil((H+22)/20);
        w.addImage(iid,{tl:{col:colStart,row:rr-1},ext:{width:W,height:H}});
        const capRow=rr+Math.ceil(H/20); const cap=w.getCell(capRow,(i%2===0)?1:3); cap.value='Foto '+(i+1)+' — '+(f.tag||''); cap.font={name:'Arial',size:8,italic:true,color:{argb:'FF5B6A70'}};
        if(i%2===1||i===m.fotos.length-1) rr+=rowsPer+1;
      }
    }
    /* Plano */
    rr++; w.getCell(rr,1).value='VISTA CON REFERENCIAS / VIEW WITH DIMENSION REFERENCES — Plano '+m.plano+' Rev 0'; w.getCell(rr,1).font={name:'Arial',bold:true,size:10,color:{argb:NAVY}}; rr++;
    { const cj=await planoJpeg(m,{maxW:2000}); const iid=wb.addImage({buffer:cj.buf,extension:'jpeg'}); const Wd=1050, Hd=Math.round(Wd*cj.h/cj.w); w.addImage(iid,{tl:{col:0,row:rr-1},ext:{width:Wd,height:Hd}}); rr+=Math.ceil(Hd/20)+2; }
    w.getCell(rr,1).value='PLANO COMPLETO / FULL SHOP DRAWING '+m.plano+' — Rev 0'; w.getCell(rr,1).font={name:'Arial',bold:true,size:10,color:{argb:NAVY}}; rr++;
    { const fj=await planoJpeg(m,{full:true,maxW:3000}); const iid=wb.addImage({buffer:fj.buf,extension:'jpeg'}); w.addImage(iid,{tl:{col:0,row:rr-1},ext:{width:1050,height:700}}); }
    w.headerFooter.oddFooter='&L'+rep.folio+' · '+m.label+'-'+m.pieza+'&RPage &P of &N';
  }
  prog('Escribiendo Excel…');
  const out=await wb.xlsx.writeBuffer();
  return new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}

/* ---------- PDF ---------- */
function T(s){ // WinAnsi-safe
  if(s==null) return ''; return String(s).replace(/[−–—]/g,'-').replace(/[“”″]/g,'"').replace(/[‘’′]/g,"'").replace(/…/g,'...').replace(/≤/g,'<=').replace(/≥/g,'>=').replace(/×/g,'x').replace(/✓/g,'').replace(/[^\x09\x0A\x0D\x20-\x7E -ÿ]/g,'');
}
async function buildPdf(meds){
  const {PDFDocument,StandardFonts,rgb}=PDFLib;
  const doc=await PDFDocument.create(); doc.setTitle(rep.folio+' Dimensional Report'); doc.setAuthor('CAMI QC'); doc.setCreator('CAMI Dimensional P6');
  const F=await doc.embedFont(StandardFonts.Helvetica), FB=await doc.embedFont(StandardFonts.HelveticaBold), FI=await doc.embedFont(StandardFonts.HelveticaOblique);
  const hex=h=>{ const n=parseInt(h.slice(1),16); return rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255); };
  const NAVY=hex('#21353E'),OR=hex('#F37933'),SOFT=hex('#5B6A70'),RULE=hex('#CFC6B4'),PAPER=hex('#FAF6EE'),OKc=hex('#1F7A4D'),NOKc=hex('#B3261E'),PENDc=hex('#8A6D12'),OKb=hex('#E3F2EA'),NOKb=hex('#FBE6E4'),PENDb=hex('#F8F0D6');
  const RESC={OK:[OKc,OKb],NOK:[NOKc,NOKb],PEND:[PENDc,PENDb]};
  prog('PDF: cargando logos…');
  const camiImg=await doc.embedPng(await fetchBuf('img/cami.png')); const primaImg=await doc.embedPng(await fetchBuf('img/prima.png'));
  const W=792,H=612,M=32; const h=rep.h; let pageNo=0;
  function text(pg,s,x,y,o){ o=o||{}; pg.drawText(T(s),{x,y,size:o.size||9,font:o.font||F,color:o.color||NAVY}); }
  function wrap(s,font,size,maxW){ const words=T(s).split(/\s+/); const lines=[]; let cur=''; words.forEach(wd=>{ const t=cur?cur+' '+wd:wd; if(font.widthOfTextAtSize(t,size)>maxW&&cur){ lines.push(cur); cur=wd; } else cur=t; }); if(cur) lines.push(cur); return lines; }
  function para(pg,s,x,y,maxW,o){ o=o||{}; const size=o.size||8, lh=o.lh||size*1.3; const ls=wrap(s,o.font||F,size,maxW); ls.forEach((l,i)=>text(pg,l,x,y-i*lh,{size,font:o.font,color:o.color})); return y-ls.length*lh; }
  function fit(s,font,size,maxW){ s=T(s); if(font.widthOfTextAtSize(s,size)<=maxW) return s; while(s.length>1&&font.widthOfTextAtSize(s+'...',size)>maxW) s=s.slice(0,-1); return s+'...'; }
  function newPage(sub){
    const pg=doc.addPage([W,H]); pageNo++;
    pg.drawImage(camiImg,{x:M,y:H-M-26,width:camiImg.width*26/camiImg.height,height:26});
    const ps=24/primaImg.height; pg.drawImage(primaImg,{x:W-M-primaImg.width*ps,y:H-M-24,width:primaImg.width*ps,height:24});
    const t1='DIMENSIONAL INSPECTION REPORT / REPORTE DE INSPECCION DIMENSIONAL'; text(pg,t1,(W-FB.widthOfTextAtSize(t1,12))/2,H-M-12,{size:12,font:FB});
    const t2=T(sub); text(pg,t2,(W-F.widthOfTextAtSize(t2,8.5))/2,H-M-25,{size:8.5,color:SOFT});
    pg.drawRectangle({x:M,y:H-M-34,width:W-2*M,height:3,color:OR});
    pg.drawLine({start:{x:M,y:M-6},end:{x:W-M,y:M-6},thickness:.5,color:RULE});
    text(pg,rep.folio+' · Rev. '+rep.rev+' · CAMI QC · '+h.proyecto,M,M-17,{size:7,color:SOFT});
    return pg;
  }
  function kvs(pg,items,y,cols){ const cw=(W-2*M)/cols; items.forEach((it,i)=>{ const x=M+(i%cols)*cw; const yy=y-Math.floor(i/cols)*24; text(pg,it[0].toUpperCase(),x,yy,{size:6.5,font:FB,color:SOFT}); text(pg,fit(it[1]||'—',FB,9,cw-10),x,yy-11,{size:9,font:FB}); pg.drawLine({start:{x,y:yy-14},end:{x:x+cw-10,y:yy-14},thickness:.5,color:NAVY}); }); return y-Math.ceil(items.length/cols)*24; }
  function table(pg,x,y,widths,headers,rows,o){ o=o||{}; const hh=o.hh||20, rh=o.rh||16; let cx=x;
    pg.drawRectangle({x,y:y-hh,width:widths.reduce((a,b)=>a+b,0),height:hh,color:NAVY});
    headers.forEach((t,i)=>{ const ls=wrap(t,FB,6.5,widths[i]-4); ls.slice(0,2).forEach((l,j)=>text(pg,l,cx+(widths[i]-FB.widthOfTextAtSize(l,6.5))/2,y-8-j*7.5+(ls.length===1?-3:0),{size:6.5,font:FB,color:PAPER})); cx+=widths[i]; });
    let yy=y-hh;
    rows.forEach(row=>{ let cx2=x; const rhh=row._h||rh;
      row.forEach((cell,i)=>{ const c=(cell&&typeof cell==='object')?cell:{t:cell}; if(c.bg) pg.drawRectangle({x:cx2,y:yy-rhh,width:widths[i],height:rhh,color:c.bg});
        const size=c.size||8, font=c.font||F;
        if(c.wrap){ let ls=wrap(c.t==null?'':c.t,font,size,widths[i]-6); const maxL=Math.max(1,Math.floor((rhh-2)/(size*1.15))); if(ls.length>maxL){ ls=ls.slice(0,maxL); ls[maxL-1]=fit(ls[maxL-1]+' ...',font,size,widths[i]-6); }
          const lh=size*1.15, top=yy-(rhh-ls.length*lh)/2-size+1; ls.forEach((l,k)=>{ const tx=c.left?cx2+3:cx2+(widths[i]-font.widthOfTextAtSize(l,size))/2; text(pg,l,tx,top-k*lh,{size,font,color:c.color||hex('#1D2A30')}); }); }
        else { const s=fit(c.t==null?'':c.t,font,size,widths[i]-6);
        const tx=c.left?cx2+3:cx2+(widths[i]-font.widthOfTextAtSize(s,size))/2; text(pg,s,tx,yy-rhh/2-size/2+2,{size,font,color:c.color||hex('#1D2A30')}); }
        pg.drawRectangle({x:cx2,y:yy-rhh,width:widths[i],height:rhh,borderColor:RULE,borderWidth:.5}); cx2+=widths[i]; });
      yy-=rhh; });
    return yy;
  }
  /* ---- Portada / resumen ---- */
  prog('PDF: resumen…');
  let pg=newPage('Folio '+rep.folio+' · '+h.embarque);
  let y=H-M-52;
  y=kvs(pg,[['Folio',rep.folio],['Fecha / Date',h.fecha],['OC / PO',h.oc],['Embarque / Delivery',h.embarque],
    ['Proyecto / Project',h.proyecto],['Cliente / Client',h.cliente],['Lugar / Location',h.lugar],['Planos / Drawings','600-648 Rev 0 (IFF 06/09/2026)'],
    ['Instrumento',h.inst],['Serie / ID',h.serie||'NO REGISTRADO'],['Calibracion',h.cal||'PENDIENTE'],['Resolucion',h.res||'NO DECLARADA']],y,4)-6;
  text(pg,'SAMPLING PLAN / PLAN DE MUESTREO',M,y,{size:8,font:FB}); y-=4; y=para(pg,samplingText(h),M,y-8,W-2*M,{size:7.5,color:SOFT})-4;
  const lotRows=[]; FAMS.forEach(f=>{ const L=rep.lotes[f]; if(!L||!L.N) return; const lr=lotResult(f); const v=lr.v==='ok'?'OK':lr.v==='nok'?'NOK':'PEND';
    lotRows.push([{t:f,left:true,font:FB},L.N,L.letter,L.porMarca?reqUnits(f).length:L.n,L.porMarca?'0/1 x marca':L.ac+'/'+L.re,lr.done,lr.nok,{t:v==='OK'?'ACCEPTED / ACEPTADO':v==='NOK'?'REJECTED / RECHAZADO':'IN PROGRESS',font:FB,color:RESC[v][0],bg:RESC[v][1],size:7},{t:reqUnits(f).map(u=>u.replace('#','-')).join(', '),left:true,size:6.5,wrap:true}]); });
  y=table(pg,M,y,[110,40,34,30,40,44,34,110,286],['Lote / Lot','N','Letra','n','Ac/Re','Medidas','NOK','Resultado lote','Muestra / Sample units'],lotRows,{rh:15})-12;
  /* piezas: puede requerir varias páginas */
  const pieceRows=meds.map(m=>{ const s=medStats(m); const v=s.estado==='ok'?'OK':s.estado==='nok'?'NOK':'PEND';
    return [{t:m.label,font:FB},m.pieza+'/'+m.qty,m.familia,m.plano+' R0',{t:m.perfil||'',size:7},m.largo||'',s.ok+'/'+s.tot,s.nok+s.ckN,(m.fotos||[]).length,{t:EST_EN[s.estado]+' / '+EST_TXT[s.estado],font:FB,color:RESC[v][0],bg:RESC[v][1],size:7}]; });
  const pw=[70,44,96,50,92,64,50,44,40,178]; const ph=['Marca / Mark','Pieza','Familia','Plano','Perfil / Shape','Largo','Cotas OK','NOK','Fotos','Resultado / Result'];
  text(pg,'PIECES INSPECTED / PIEZAS INSPECCIONADAS',M,y,{size:8,font:FB}); y-=6;
  let i0=0; while(i0<pieceRows.length){ const cap=Math.max(1,Math.floor((y-M-150)/14)); const chunk=pieceRows.slice(i0,i0+cap); y=table(pg,M,y,pw,ph,chunk,{rh:14}); i0+=chunk.length; if(i0<pieceRows.length){ pg=newPage('Folio '+rep.folio+' · piezas (cont.)'); y=H-M-52; } }
  if(y<M+150){ pg=newPage('Folio '+rep.folio); y=H-M-52; }
  y-=10; y=para(pg,decisionRule(h),M,y,W-2*M,{size:7,color:SOFT}); y=para(pg,TOL_SOURCES,M,y-3,W-2*M,{size:7,color:SOFT});
  const sy=Math.max(M+40,y-50); const sw=(W-2*M-40)/3;
  [['Elaboro / Prepared by (QC Inspector)',h.inspector],['Reviso / Reviewed by',h.reviso],['Aprobo / Approved by',h.aprobo]].forEach((s,i)=>{ const x=M+i*(sw+20);
    pg.drawLine({start:{x,y:sy},end:{x:x+sw,y:sy},thickness:.7,color:NAVY}); text(pg,s[0],x,sy-10,{size:7,font:FB,color:SOFT}); text(pg,(s[1]||'Nombre / Name')+'  ·  Firma y fecha / Signature & date',x,sy-21,{size:8}); });

  /* ---- Una sección por marca ---- */
  const planoDocs={};
  let idx=0;
  for(const m of meds){
    idx++; prog('PDF: marca '+idx+' de '+meds.length+' ('+m.label+')…');
    const s=medStats(m); const v=s.estado==='ok'?'OK':s.estado==='nok'?'NOK':'PEND';
    pg=newPage('Folio '+rep.folio+' · '+m.label+' · pieza '+m.pieza+' de '+m.qty); y=H-M-52;
    y=kvs(pg,[['Marca / Mark',m.label+'  ·  '+m.pieza+' de '+m.qty],['Plano / Drawing',m.plano+' - Rev 0'],['Perfil / Shape',m.perfil],['Material',m.material],
      ['Largo BOM',m.largo],['Familia',m.familia],['Inspector',m.insp||h.inspector],['Fecha / Date',(m.cierre||m.upd||'').slice(0,10)||h.fecha]],y,4)-4;
    pg.drawRectangle({x:M,y:y-18,width:260,height:18,color:RESC[v][1]}); text(pg,'RESULT / RESULTADO: '+EST_EN[s.estado]+' / '+EST_TXT[s.estado],M+6,y-12.5,{size:9.5,font:FB,color:RESC[v][0]}); y-=28;
    const ncol=Math.max(1,...m.cotas.map(c=>(c.lect||[]).filter(x=>String(x).trim()!=='').length));
    const readW=Math.min(52,Math.floor(170/ncol)); const wds=[132,70,46,56,34,34,46,46]; for(let i=0;i<ncol;i++) wds.push(readW); wds.push(40); const used=wds.reduce((a,b)=>a+b,0); wds.push(W-2*M-used);
    const hd=['Caracteristica / Characteristic','Tipo / Type','Nom. (in)','Nom. ft-in','Tol -','Tol +','LSL','USL']; for(let i=0;i<ncol;i++) hd.push('M'+(i+1)); hd.push('Result.'); hd.push('Criterio / Tolerance source');
    const rows=m.cotas.map(c=>{ const st=cotaStats(c); const deg=TIPOS[c.tipo].uni==='deg'; const fx=x=>isNaN(x)?'':(deg?(Math.round(x*10)/10).toFixed(1):f3(x));
      const rv=(c.lect||[]).map(x=>cotaVal(c,x)).filter(x=>!isNaN(x)); const rr=[{t:(c.L?c.L+' · ':'')+c.etq,left:true,size:7.5,wrap:true},{t:TIPOS[c.tipo].en,size:6,wrap:true},fx(st.nom),deg?(isNaN(st.nom)?'':st.nom+' deg'):toFtIn(st.nom),fx(st.tm),fx(st.tp),fx(st.lsl),fx(st.usl)];
      for(let i=0;i<ncol;i++){ const val=rv[i]; const bad=val!=null&&!isNaN(st.lsl)&&!(val>=st.lsl-1e-9&&val<=st.usl+1e-9); rr.push({t:val==null?'':fx(val),font:FB,color:bad?NOKc:hex('#1D2A30')}); }
      if(c.na){ rr.push({t:'N/A',font:FB,color:SOFT,bg:hex('#F2EDE3')}); rr.push({t:'N/A - '+(c.naWhy||'no aplica'),left:true,size:6,wrap:true}); return rr; }
      const rk=st.res==='ok'?'OK':st.res==='nok'?'NOK':'PEND'; rr.push({t:rk,font:FB,color:RESC[rk][0],bg:RESC[rk][1]}); rr.push({t:c.clause,left:true,size:6,wrap:true}); return rr; });
    { let i0=0; while(i0<rows.length){ const cap=Math.max(1,Math.floor((y-M-30)/22)-1); const ch=rows.slice(i0,i0+cap); y=table(pg,M,y,wds,hd,ch,{rh:22}); i0+=ch.length;
        if(i0<rows.length){ pg=newPage('Folio '+rep.folio+' · '+m.label+'-'+m.pieza+' · cotas (cont.)'); y=H-M-52; } } y-=10;
      if(y<M+110){ pg=newPage('Folio '+rep.folio+' · '+m.label+'-'+m.pieza); y=H-M-52; } }
    const ckRows=CHECKS.map(k=>{ const vv=(m.checks||{})[k.k]||'-'; const key=vv==='OK'?'OK':vv==='NOK'?'NOK':'PEND'; return [{t:k.es+' / '+k.en,left:true,size:7},{t:vv,font:FB,color:RESC[key][0],bg:vv==='N/A'?hex('#F2EDE3'):RESC[key][1]}]; });
    const yck=table(pg,M,y,[300,60],['Verificacion visual / Visual check','Result.'],ckRows,{rh:14,hh:16});
    para(pg,'Observaciones / Remarks: '+(m.obs||'-'),M+380,y-8,W-2*M-380,{size:8});
    y=yck-10;
    /* fotos: en la misma página si caben, luego páginas de 2x2 */
    const fotos=m.fotos||[]; let fi=0;
    const drawPhotos=async(pgx,top,avail)=>{ const cols=3, gap=10; const cw=(W-2*M-gap*(cols-1))/cols; const chh=cw*0.75; const rowsFit=Math.floor((avail+gap)/(chh+14+gap)); let placed=0;
      for(let rrI=0; rrI<rowsFit && fi<fotos.length; rrI++){ for(let cI=0;cI<cols && fi<fotos.length;cI++){ const f=fotos[fi]; let img=null; try{ img=await doc.embedJpg(await photoBuf(f)); }catch(e){ fi++; continue; }
          const x=M+cI*(cw+gap); const yt=top-rrI*(chh+14+gap); const sc=Math.min(cw/img.width,chh/img.height); const iw=img.width*sc, ih=img.height*sc;
          pgx.drawRectangle({x,y:yt-chh,width:cw,height:chh,color:hex('#F2EDE3')}); pgx.drawImage(img,{x:x+(cw-iw)/2,y:yt-chh+(chh-ih)/2,width:iw,height:ih});
          text(pgx,'Foto '+(fi+1)+' - '+(f.tag||''),x,yt-chh-10,{size:7,font:FI,color:SOFT}); fi++; placed++; } }
      return placed; };
    const chhEst=((W-2*M-20)/3)*0.75+30;
    if(fotos.length){ if(y-M>chhEst){ text(pg,'FOTOGRAFIAS / PHOTOGRAPHS',M,y,{size:8,font:FB}); await drawPhotos(pg,y-6,y-6-M); }
      while(fi<fotos.length){ pg=newPage('Folio '+rep.folio+' · '+m.label+'-'+m.pieza+' · fotografias'); const top=H-M-50; text(pg,'FOTOGRAFIAS / PHOTOGRAPHS',M,top,{size:8,font:FB}); const n=await drawPhotos(pg,top-6,top-6-M); if(!n) break; } }
    /* plano original (vector) */
    if(!planoDocs[m.plano]) planoDocs[m.plano]=await PDFDocument.load(await fetchBuf(planoUrl(m.plano,'pdf')));
    const pages=await doc.copyPages(planoDocs[m.plano],planoDocs[m.plano].getPageIndices()); pages.forEach(p=>doc.addPage(p));
    { const pp=pages[0]; const ph=pp.getHeight(); const sx=pp.getWidth()/PAGE_W, sy=ph/PAGE_H; const R0=13;
      const b=markBox(m); pp.drawRectangle({x:b[0]*sx,y:ph-b[3]*sy,width:(b[2]-b[0])*sx,height:(b[3]-b[1])*sy,borderColor:OR,borderWidth:2,opacity:0,borderOpacity:.9});
      pp.drawText(T(m.label+' - pieza '+m.pieza+' de '+m.qty+' - '+rep.folio),{x:b[0]*sx+4,y:ph-b[1]*sy-14,size:12,font:FB,color:OR});
      m.cotas.forEach(c=>{ if(!c.ref||!c.L) return; const x=c.ref.x*sx, y=ph-c.ref.y*sy; const bx=x+R0*1.25, by=y+R0*1.35; const col=c.na?SOFT:hex('#D0461B');
        pp.drawLine({start:{x,y},end:{x:bx,y:by},thickness:1.2,color:col}); pp.drawCircle({x,y,size:2,color:col});
        pp.drawCircle({x:bx,y:by,size:R0,color:rgb(1,1,1),opacity:.9,borderColor:col,borderWidth:1.6});
        const fs=c.L.length>1?10:13; const tw=FB.widthOfTextAtSize(c.L,fs); pp.drawText(c.L,{x:bx-tw/2,y:by-fs*0.35,size:fs,font:FB,color:col}); }); }
  }
  prog('Escribiendo PDF…');
  const bytes=await doc.save();
  return new Blob([bytes],{type:'application/pdf'});
}

boot();
