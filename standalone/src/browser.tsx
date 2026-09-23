import { useEffect, useState, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';

declare global { interface Window { FIBDAStandalone: any; FIBDAPythonRuntime: any; } }
const DB = 'fibda-autonome-v1';
let db: IDBDatabase;
let python: any;
let sequence = Promise.resolve<any>(null);
let lastSnapshot = '';
const sessionKey = 'fibda-test-actor';
const progress = (text: string) => { const p = document.getElementById('boot-status'); if (p) p.textContent = text; };
const b64 = (bytes: Uint8Array) => { let result = ''; for(let i=0;i<bytes.length;i+=32768) result += String.fromCharCode(...bytes.subarray(i,i+32768)); return btoa(result); };
const unb64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function openDB() {
  db = await new Promise<IDBDatabase>((resolve,reject) => {
    const r = indexedDB.open(DB,1);
    r.onupgradeneeded = () => r.result.createObjectStore('data');
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
}
function read(key = 'snapshot'): Promise<string|undefined> {
  return new Promise((resolve,reject) => { const r = db.transaction('data').objectStore('data').get(key); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
}
function save(value: string, key = 'snapshot'): Promise<void> {
  return new Promise((resolve,reject) => { const tx = db.transaction('data','readwrite'); tx.objectStore('data').put(value,key); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error || new Error('Enregistrement interrompu')); });
}
class StorageConflict extends Error {}
function commit(value: string, expected: string | undefined): Promise<void> {
  return new Promise((resolve,reject) => {
    const tx=db.transaction('data','readwrite'), store=tx.objectStore('data');
    let conflict=false;
    const current=store.get('snapshot');
    current.onsuccess=()=>{if(current.result!==expected){conflict=true;tx.abort();}else store.put(value,'snapshot');};
    tx.oncomplete=()=>resolve();
    tx.onabort=()=>reject(conflict?new StorageConflict():tx.error||new Error('Enregistrement interrompu'));
    tx.onerror=()=>reject(tx.error);
  });
}
function serialized<T>(run:()=>Promise<T>): Promise<T> {
  const retry=async()=>{for(let attempt=0;attempt<4;attempt++){try{return await run();}catch(error){if(!(error instanceof StorageConflict)||attempt===3)throw error;}}throw new Error('Veuillez réessayer.');};
  const locked=async():Promise<T>=>navigator.locks?await navigator.locks.request('fibda-autonome-state',retry):await retry();
  const job=sequence.then(locked);sequence=job.catch(()=>{});return job;
}
function pyCall(method: string, args: any[]) {
  python.globals.set('_browser_args', JSON.stringify(args));
  return python.runPython(`bridge.${method}(*json.loads(_browser_args))`);
}
async function execute(method: string, path: string, data: any = {}) {
  const run = async () => {
    const stored = await read();
    if(stored && stored !== lastSnapshot) { pyCall('init',[stored]); lastSnapshot=stored; }
    if(path === '/restore' && stored) await save(stored, 'before-restore');
    const result = JSON.parse(pyCall('handle',[method,path,JSON.stringify(data),sessionStorage.getItem(sessionKey)||'']));
    const next = pyCall('snapshot',[]);
    if (next !== lastSnapshot) {
      try { await commit(next, stored); } catch(e) { if(lastSnapshot) pyCall('init',[lastSnapshot]); if(e instanceof StorageConflict)throw e; throw new Error('Stockage local indisponible ou plein. Action non confirmée. Exportez une sauvegarde.'); }
      lastSnapshot = next;
    }
    if(result.status < 400 && result.data?.user && ['/auth/login','/auth/setup'].includes(path)) sessionStorage.setItem(sessionKey,result.data.user.id);
    if(result.status < 400 && path==='/demo' && result.data?.state?.me) sessionStorage.setItem(sessionKey,result.data.state.me.id);
    if(result.status < 400 && (path==='/auth/logout' || path==='/restore')) sessionStorage.removeItem(sessionKey);
    if(result.status < 400 && method !== 'GET' && path !== '/tick') window.dispatchEvent(new Event('fibda-local-change'));
    return result;
  };
  return serialized(run);
}
async function photo(file: Blob, crop?: number[]) {
  if(file.size > 20*1024*1024) throw new Error('Photo trop volumineuse (20 Mo maximum).');
  const url=URL.createObjectURL(file), img=new Image();
  try {
    await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('Image non reconnue. Utilisez JPEG, PNG ou WebP.'));img.src=url;});
    if(img.naturalWidth*img.naturalHeight>25000000) throw new Error('Image trop grande (25 millions de pixels maximum).');
    const [x,y,right,bottom] = crop || [0,0,img.naturalWidth,img.naturalHeight];
    if(x<0||y<0||right>img.naturalWidth||bottom>img.naturalHeight||right<=x||bottom<=y) throw new Error('Recadrage invalide.');
    const w=right-x,h=bottom-y,scale=Math.min(1,1600/w,2000/h),canvas=document.createElement('canvas');
    canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);
    const context=canvas.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,x,y,w,h,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.88);
  } finally { URL.revokeObjectURL(url); }
}
async function request(path: string, options: RequestInit = {}) {
  let body:any = typeof options.body==='string' ? JSON.parse(options.body) : {};
  if(options.body instanceof FormData) {
    const fd=options.body, file=fd.get('file') as File;
    if(!file) throw new Error('Fichier requis.');
    if(file.size>200*1024*1024) throw new Error('Fichier trop volumineux (200 Mo maximum).');
    body=Object.fromEntries([...fd.entries()].filter(([key])=>key!=='file'));
    if(path==='/photos') { body.data_url=await photo(file, body.crop ? JSON.parse(body.crop):undefined); delete body.crop; }
    else {
      body.filename=file.name; body.data_b64=b64(new Uint8Array(await file.arrayBuffer()));
      if(path==='/photos/batch') {
        body.mappings=JSON.parse(body.mappings);
        const preview=await execute('POST','/photos/batch/preview',body);
        if(preview.status>=400) return response(preview);
        const items=[];
        for(const item of preview.data.items) {
          const [header,encoded]=item.data_url.split(',');
          const blob=new Blob([unb64(encoded)],{type:header.match(/^data:(.*);base64$/)?.[1]||'image/jpeg'});
          items.push({...item,data_url:await photo(blob,item.crop)});
        }
        body={items};
      }
    }
  }
  return response(await execute(options.method || 'GET',path,body));
}
function response(result:any) {
  const data=result.data, headers=result.headers || {};
  if(data?.data_b64) return new Response(unb64(data.data_b64),{status:result.status,headers:{'Content-Type':data.mime,'Content-Disposition':`attachment; filename="${data.name}"`,...headers}});
  if(typeof data==='string' && (headers['Content-Type']||headers['content-type']||'').includes('text/html')) return new Response(data,{status:result.status,headers});
  return new Response(JSON.stringify(data),{status:result.status,headers:{'Content-Type':'application/json',...headers}});
}
export function LocalImage(props: ImgHTMLAttributes<HTMLImageElement>) {
  const [resolved,setResolved]=useState<{src?:string,data:string}>({data:''});
  const remote=props.src?.startsWith('/api/v1/photos/');
  useEffect(()=>{let live=true;if(remote)request(props.src!.slice(7)).then(r=>r.json()).then(r=>{if(live)setResolved({src:props.src,data:r.data_url||''});}).catch(()=>{if(live)setResolved({src:props.src,data:''});});return()=>{live=false;};},[props.src]);
  return <img {...props} src={remote ? (resolved.src===props.src?resolved.data:undefined)||undefined : props.src} />;
}
export function LocalLink(props:AnchorHTMLAttributes<HTMLAnchorElement>) {
  const href=props.href||'';
  if(href.startsWith('/api/v1/print/')||href.startsWith('/api/v1/export/')) return <button type="button" className={props.className||'local-document'} data-document={href} title={props.title}>{props.children}</button>;
  if(href.startsWith('/screen/')){const name=href.slice(8),url=new URL(location.href);url.searchParams.set('screen',name);url.hash='';return <a {...props} href={url.href} target={name==='speaker'?'_self':props.target}/>;}
  return <a {...props}/>;
}
function downloadBlob(blob:Blob, name:string) {
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);
}
function interceptLinks() {
  document.addEventListener('click',async e=>{
    const link=(e.target as Element).closest?.('a[href],button[data-document]') as HTMLElement|null;
    const href=link?.getAttribute('data-document')||link?.getAttribute('href')||'';
    if(href.startsWith('/screen/')) {
      e.preventDefault();const url=new URL(location.href);url.searchParams.set('screen',href.slice(8));url.hash='';window.open(url.href,'_blank');return;
    }
    if(!href.startsWith('/api/v1/print/') && !href.startsWith('/api/v1/export/'))return;
    e.preventDefault();
    const printable=href.startsWith('/api/v1/print/')||href.includes('format=pdf');
    const popup=printable?window.open('about:blank','_blank'):null;
    if(popup) {popup.document.title='Préparation du document';popup.document.body.textContent='Préparation du document FIBDA…';}
    try {
      const r=await request(href.slice(7));
      if(!r.ok)throw new Error((await r.json()).detail||'Document indisponible.');
      if((r.headers.get('Content-Type')||'').includes('text/html')) {
        const html=(await r.text()).replaceAll('/assets/fibda-logo.jpg',window.FIBDAStandalone.logo).replace('<header>','<p style="font-size:12px">VERSION DE TEST LOCALE — Utilisez Imprimer puis Enregistrer au format PDF.</p><header>');
        if(popup){popup.document.open();popup.document.write(html);popup.document.close();}else downloadBlob(new Blob([html],{type:'text/html'}),'FIBDA-document-test.html');
      } else {popup?.close();downloadBlob(await r.blob(),r.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'fibda-export');}
    }catch(error){if(popup)popup.document.body.textContent=(error as Error).message;else alert((error as Error).message);}
  });
}
export async function boot() {
  await openDB();
  const runtime=await window.FIBDAPythonRuntime.boot({onProgress:progress});python=runtime.python;
  python.runPython('import json\nimport bridge');
  const initial=await serialized(async()=>{
    const stored=await read(),result=JSON.parse(pyCall('init',[stored||'']));
    if(result.status>=400)throw new Error(result.data?.detail||'Données locales invalides.');
    const next=pyCall('snapshot',[]);
    if(!stored)await commit(next,stored);
    lastSnapshot=stored||next;return result;
  });
  window.FIBDAStandalone={...window.FIBDAStandalone,request,execute,accounts:initial.data.accounts};
  const originalFetch=window.fetch.bind(window);
  window.fetch=((input:any,options?:RequestInit)=>{
    const path=typeof input==='string'?input:input.url;
    if(path.startsWith('/api/v1/'))return request(path.slice(7),options);
    if(path.startsWith('blob:')||path.startsWith('data:'))return originalFetch(input,options);
    return Promise.reject(new Error('Cette version autonome ne contacte aucun serveur externe.'));
  }) as typeof fetch;
  interceptLinks();
  let ticking=false;
  setInterval(async()=>{if(ticking||!sessionStorage.getItem(sessionKey))return;ticking=true;try{await execute('POST','/tick');}catch{}finally{ticking=false;}},1000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')window.dispatchEvent(new Event('fibda-local-change'));});
}
export function TestGuide() {
  const [open,setOpen]=useState(false), [message,setMessage]=useState('');
  return <aside className="standalone-tools"><span><b>FIBDA · TEST AUTONOME</b><small>Données enregistrées dans ce navigateur</small></span><button className="ghost" onClick={()=>setOpen(!open)} aria-expanded={open}>Guide de test</button>{open && <div className="standalone-guide"><h2>Tester l’application</h2><p>Cette copie contient des personnes fictives. Les essais restent dans ce navigateur et à cette adresse. Les onglets de cette même adresse partagent les données ; les autres appareils restent indépendants. Les codes ci-dessous servent uniquement à essayer les rôles.</p><div className="standalone-codes">{(window.FIBDAStandalone.accounts||[]).map((a:any)=><div key={a.id}><strong>{a.name}</strong><code>{a.code}</code></div>)}</div><ol><li>Connectez-vous en chef avec <b>1111</b>. Vérifiez la préparation et générez le programme.</li><li>Démarrez la compétition puis ouvrez le premier tour dans Compétition.</li><li>Classez et validez. Déconnectez-vous pour essayer chacun des quatre autres juges, puis le stagiaire.</li><li>Revenez en chef pour valider le résultat, qualifier les athlètes, piloter les écrans et préparer les récompenses.</li><li>Dans Documents, imprimez et exportez une sauvegarde ZIP pour conserver ou transmettre vos essais.</li></ol><p><strong>À savoir :</strong> pas de liaison entre différents téléphones dans ce fichier. Les comptes, l’horloge et le stockage sont locaux. Gardez la page ouverte pendant un tour. Sur mobile, utilisez le lien hébergé dans Safari ou Chrome : les aperçus des messageries n’exécutent pas toujours les fichiers HTML.</p><p>Les exports PDF utilisent la fenêtre d’impression. La sauvegarde autonome ne remplace pas une sauvegarde du serveur officiel.</p><button onClick={()=>downloadBlob(new Blob([JSON.stringify({version:'FIBDA autonome 2026-09-23',browser:navigator.userAgent,date:new Date().toISOString(),observations:'Décrivez ici les étapes, le résultat attendu et le résultat observé.'},null,2)],{type:'application/json'}),'FIBDA-retour-de-test.json')}>Télécharger une fiche de retour</button><button className="ghost" onClick={async()=>{if(!confirm('Réinitialiser uniquement cette copie de test ? Exportez auparavant une sauvegarde si nécessaire.'))return;try{await serialized(async()=>{const stored=await read();if(stored)await save(stored,'before-reset');pyCall('init',['']);const next=pyCall('snapshot',[]);try{await commit(next,stored);}catch(error){if(stored){pyCall('init',[stored]);lastSnapshot=stored;}throw error;}lastSnapshot=next;});sessionStorage.removeItem(sessionKey);location.reload();}catch(e){setMessage((e as Error).message);}}}>Recommencer les essais</button>{message&&<p role="alert">{message}</p>}</div>}</aside>;
}
