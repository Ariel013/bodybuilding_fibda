(async()=>{
 const app=window.FIBDAStandalone, checks=[];
 const check=(name,ok)=>{checks.push({name,passed:!!ok});if(!ok)throw new Error(name);};
 const call=async(path,method='GET',body)=>{const r=await app.request(path,{method,...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});if(!r.ok)throw new Error(path+' '+await r.text());return r;};
 const json=async(...args)=>(await call(...args)).json();
 await json('/auth/login','POST',{code:'1111'});
 let s=await json('/state');
 check('Login quatre chiffres et 24 personnes fictives',s.people.length===24&&s.me.roles.includes('chief'));
 const cv=document.createElement('canvas');cv.width=40;cv.height=80;const cx=cv.getContext('2d');cx.fillStyle='#1e5548';cx.fillRect(0,0,40,80);cx.fillStyle='#d3bc63';cx.fillRect(10,10,20,50);
 const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
 const fd=new FormData();fd.append('file',new File([blob],'photo-test.png',{type:'image/png'}));fd.append('owner_type','person');fd.append('owner_id',s.people[0].id);fd.append('kind','portrait');fd.append('crop','[0,0,20,40]');
 const p=await json('/photos','POST',fd); await json('/photos/'+p.id+'/approve','POST',{consent:true});
 const im=await json('/photos/'+p.id);const image=new Image();image.src=im.data_url;await image.decode();check('Photo recadrée et approuvée via canvas',image.width===20&&image.height===40);
 const csv='first_name,last_name,birth_date,sex,section,country,nationalities\nEssai,Importé,1999-05-03,M,amateur,CI,CI\n';
 const imp=new FormData();imp.append('file',new File([csv],'test.csv',{type:'text/csv'}));const preview=await json('/imports/preview','POST',imp);check('Aperçu import CSV réel',preview.errors.length===0);const commit=await json('/imports/commit','POST',{preview_id:preview.preview_id});check('Import enregistré',commit.count===1);
 const xlsx=await call('/export/registrations?format=xlsx');const bytes=new Uint8Array(await xlsx.arrayBuffer());check('Export Excel binaire réel',bytes[0]===80&&bytes[1]===75&&bytes.length>2000);
 const cmd=async(type,payload)=>json('/command','POST',{id:crypto.randomUUID(),version:(await json('/state')).version,type,payload});
 await cmd('programme.generate',{});
 const doc=await (await call('/print/blank')).text();check('Bulletins vierges et séparation de catégories',doc.includes('participants à confirmer')&&doc.includes('break-before:page'));
 const stateBefore=await json('/state');const backup=await (await call('/backup','POST')).blob();check('Sauvegarde ZIP téléchargée',backup.size>1000);
 await cmd('event.update',{name:'Essai temporaire de restauration'});
 const restore=new FormData();restore.append('file',new File([backup],'test.zip',{type:'application/zip'}));await json('/restore','POST',restore);await json('/auth/login','POST',{code:'1111'});s=await json('/state');check('Restauration données et nouvelle identité',s.name===stateBefore.name&&s.restore_id!==stateBefore.restore_id&&s.people.length===25);
 check('Photo conservée après restauration',(await json('/photos/'+p.id)).data_url===im.data_url);
 const oldPut=IDBObjectStore.prototype.put, before=s.version;let failed=false;
 IDBObjectStore.prototype.put=function(value,key){if(key==='snapshot')throw new DOMException('Quota test','QuotaExceededError');return oldPut.call(this,value,key);};
 try{await cmd('event.update',{name:'Ne doit pas être confirmé'});}catch(error){failed=/Stockage local/.test(error.message);}finally{IDBObjectStore.prototype.put=oldPut;}
 s=await json('/state');check('Panne stockage : aucune fausse confirmation ni mutation',failed&&s.version===before&&s.name===stateBefore.name);
 check('Aucune requête réseau externe',performance.getEntriesByType('resource').every(r=>!/^https?:/.test(r.name)));
 return {date:new Date().toISOString(),url:location.href,checks,passed:checks.every(c=>c.passed)};
})()
