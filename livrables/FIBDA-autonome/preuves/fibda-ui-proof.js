(async()=>{
 const checks=[];const check=(name,v)=>{checks.push({name,passed:!!v});if(!v)throw Error(name)};
 const pause=()=>new Promise(r=>setTimeout(r,70));
 const button=t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t);
 const bib=n=>[...document.querySelectorAll('.bib')].find(b=>b.querySelector('strong').textContent===String(n));
 const slot=n=>document.querySelector(`[data-rank="${n-1}"] .rank-slot`);
 const rank=n=>slot(n).querySelector('strong')?.textContent;
 const place=async(n,r)=>{bib(n).click();await pause();slot(r).click();await pause()};
 check('Bulletin ouvert sur largeur 390',innerWidth===390 && document.querySelectorAll('.bib').length===8);
 await place(1,1);await place(2,2);await place(2,1);
 check('Remplacement libère ancien occupant et ancienne place',rank(1)==='N° 2'&&!rank(2)&&!bib(1).classList.contains('placed'));
 button('Annuler').click();await pause();check('Annuler restaure toute opération',rank(1)==='N° 1'&&rank(2)==='N° 2');
 button('Rétablir').click();await pause();check('Rétablir reproduit remplacement',rank(1)==='N° 2'&&!rank(2));
 button('Annuler').click();await pause();for(let i=3;i<=8;i++)await place(i,i);
 check('Huit rangs complets permettent validation',!button('Vérifier et valider').disabled);
 button('Vérifier et valider').click();await pause();check('Résumé avant envoi',!!document.querySelector('[role=dialog]'));
 button('Confirmer et transmettre').click();
 for(let i=0;i<100&&!document.body.innerText.includes('Bulletin enregistré et verrouillé sur cet appareil.');i++)await pause();
 check('Confirmation locale après enregistrement',document.body.innerText.includes('Bulletin enregistré et verrouillé sur cet appareil.'));
 check('Bulletin verrouillé', [...document.querySelectorAll('.bib')].every(b=>b.disabled));
 check('Aucun débordement horizontal téléphone',document.documentElement.scrollWidth<=innerWidth);
 return JSON.stringify({date:new Date().toISOString(),checks,passed:true},null,2)
})()
