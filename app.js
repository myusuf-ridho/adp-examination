
/*PARSER_START*/
function norm(s){return s.replace(/\s+/g,'').toUpperCase()}
function joinW(a,b){
  if(!a)return b; if(!b)return a;
  if(/[\/\-_(]$/.test(a)||/^[\/.,;:)]/.test(b))return a+b;
  return a+' '+b;
}
// items: [{s,x,y,w}] dari satu halaman -> array baris teks
function groupItems(items){
  items=items.filter(i=>i.s.trim()!=='').slice().sort((a,b)=>b.y-a.y||a.x-b.x);
  const rows=[];
  for(const it of items){
    const r=rows[rows.length-1];
    if(r&&Math.abs(r.y-it.y)<=3)r.items.push(it); else rows.push({y:it.y,items:[it]});
  }
  return rows.map(r=>{
    r.items.sort((a,b)=>a.x-b.x);
    let t='',end=null;
    for(const it of r.items){
      if(end!==null&&it.x-end>1.2&&!/\s$/.test(t)&&!/^\s/.test(it.s))t+=' ';
      t+=it.s;end=it.x+it.w;
    }
    return t.replace(/\s+/g,' ').trim();
  }).filter(Boolean);
}
function parseQA(lines){
  const stem=[],opts={};let k=null;
  for(const s of lines){
    const m=s.match(/^([A-E])\.(?:\s+(.*))?$/);
    if(m){k=m[1];opts[k]=m[2]||'';continue;}
    if(k)opts[k]=joinW(opts[k],s);else stem.push(s);
  }
  return{stem:stem.reduce((a,b)=>joinW(a,b),''),opts};
}
function parseLines(lines){
  const blocks=[],tail=[],warnings=[];let cur=null,lastN=0,inTail=false;
  for(const s of lines){
    if(inTail){tail.push(s);continue;}
    if(/^ringkasan\s*kunci\s*jawaban/i.test(s)&&blocks.length){inTail=true;continue;}
    const h=s.match(/^Soal\s*(\d{1,3})\b(.*)$/i);
    if(h&&+h[1]>lastN){
      lastN=+h[1];
      const sm=h[2].match(/Section\s*(\d)\s*Â·\s*(.+)$/i);
      cur={n:lastN,sec:sm?+sm[1]:null,secName:sm?sm[2].trim():'',lines:[]};
      blocks.push(cur);continue;
    }
    if(!cur)continue;
    const sm=s.match(/^Section\s*(\d)\s*Â·\s*(.+)$/i);
    if(sm){if(!cur.sec){cur.sec=+sm[1];cur.secName=sm[2].trim();}continue;}
    if(/^halaman\s*\d+\s*\/\s*\d+/i.test(s)||norm(s).startsWith('LATIHANSOALADP'))continue;
    cur.lines.push(s);
  }
  const tailKey={};
  for(const s of tail){
    const m=s.match(/^(\d{1,3})\s+(.+?)\s+([A-E](?:\s*,\s*[A-E])*)(?:\s*\(.*\))?$/);
    if(m)tailKey[+m[1]]=m[3].match(/[A-E]/g);
  }
  const questions=[];let lastSec=1,lastSecName='';
  for(const b of blocks){
    if(!b.sec){b.sec=lastSec;b.secName=lastSecName;} else {lastSec=b.sec;lastSecName=b.secName;}
    const L=b.lines;
    const iEn=L.findIndex(s=>norm(s)==='ENGLISH');
    const iId=L.findIndex(s=>norm(s)==='BAHASAINDONESIA');
    let iAns=L.findIndex(s=>/Jawaban\s*benar\s*:/i.test(s));
    let answer=[];
    if(iAns>=0){const m=L[iAns].match(/Jawaban\s*benar\s*:\s*(.*)$/i);answer=(m&&m[1].match(/[A-E]/g))||[];}
    else iAns=L.length;
    if(!answer.length&&tailKey[b.n])answer=tailKey[b.n];
    const enLines=L.slice(iEn>=0?iEn+1:0,iId>=0?iId:iAns);
    const idLines=iId>=0?L.slice(iId+1,iAns):[];
    const en=parseQA(enLines),id=idLines.length?parseQA(idLines):null;
    const ex={correct:'',wrong:{}};let mode=null;
    for(const s of L.slice(iAns+1)){
      let m;
      if((m=s.match(/^Kenapa\s*benar\s*:\s*(.*)$/i))){mode='C';ex.correct=m[1];}
      else if((m=s.match(/^([A-E])\s+salah\s*:\s*(.*)$/i))){mode=m[1];ex.wrong[m[1]]=m[2];}
      else if(mode==='C')ex.correct=joinW(ex.correct,s);
      else if(mode)ex.wrong[mode]=joinW(ex.wrong[mode],s);
    }
    const letters=Object.keys(en.opts);
    if(letters.length<2){warnings.push(`Soal ${b.n}: pilihan jawaban tidak terbaca, dilewati.`);continue;}
    if(!answer.length){warnings.push(`Soal ${b.n}: kunci jawaban tidak ditemukan, dilewati.`);continue;}
    answer=[...new Set(answer)].sort();
    questions.push({n:b.n,sec:b.sec,secName:b.secName,en,id:id&&Object.keys(id.opts).length>=2?id:null,answer,ex});
  }
  return{questions,warnings};
}
/*PARSER_END*/

/* ====== UI ====== */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='adp_quiz_session_v1';
let Q=[],S=null,pending=null,screen='start',dlgCb=null;

function fmtTime(t){const h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=t%60;return(h?h+':':'')+String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
function save(){try{localStorage.setItem(KEY,JSON.stringify({Q,S}))}catch(e){}}
function loadSaved(){try{const j=JSON.parse(localStorage.getItem(KEY)||'null');return j&&j.Q&&j.S?j:null}catch(e){return null}}
function clearSaved(){try{localStorage.removeItem(KEY)}catch(e){}}

/* theme */
function setTheme(t){document.documentElement.dataset.theme=t;$('#themeBtn').textContent=t==='dark'?'â˜€ï¸':'ðŸŒ™';try{localStorage.setItem('adp_theme',t)}catch(e){}}
(function(){let t=null;try{t=localStorage.getItem('adp_theme')}catch(e){}
 if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';setTheme(t)})();
$('#themeBtn').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');

/* screens */
function show(name){
  screen=name;
  $('#sStart').hidden=name!=='start';$('#sQuiz').hidden=name!=='quiz';$('#sResult').hidden=name!=='result';
  $('#quizBar').hidden=name!=='quiz';$('#menuBtn').hidden=name!=='quiz';
  window.scrollTo(0,0);
}

/* ---------- PDF ---------- */
function setMsg(t,cls){const m=$('#parseMsg');m.hidden=!t;m.className='msg '+(cls||'');m.innerHTML=t||''}
async function extractLines(file){
  if(typeof pdfjsLib==='undefined')throw new Error('Library pdf.js gagal dimuat. Pastikan kamu online (CDN cdnjs.cloudflare.com), lalu muat ulang halaman.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
  const lines=[];
  for(let p=1;p<=pdf.numPages;p++){
    setMsg(`â³ Membaca halaman ${p}/${pdf.numPages}â€¦`);
    const tc=await(await pdf.getPage(p)).getTextContent();
    const items=tc.items.filter(i=>typeof i.str==='string').map(i=>({s:i.str,x:i.transform[4],y:i.transform[5],w:i.width||0}));
    lines.push(...groupItems(items));
  }
  return lines;
}
async function handleFile(f){
  if(!f)return;
  if(!/pdf$/i.test(f.name)&&f.type!=='application/pdf'){setMsg('File harus berformat PDF.','err');return}
  $('#cfg').hidden=true;setMsg('â³ Membaca PDFâ€¦');
  try{
    const lines=await extractLines(f);
    const r=parseLines(lines);
    if(!r.questions.length){
      setMsg(`Tidak ada soal yang terbaca. Format PDF harus memuat blok "Soal N", pilihan "A. â€¦", dan baris "Jawaban benar: X".<details><summary>Lihat teks hasil ekstraksi</summary><textarea readonly>${esc(lines.join('\n'))}</textarea></details>`,'err');
      return;
    }
    pending={Q:r.questions,name:f.name};
    setMsg(r.warnings.length?`âš ï¸ ${r.warnings.length} peringatan:<br>${r.warnings.map(esc).join('<br>')}<details><summary>Lihat teks hasil ekstraksi</summary><textarea readonly>${esc(lines.join('\n'))}</textarea></details>`:'','warn');
    renderCfg();
  }catch(e){setMsg('Gagal membaca PDF: '+esc(e.message||e),'err')}
}
const fileIn=$('#file'),drop=$('#drop');
fileIn.onchange=()=>handleFile(fileIn.files[0]);
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileIn.click()}});

function renderCfg(){
  const qs=pending.Q,secs={};
  qs.forEach(q=>{(secs[q.sec]=secs[q.sec]||{name:q.secName||('Section '+q.sec),c:0}).c++});
  const hasId=qs.some(q=>q.id),multi=qs.filter(q=>q.answer.length>1).length;
  $('#cfg').hidden=false;
  $('#cfg').innerHTML=`
   <h3 style="margin-top:0">âœ… ${qs.length} soal terbaca <small style="color:var(--muted);font-weight:400">Â· ${esc(pending.name)}</small></h3>
   <div class="chips">${Object.entries(secs).map(([k,v])=>`<span class="chip"><i class="dot s${k}" style="display:inline-block;margin-right:6px"></i>${esc(v.name)}: ${v.c}</span>`).join('')}${multi?`<span class="chip">Pilih dua: ${multi}</span>`:''}</div>
   <b>Mode</b>
   <div class="opts-row">
     <label class="choice"><input type="radio" name="mode" value="exam" checked><div><b>Ujian</b><small>Jawaban &amp; pembahasan baru muncul setelah â€œKumpulkanâ€. Paling mirip ujian asli.</small></div></label>
     <label class="choice"><input type="radio" name="mode" value="practice"><div><b>Latihan</b><small>Langsung tahu benar/salah + pembahasan setiap selesai menjawab, skor berjalan.</small></div></label>
   </div>
   ${hasId?`<b>Bahasa soal</b>
   <div class="opts-row" style="grid-template-columns:repeat(auto-fit,minmax(120px,1fr))">
     <label class="choice"><input type="radio" name="lang" value="en" checked><div>English</div></label>
     <label class="choice"><input type="radio" name="lang" value="id"><div>Indonesia</div></label>
     <label class="choice"><input type="radio" name="lang" value="both"><div>Keduanya</div></label>
   </div>`:''}
   <label class="row" style="margin:6px 0 16px"><input type="checkbox" id="autoNext"> Otomatis lanjut ke soal berikutnya setelah menjawab</label>
   <button class="btn primary" id="startBtn" style="width:100%;padding:12px">Mulai kuis â†’</button>`;
  $('#startBtn').onclick=()=>{
    const g=n=>(document.querySelector(`input[name=${n}]:checked`)||{}).value;
    Q=pending.Q;
    S={mode:g('mode')||'exam',lang:g('lang')||'en',autoNext:$('#autoNext').checked,ans:{},flag:{},checked:{},cur:0,filter:'all',submitted:false,elapsed:0,name:pending.name};
    save();openQuiz();
  };
}
function renderResume(){
  const j=loadSaved(),el=$('#resume');
  if(!j){el.hidden=true;return}
  const ans=j.Q.filter(q=>(j.S.ans[q.n]||[]).length===q.answer.length).length;
  el.hidden=false;
  el.innerHTML=`<b>Sesi tersimpan</b><div style="color:var(--muted);margin:4px 0 12px">${esc(j.S.name||'PDF')} Â· ${j.Q.length} soal Â· ${ans} dijawab Â· mode ${j.S.mode==='exam'?'Ujian':'Latihan'}${j.S.submitted?' Â· sudah dikumpulkan':''}</div>
   <div class="row"><button class="btn primary" id="resBtn">Lanjutkan</button><button class="btn ghost" id="delBtn">Hapus sesi</button></div>`;
  $('#resBtn').onclick=()=>{Q=j.Q;S=j.S;S.filter='all';j.S.submitted?openResult():openQuiz()};
  $('#delBtn').onclick=()=>{clearSaved();renderResume()};
}

/* ---------- logic ---------- */
const need=q=>q.answer.length;
const sel=q=>S.ans[q.n]||[];
const answered=q=>sel(q).length===need(q);
const isCorrect=q=>{const a=sel(q);return a.length===q.answer.length&&a.every((x,i)=>x===q.answer[i])};
const isLocked=q=>S.submitted||(S.mode==='practice'&&!!S.checked[q.n]);
function score(){const ok=Q.filter(isCorrect).length,un=Q.filter(q=>!answered(q)).length;return{ok,un,wrong:Q.length-ok-un,pct:Math.round(ok/Q.length*1000)/10}}
function passFilter(q){
  switch(S.filter){case'un':return!answered(q);case'flag':return!!S.flag[q.n];case'wrong':return isLocked(q)&&!isCorrect(q);default:return true}
}
function visibleIdx(){return Q.map((_,i)=>i).filter(i=>passFilter(Q[i]))}

function openQuiz(){show('quiz');try{$('#sQuiz').classList.toggle('collapsed',localStorage.getItem('adp_side_collapsed')==='1')}catch(e){}renderAll();$('#side').classList.remove('open');$('#scrim').classList.remove('show')}
function go(i){S.cur=Math.max(0,Math.min(Q.length-1,i));save();renderAll();window.scrollTo(0,0);closeSide()}
function step(d){
  const v=visibleIdx();
  if(!v.length){go(S.cur+d);return}
  const c=d>0?v.find(i=>i>S.cur):[...v].reverse().find(i=>i<S.cur);
  if(c!==undefined)go(c);
}
function choose(k){
  const q=Q[S.cur];if(isLocked(q)||!(k in q.en.opts))return;
  let a=sel(q).slice();
  if(need(q)===1){a=(S.mode==='exam'&&a[0]===k)?[]:[k]}
  else{const i=a.indexOf(k);if(i>=0)a.splice(i,1);else{a.push(k);if(a.length>need(q))a.shift()}}
  a.sort();S.ans[q.n]=a;
  if(S.mode==='practice'&&a.length===need(q))S.checked[q.n]=true;
  save();renderAll();
  if(S.autoNext&&S.mode==='exam'&&a.length===need(q)&&S.cur<Q.length-1)setTimeout(()=>{if(S.cur===Q.indexOf(q))go(S.cur+1)},260);
}
function toggleFlag(){const q=Q[S.cur];S.flag[q.n]=!S.flag[q.n];if(!S.flag[q.n])delete S.flag[q.n];save();renderAll()}

/* ---------- render quiz ---------- */
function renderAll(){renderTop();renderSide();renderQuestion()}
function renderTop(){
  const tot=Q.length,done=Q.filter(answered).length;
  $('#prog').style.width=(done/tot*100)+'%';
  $('#progTxt').textContent=`${done}/${tot} dijawab`;
  $('#timer').textContent=fmtTime(S.elapsed);
  const ls=$('#liveScore');
  if(S.submitted){ls.hidden=false;ls.textContent='Skor '+score().pct+'%'}
  else if(S.mode==='practice'){
    const ck=Q.filter(q=>S.checked[q.n]),ok=ck.filter(isCorrect).length;
    ls.hidden=false;ls.textContent=`Skor ${ok}/${ck.length}`+(ck.length?` (${Math.round(ok/ck.length*100)}%)`:'');
  }else ls.hidden=true;
  const hasId=Q.some(q=>q.id);
  $('#langSeg').hidden=!hasId;
  $('#langSeg').innerHTML=[['en','EN'],['id','ID'],['both','EN+ID']].map(([v,l])=>`<button data-l="${v}" class="${S.lang===v?'on':''}">${l}</button>`).join('');
  $('#submitBtn').textContent=S.submitted?'Lihat hasil':'Kumpulkan';
}
function navClass(q,i){
  let c='nb';
  if(isLocked(q)){c+=answered(q)?(isCorrect(q)?' ok':' bad'):(S.submitted?' bad':'')}
  else if(answered(q))c+=' ans';
  if(i===S.cur)c+=' cur';
  if(S.flag[q.n])c+=' fl';
  return c;
}
function renderSide(){
  const done=Q.filter(answered).length,flags=Q.filter(q=>S.flag[q.n]).length;
  const wrongN=Q.filter(q=>isLocked(q)&&!isCorrect(q)).length;
  const fl=[['all','Semua'],['un',`Belum (${Q.length-done})`],['flag',`Ditandai (${flags})`]];
  if(S.submitted||S.mode==='practice')fl.push(['wrong',`Salah (${wrongN})`]);
  const groups={};
  Q.forEach((q,i)=>{(groups[q.sec]=groups[q.sec]||{name:q.secName||'Section '+q.sec,items:[]}).items.push(i)});
  let html=`<h3>Navigasi Soal</h3>
   <div class="stats"><span>âœ… Dijawab ${done}</span><span>â¬œ Belum ${Q.length-done}</span><span>ðŸš© ${flags}</span></div>
   <div class="filters">${fl.map(([v,l])=>`<button data-f="${v}" class="${S.filter===v?'on':''}">${l}</button>`).join('')}</div>`;
  for(const [sec,g] of Object.entries(groups)){
    const vis=g.items.filter(i=>passFilter(Q[i]));
    if(!vis.length)continue;
    const d=g.items.filter(i=>answered(Q[i])).length;
    html+=`<div class="gh"><i class="dot s${sec}"></i>${esc(g.name)}<small>${d}/${g.items.length}</small></div><div class="grid">${vis.map(i=>`<button class="${navClass(Q[i],i)}" data-i="${i}">${Q[i].n}</button>`).join('')}</div>`;
  }
  if(!Object.keys(groups).some(s=>groups[s].items.some(i=>passFilter(Q[i]))))html+=`<p style="color:var(--muted)">Tidak ada soal untuk filter ini ðŸŽ‰</p>`;
  html+=`<div class="legend"><span><i style="background:var(--primary-bg);border-color:var(--primary)"></i>dijawab</span><span><i></i>belum</span><span><i style="background:var(--warn)"></i>ditandai</span>${(S.submitted||S.mode==='practice')?`<span><i style="background:var(--ok-bg);border-color:var(--ok)"></i>benar</span><span><i style="background:var(--bad-bg);border-color:var(--bad)"></i>salah</span>`:''}</div>`;
  const keep=$('#side').scrollTop;$('#side').innerHTML=html;$('#side').scrollTop=keep;
}
const CODE_RE=/^(bq |gcloud |SELECT |CREATE |measure:|dimension:|LAG\(|LEAD\(|FIRST_VALUE|SUM\(|ML\.|CAST|SAFE_CAST|PARSE_DATE|MODEL_|roles\/|\(\d\))/;
function optText(t){return`<span class="${CODE_RE.test(t)?'mono':''}">${esc(t)}</span>`}
function renderQuestion(){
  const q=Q[S.cur],a=sel(q),fb=isLocked(q),lang=(S.lang!=='en'&&!q.id)?'en':S.lang;
  const multi=need(q)>1;
  let h=`<div class="qhead"><b>Soal ${q.n}</b><span>dari ${Q.length}</span><span class="dot s${q.sec}"></span><span>${esc(q.secName)}</span>${multi?`<span class="tag">Pilih ${need(q)}</span>`:''}${S.flag[q.n]?'<span class="tag">ðŸš© Ditandai</span>':''}</div>`;
  if(lang==='id')h+=`<div class="stem">${esc(q.id.stem)}</div>`;
  else{h+=`<div class="stem">${esc(q.en.stem)}</div>`;if(lang==='both')h+=`<div class="stem2">${esc(q.id.stem)}</div>`}
  h+=Object.keys(q.en.opts).sort().map(k=>{
    let c='opt';
    if(fb){if(q.answer.includes(k))c+=a.includes(k)?' right':' right missed';else if(a.includes(k))c+=' wrong'}
    else if(a.includes(k))c+=' sel';
    const main=lang==='id'?(q.id.opts[k]||q.en.opts[k]):q.en.opts[k];
    const sub=lang==='both'&&q.id&&q.id.opts[k]?`<span class="t2">${optText(q.id.opts[k])}</span>`:'';
    return`<button class="${c}" data-k="${k}" ${fb?'disabled':''}><span class="k">${k}</span><span>${optText(main)}${sub}</span></button>`;
  }).join('');
  if(fb){
    const ok=isCorrect(q),ans=q.answer.join(', ');
    h+=`<div class="banner ${ok?'ok':'bad'}">${ok?'âœ” Benar':(answered(q)?'âœ˜ Salah':'âš  Belum dijawab')} â€” jawaban benar: ${ans}</div>`;
    if(q.ex.correct)h+=`<div class="why ok"><b>Kenapa benar:</b> ${esc(q.ex.correct)}</div>`;
    for(const k of Object.keys(q.ex.wrong).sort())h+=`<div class="why bad ${a.includes(k)?'picked':''}"><b>${k} salah:</b> ${esc(q.ex.wrong[k])}</div>`;
  }else if(S.mode==='practice'&&multi&&a.length<need(q)){
    h+=`<div style="color:var(--muted);font-size:13.5px">Pilih ${need(q)} jawaban (terpilih ${a.length}).</div>`;
  }
  h+=`<div class="nav"><button class="btn" id="prevBtn" ${S.cur===0?'disabled':''}>â† Sebelumnya</button>
   <button class="btn ghost" id="flagBtn">${S.flag[q.n]?'ðŸš© Lepas tanda':'ðŸ³ï¸ Tandai'}</button><span class="sp"></span>
   ${S.cur===Q.length-1?`<button class="btn primary" id="lastBtn">${S.submitted?'Lihat hasil':'Kumpulkan'}</button>`:`<button class="btn primary" id="nextBtn">Berikutnya â†’</button>`}</div>
   <p style="color:var(--muted);font-size:12.5px;margin-top:18px">Pintasan: Aâ€“E pilih jawaban Â· â† â†’ pindah soal Â· F tandai</p>`;
  $('#main').innerHTML=h;
}

/* events */
$('#main').addEventListener('click',e=>{
  const o=e.target.closest('.opt');if(o){choose(o.dataset.k);return}
  const id=e.target.closest('button')?.id;
  if(id==='prevBtn')step(-1);else if(id==='nextBtn')step(1);else if(id==='flagBtn')toggleFlag();else if(id==='lastBtn')trySubmit();
});
$('#side').addEventListener('click',e=>{
  const b=e.target.closest('.nb');if(b){go(+b.dataset.i);return}
  const f=e.target.closest('[data-f]');if(f){S.filter=f.dataset.f;save();renderSide()}
});
$('#langSeg').addEventListener('click',e=>{const b=e.target.closest('[data-l]');if(b){S.lang=b.dataset.l;save();renderAll()}});
$('#submitBtn').onclick=trySubmit;
function closeSide(){$('#side').classList.remove('open');$('#scrim').classList.remove('show')}
$('#menuBtn').onclick=()=>{
  if(matchMedia('(max-width:900px)').matches){const o=$('#side').classList.toggle('open');$('#scrim').classList.toggle('show',o)}
  else{const c=$('#sQuiz').classList.toggle('collapsed');try{localStorage.setItem('adp_side_collapsed',c?'1':'0')}catch(e){}}
};
$('#scrim').onclick=closeSide;
document.addEventListener('keydown',e=>{
  if(screen!=='quiz'||$('#dlg').open||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  const k=e.key.toLowerCase();
  if(/^[a-e]$/.test(k))choose(k.toUpperCase());
  else if(e.key==='ArrowRight')step(1);else if(e.key==='ArrowLeft')step(-1);else if(k==='f')toggleFlag();
});
setInterval(()=>{
  if(screen==='quiz'&&S&&!S.submitted&&!document.hidden){S.elapsed++;$('#timer').textContent=fmtTime(S.elapsed);if(S.elapsed%15===0)save()}
},1000);

/* dialog */
function confirmDlg(html,okTxt,cb){$('#dlgBody').innerHTML=html;$('#dlgOk').textContent=okTxt;dlgCb=cb;$('#dlg').showModal()}
$('#dlgCancel').onclick=()=>$('#dlg').close();
$('#dlgOk').onclick=()=>{$('#dlg').close();dlgCb&&dlgCb()};

/* submit & result */
function trySubmit(){
  if(S.submitted){openResult();return}
  const un=Q.filter(q=>!answered(q));
  confirmDlg(un.length
    ?`<h3 style="margin-top:0">Kumpulkan sekarang?</h3><p>Masih ada <b>${un.length}</b> soal belum dijawab:<br><span style="color:var(--muted)">${un.slice(0,40).map(q=>q.n).join(', ')}${un.length>40?'â€¦':''}</span></p><p>Soal kosong dihitung salah.</p>`
    :`<h3 style="margin-top:0">Kumpulkan jawaban?</h3><p>Semua ${Q.length} soal sudah dijawab. Setelah dikumpulkan jawaban tidak bisa diubah.</p>`,
    'Kumpulkan',()=>{S.submitted=true;S.filter='all';save();openResult()});
}
function secStats(){
  const m={};
  Q.forEach(q=>{const s=m[q.sec]=m[q.sec]||{name:q.secName||'Section '+q.sec,t:0,ok:0};s.t++;if(isCorrect(q))s.ok++});
  return Object.entries(m).map(([k,v])=>({sec:k,...v,pct:v.ok/v.t*100}));
}
function openResult(){
  show('result');
  const sc=score(),secs=secStats();
  const C=2*Math.PI*54,col=sc.pct>=85?'var(--ok)':sc.pct>=70?'var(--warn)':'var(--bad)';
  const weak=[...secs].sort((a,b)=>a.pct-b.pct)[0];
  const verdict=sc.pct>=85?'Sudah di atas target 85%. Pertahankan, lalu coba soal yang belum pernah kamu lihat.':sc.pct>=70?'Hampir sampai. Fokus ulang pada domain terlemah di bawah.':'Materi masih perlu diperkuat. Baca pembahasan soal yang salah, lalu ulangi.';
  $('#sResult').innerHTML=`
   <div class="card" style="text-align:center">
    <h2 style="margin:0 0 14px">Hasil Latihan</h2>
    <div class="ring"><svg width="170" height="170" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="var(--line)" stroke-width="10"/><circle cx="60" cy="60" r="54" fill="none" stroke="${col}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-sc.pct/100)}"/></svg>
     <div class="num"><div>${sc.pct}%<small>${sc.ok} / ${Q.length} benar</small></div></div></div>
    <p style="margin:14px 0 0;color:var(--muted)">${verdict}</p>
    <div class="kpis"><div class="kpi"><b style="color:var(--ok)">${sc.ok}</b><span>Benar</span></div><div class="kpi"><b style="color:var(--bad)">${sc.wrong}</b><span>Salah</span></div><div class="kpi"><b>${sc.un}</b><span>Kosong</span></div><div class="kpi"><b>${fmtTime(S.elapsed)}</b><span>Waktu</span></div></div>
   </div>
   <div class="card"><h3 style="margin-top:0">Skor per domain</h3>
    ${secs.map(s=>`<div class="dom"><div class="l"><span><i class="dot s${s.sec}" style="display:inline-block;margin-right:6px"></i>${esc(s.name)}</span><b>${s.ok}/${s.t} Â· ${Math.round(s.pct)}%</b></div><div class="bar"><i style="width:${s.pct}%;background:var(--s${s.sec})"></i></div></div>`).join('')}
    ${secs.length>1&&weak.pct<100?`<p style="color:var(--muted);margin-bottom:0">Domain terlemah: <b>${esc(weak.name)}</b></p>`:''}
   </div>
   <div class="row" style="justify-content:center">
    <button class="btn primary" id="rvAll">Tinjau semua jawaban</button>
    <button class="btn" id="rvWrong" ${sc.ok===Q.length?'disabled':''}>Tinjau yang salah</button>
    <button class="btn" id="retry">Ulangi dari awal</button>
    <button class="btn ghost" id="newPdf">Upload PDF lain</button>
   </div>`;
  $('#rvAll').onclick=()=>{S.filter='all';S.cur=0;save();openQuiz()};
  $('#rvWrong').onclick=()=>{S.filter='wrong';const i=Q.findIndex(q=>!isCorrect(q));S.cur=Math.max(0,i);save();openQuiz()};
  $('#retry').onclick=()=>confirmDlg('<h3 style="margin-top:0">Ulangi dari awal?</h3><p>Semua jawaban dan waktu akan direset.</p>','Ulangi',()=>{
    Object.assign(S,{ans:{},flag:{},checked:{},submitted:false,elapsed:0,cur:0,filter:'all'});save();openQuiz()});
  $('#newPdf').onclick=()=>{pending=null;$('#cfg').hidden=true;setMsg('');fileIn.value='';renderResume();show('start')};
}

/* ---------- Daftar PDF otomatis (tanpa upload) ---------- */
const LIB={items:[],mode:null,saved:null};
const natSort=(a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true,sensitivity:'base'});
function idb(){return new Promise((res,rej)=>{const r=indexedDB.open('adp_quiz_fs',1);r.onupgradeneeded=()=>r.result.createObjectStore('h');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(k){try{const d=await idb();return await new Promise((res,rej)=>{const q=d.transaction('h').objectStore('h').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}catch(e){return null}}
async function idbSet(k,v){try{const d=await idb();await new Promise((res,rej)=>{const t=d.transaction('h','readwrite');t.objectStore('h').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error)})}catch(e){}}

// Mode A: halaman dibuka lewat web server (http/https). Baca soal.json atau directory listing.
async function listFromHttp(){
  if(!/^(https?|file):$/.test(location.protocol))return[];
  const names=new Set();
  try{
    const r=await fetch('soal.json',{cache:'no-store'});
    if(r.ok){const j=await r.json();(Array.isArray(j)?j:(j.files||[])).forEach(n=>{if(typeof n==='string')names.add(n)})}
  }catch(e){}
  try{
    const r=await fetch('./',{cache:'no-store'});
    if(r.ok&&(location.protocol==='file:'||/html/i.test(r.headers.get('content-type')||''))){
      const txt=await r.text();
      const un=t=>t.replace(/\\x([0-9a-f]{2})/gi,(_,h)=>String.fromCharCode(parseInt(h,16))).replace(/\\(.)/g,'$1');
      for(const m of txt.matchAll(/addRow\("((?:[^"\\]|\\.)*)","(?:[^"\\]|\\.)*",(\d)/g))if(m[2]==='0')names.add(un(m[1]));
      const doc=new DOMParser().parseFromString(txt,'text/html');
      doc.querySelectorAll('a[href]').forEach(a=>{
        const h=a.getAttribute('href').split(/[?#]/)[0];
        if(/\.pdf$/i.test(h)&&!/^([a-z]+:|\/|\.\.)/i.test(h)){try{names.add(decodeURIComponent(h))}catch(e){}}
      });
    }
  }catch(e){}
  return[...names].filter(n=>/\.pdf$/i.test(n)&&!n.includes('/')).map(name=>({name,get:async()=>{
    const r=await fetch('./'+encodeURIComponent(name));
    if(!r.ok)throw new Error('HTTP '+r.status);
    return new File([await r.blob()],name,{type:'application/pdf'});
  }})).sort(natSort);
}

// Mode B: dibuka langsung (file://). Pilih folder sekali, handle disimpan di IndexedDB.
async function listFromDir(dir){
  const out=[];
  for await(const [name,h] of dir.entries()){if(h.kind==='file'&&/\.pdf$/i.test(name))out.push({name,get:()=>h.getFile()})}
  return out.sort(natSort);
}
async function useDir(h){LIB.items=await listFromDir(h);LIB.mode='folder';LIB.saved=h}
async function pickDir(){
  if(!window.showDirectoryPicker){$('#dirIn').click();return}
  try{const h=await showDirectoryPicker({id:'adp-quiz',mode:'read'});await idbSet('dir',h);await useDir(h)}
  catch(e){if(e.name!=='AbortError')setMsg('Gagal membuka folder: '+esc(e.message||e),'err')}
  renderLib();
}
async function grantDir(){
  try{
    if(await LIB.saved.requestPermission({mode:'read'})==='granted')await useDir(LIB.saved);
    else setMsg('Akses folder tidak diizinkan.','err');
  }catch(e){setMsg('Gagal mengakses folder: '+esc(e.message||e),'err')}
  renderLib();
}
async function initLib(){
  LIB.items=[];LIB.mode=null;
  if(Array.isArray(window.SOAL_DATA)&&window.SOAL_DATA.length){
    LIB.items=window.SOAL_DATA.map(d=>({name:d.name,get:async()=>{const b=atob(d.b64),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new File([u],d.name,{type:'application/pdf'})}})).sort(natSort);
    LIB.mode='data';renderLib();return;
  }
  LIB.items=await listFromHttp();
  if(LIB.items.length)LIB.mode='http';
  else if(window.showDirectoryPicker){
    LIB.saved=LIB.saved||await idbGet('dir');
    try{if(LIB.saved&&await LIB.saved.queryPermission({mode:'read'})==='granted')await useDir(LIB.saved)}catch(e){}
  }
  renderLib();
}
function renderLib(){
  const el=$('#lib'),canDir=!!window.showDirectoryPicker;
  let h;
  if(LIB.mode){
    const n=LIB.items.length;
    h=`<div class="row" style="justify-content:space-between"><b>ðŸ“š Soal di folder ini <small class="muted" style="font-weight:400">Â· ${n} PDF</small></b>
      <span class="row" style="gap:4px"><button class="btn ghost" data-act="rescan">â†» Muat ulang</button>${LIB.mode==='folder'?'<button class="btn ghost" data-act="pick">Ganti folder</button>':''}</span></div>
      ${n?`<div class="lib">${LIB.items.map((it,i)=>`<button class="libit" data-pdf="${i}"><span>ðŸ“„</span><span class="nm">${esc(it.name)}</span><span class="go">Buka â†’</span></button>`).join('')}</div>`:'<p class="muted" style="margin:10px 0 0">Tidak ada file PDF di folder ini.</p>'}`;
  }else if(LIB.saved){
    h=`<b>ðŸ“‚ Folder soal: ${esc(LIB.saved.name)}</b><p class="muted" style="margin:6px 0 12px">Browser butuh izin sekali lagi untuk membaca folder ini.</p>
      <div class="row"><button class="btn primary" data-act="grant">Izinkan &amp; tampilkan daftar</button><button class="btn ghost" data-act="pick">Pilih folder lain</button></div>`;
  }else if(canDir||location.protocol==='file:'){
    h=`<b>ðŸ“‚ Ambil soal dari folder</b><p class="muted" style="margin:6px 0 12px">Pilih folder tempat file PDF-mu berada, lalu semua PDF muncul sebagai daftar tanpa upload satu per satu. ${canDir?'Cukup sekali, folder diingat browser.':'Browser ini akan bertanya soal â€œuploadâ€, tapi tidak ada file yang dikirim ke mana pun. Folder perlu dipilih lagi setiap halaman dibuka.'}</p>
      <button class="btn primary" data-act="pick">Pilih folder</button>
      <details style="margin-top:14px"><summary>Mau langsung otomatis tanpa klik?</summary>
      <p style="margin:8px 0 0">Klik kanan shortcut Chrome â†’ <b>Properties</b> â†’ di kolom <b>Target</b>, tambahkan di paling akhir (pakai spasi): <code>--allow-file-access-from-files</code>. Tutup semua jendela Chrome, buka lewat shortcut itu, lalu buka file ini: daftar PDF muncul sendiri. Pakai shortcut ini khusus untuk latihan, bukan untuk browsing umum.</p></details>
      <details style="margin-top:10px"><summary>Admin: kemas PDF agar terdaftar otomatis untuk semua pengguna</summary>
      <p style="margin:8px 0">Pilih semua PDF soal satu kali, unduh <code>soal-data.js</code>, taruh sefolder dengan file ini. Setelah itu siapa pun yang membuka halaman ini langsung melihat daftar soal, tanpa upload dan tanpa pilih folder.</p>
      <input type="file" id="packIn" accept="application/pdf,.pdf" multiple></details>`;
  }else{
    h=`<b>ðŸ“‚ Daftar PDF otomatis</b><p class="muted" style="margin:6px 0 0">Tidak ada file PDF yang terdeteksi di folder ini.</p>`;
  }
  el.hidden=false;el.innerHTML=h;
}
$('#lib').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pdf!==undefined){
    const it=LIB.items[+b.dataset.pdf];pending=null;
    try{setMsg('â³ Membuka '+esc(it.name)+'â€¦');await handleFile(await it.get());if(pending)$('#cfg').scrollIntoView({behavior:'smooth',block:'nearest'})}
    catch(err){setMsg('Gagal membuka file: '+esc(err.message||err),'err')}
  }else if(b.dataset.act==='pick')pickDir();
  else if(b.dataset.act==='grant')grantDir();
  else if(b.dataset.act==='rescan')initLib();
});

$('#lib').addEventListener('change',async e=>{
  if(e.target.id!=='packIn')return;
  const fs=[...e.target.files];if(!fs.length)return;
  try{
    setMsg('â³ Mengemas '+fs.length+' PDFâ€¦');
    const data=[];
    for(const f of fs){
      const u=new Uint8Array(await f.arrayBuffer());let b='';
      for(let i=0;i<u.length;i+=32768)b+=String.fromCharCode.apply(null,u.subarray(i,i+32768));
      data.push({name:f.name,b64:btoa(b)});
    }
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob(['window.SOAL_DATA='+JSON.stringify(data)+';'],{type:'text/javascript'}));
    a.download='soal-data.js';a.click();
    setMsg('âœ… <b>soal-data.js</b> terunduh. Taruh sefolder dengan file ini, lalu muat ulang halaman.');
  }catch(err){setMsg('Gagal mengemas: '+esc(err.message||err),'err')}
});
$('#dirIn').addEventListener('change',e=>{
  const fs=[...e.target.files].filter(f=>/\.pdf$/i.test(f.name)&&(f.webkitRelativePath||'').split('/').length===2);
  LIB.items=fs.map(f=>({name:f.name,get:async()=>f})).sort(natSort);
  LIB.mode='folder';LIB.saved=null;e.target.value='';renderLib();
});

/* init */
renderResume();show('start');initLib();
