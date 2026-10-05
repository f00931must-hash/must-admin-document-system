import { getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, query, where, getDocs, getDoc, doc, runTransaction, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const app=getApps()[0],auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const TYPE='STUDENT_HANDOVER',fixed=['需求調查表','任課老師簽收單','課輔申請單','協助同學申請單'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let owner='',students=[],saved=[],loading=false;
function academicYear(date){const m=String(date||'').trim().match(/^(?:民國\s*)?(\d{2,4})\s*[年\/.-]\s*(\d{1,2})/);if(!m)return 0;const y=Number(m[1])-(Number(m[1])>1911?1911:0);return y-(Number(m[2])<8?1:0);}
function grade(s,year){return s.admissionYear?year-s.admissionYear+1:0;}
function term(){const y=$('handoverYear').value.trim();if(!/^\d{3}$/.test(y))throw Error('請輸入三位數民國學年度，例如 115。');return y+'-'+$('handoverTerm').value;}
function record(s){return saved.find(r=>r.studentKey===s.key&&r.term===term());}
function items(s){return record(s)?.items||fixed.map((name,i)=>({id:'fixed-'+i,name,givenDate:'',requiresReturn:true,returned:false}));}
async function access(){
 const user=auth.currentUser;if(!user?.email)throw Error('請先登入。');
 const email=user.email.toLowerCase(),a=await getDoc(doc(db,'administrativeAssistants',email));
 if(a.exists()&&a.data().enabled===true)return a.data().ownerEmail;
 const config=await getDoc(doc(db,'settings','adminAccess')),profile=config.data()?.users?.[email];
 if(!profile?.enabled)throw Error('此帳號尚未開通權限。');
 return profile.role==='assistant'?profile.ownerEmail:email;
}
async function load(){
 if(loading)return;loading=true;$('handoverStatus').textContent='載入中…';
 try{
 owner=await access();const snap=await getDocs(query(collection(db,'adminDocuments'),where('ownerEmail','==',owner)));
 if(auth.currentUser?.email?.toLowerCase()!==sessionEmail) return;
 const docs=snap.docs.map(d=>({id:d.id,...d.data()}));saved=docs.filter(d=>d.type===TYPE);
 const roster=new Map();
 for(const d of docs.filter(d=>!d.type||d.type==='ISP'||d.type==='SEMESTER_ISP').sort((a,b)=>(a.type==='SEMESTER_ISP')-(b.type==='SEMESTER_ISP'))){
 const f=d.form||{},name=String(d.studentName||f.studentName||'').trim(),sid=String(d.studentId||f.studentId||'').trim();if(!name)continue;
 const matches=[...roster.values()].filter(s=>s.name===name);
 const key=sid?'id:'+sid:matches.length===1?matches[0].key:'name:'+name,old=roster.get(key);
 const s={key,name,studentId:sid,department:String(f.department||'').trim(),admissionYear:academicYear(f.admissionDate)};
 roster.set(key,{...s,department:s.department||old?.department||'',admissionYear:s.admissionYear||old?.admissionYear||0});
 }
 for(const r of saved)if(!roster.has(r.studentKey))roster.set(r.studentKey,{key:r.studentKey,name:r.studentName,studentId:r.studentId||'',department:r.department||'',admissionYear:r.admissionYear||0});
 students=[...roster.values()].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
 const selected=$('handoverDepartment').value;
 $('handoverDepartment').innerHTML='<option value="">全部系別</option>'+[...new Set(students.map(s=>s.department).filter(Boolean))].sort().map(d=>'<option>'+esc(d)+'</option>').join('');
 $('handoverDepartment').value=selected;render();
 }catch(e){$('handoverStatus').textContent='載入失敗：'+e.message;}finally{loading=false;}
}
function render(){
 let t;try{t=term();}catch(e){$('handoverStatus').textContent=e.message;return;}
 const year=Number(t.split('-')[0]),search=$('handoverSearch').value.trim().toLowerCase(),department=$('handoverDepartment').value,g=$('handoverGrade').value;
 const list=students.filter(s=>(!department||s.department===department)&&(!g||(g==='unknown'?grade(s,year)<=0:grade(s,year)===Number(g)))&&[s.name,s.studentId,s.department].join(' ').toLowerCase().includes(search));
 $('handoverStatus').textContent=t+'｜共 '+list.length+' 位學生；年級依入學年度推算，未填入學日期者顯示未確認。';
 $('handoverList').innerHTML=list.map(s=>{
 const n=students.indexOf(s),gr=grade(s,year);
 return '<article class="editor-card"><div class="page-head"><div><h2>'+esc(s.name)+'</h2><p>'+esc(s.studentId||'未填學號')+'｜'+esc(s.department||'未填系別')+'｜'+(gr>0?gr+'年級':'年級未確認')+'</p></div></div><div class="table-wrap"><table class="entry-table"><thead><tr><th>交付項目</th><th>交付日期</th><th>需繳回</th><th>已繳回</th></tr></thead><tbody>'+items(s).map(item=>'<tr data-student="'+n+'" data-item="'+esc(item.id)+'"><td>'+esc(item.name)+'</td><td><input aria-label="'+esc(item.name)+'交付日期" type="date" data-field="givenDate" value="'+esc(item.givenDate)+'"></td><td><input aria-label="'+esc(item.name)+'需繳回" type="checkbox" data-field="requiresReturn" '+(item.requiresReturn?'checked':'')+'></td><td><input aria-label="'+esc(item.name)+'已繳回" type="checkbox" data-field="returned" '+(item.returned?'checked':'')+' '+(!item.requiresReturn?'disabled':'')+'></td></tr>').join('')+'</tbody></table></div><div class="actions"><input aria-label="其他項目名稱" id="handoverOther'+n+'" placeholder="其他項目名稱"><button type="button" class="secondary" data-add-other="'+n+'">＋ 新增其他項目</button></div></article>';
 }).join('')||'<div class="editor-card">目前沒有符合條件的學生。</div>';
}
let writeQueue=Promise.resolve();
async function persist(s,mutate){
 const user=auth.currentUser,selectedTerm=term(),scope=owner;
 if(!user||!scope||user.email.toLowerCase()!==sessionEmail)throw Error('請先重新載入。');
 const task=writeQueue.then(async()=>{
 const known=saved.find(r=>r.studentKey===s.key&&r.term===selectedTerm);
 const ref=doc(db,'adminDocuments',known?.id||'handover-'+encodeURIComponent(scope+'|'+s.key+'|'+selectedTerm));
 const build=existing=>{
 const next=mutate(existing.map(x=>({...x})));
 return {type:TYPE,ownerEmail:scope,studentKey:s.key,studentName:s.name,studentId:s.studentId,department:s.department,admissionYear:s.admissionYear,term:selectedTerm,items:next,updatedAt:serverTimestamp(),lastEditorEmail:user.email.toLowerCase()};
 };
 let payload;
 if(known){
 payload=await runTransaction(db,async tx=>{
 const snap=await tx.get(ref);if(!snap.exists())throw Error('紀錄已變更，請重新載入後再試。');
 const next=build(snap.data().items||[]);tx.update(ref,next);return next;
 });
 }else{
 payload=build(fixed.map((name,i)=>({id:'fixed-'+i,name,givenDate:'',requiresReturn:true,returned:false})));
 await setDoc(ref,{...payload,ownerUid:user.uid,createdAt:serverTimestamp()});
 }
 const result={...payload,id:ref.id},i=saved.findIndex(x=>x.id===ref.id);
 if(i<0)saved.push(result);else saved[i]=result;
 return selectedTerm===term();
 });
 writeQueue=task.catch(()=>{});
 return task;
}
const nav=document.createElement('button');nav.className='nav';nav.dataset.view='studentHandover';nav.textContent='📋 表單交付紀錄';
document.querySelector('.sidebar .spacer').before(nav);
const page=document.createElement('section');page.id='studentHandover';page.className='page hidden';
const now=new Date(),year=now.getFullYear()-1911-(now.getMonth()<7?1:0);
page.innerHTML='<div class="page-head"><div><h1>表單交付紀錄</h1><p>記錄交給學生的文件；每學期分開保存，修改後自動儲存。</p></div><button type="button" class="secondary" id="handoverRefresh">重新載入</button></div><div class="editor-card"><div class="official-grid cols-4"><label>搜尋<input id="handoverSearch" placeholder="姓名、學號或系別"></label><label>系別<select id="handoverDepartment"><option value="">全部系別</option></select></label><label>學年度<input id="handoverYear" inputmode="numeric" value="'+year+'" placeholder="例如 115"></label><label>學期<select id="handoverTerm"><option value="1">第1學期</option><option value="2">第2學期</option></select></label><label>年級<select id="handoverGrade"><option value="">全部年級</option>'+Array.from({length:8},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+'年級</option>').join('')+'<option value="unknown">年級未確認</option></select></label></div><p id="handoverStatus" aria-live="polite"></p></div><div id="handoverList"></div>';
document.querySelector('main.main').append(page);
let sessionEmail='';
nav.onclick=async()=>{
 const ok=await(window.__ispAutosave?.flush?.('handover')??true);if(ok===false)return;
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('hidden',p!==page));
 document.querySelectorAll('.nav').forEach(b=>b.classList.toggle('active',b===nav));
 sessionEmail=auth.currentUser?.email?.toLowerCase()||'';students=[];saved=[];$('handoverList').replaceChildren();await load();
};
$('handoverTerm').value=now.getMonth()>=1&&now.getMonth()<7?'2':'1';
$('handoverRefresh').onclick=load;
for(const id of ['handoverSearch','handoverDepartment','handoverYear','handoverTerm','handoverGrade'])$(id).addEventListener(id==='handoverSearch'?'input':'change',render);
page.addEventListener('change',async e=>{
 const input=e.target,row=input.closest('tr[data-student]');if(!row||!input.dataset.field)return;
 const student=students[Number(row.dataset.student)],field=input.dataset.field,value=input.type==='checkbox'?input.checked:input.value;
 const controls=[...row.querySelectorAll('input')];controls.forEach(x=>x.disabled=true);
 try{
 await persist(student,list=>list.map(item=>item.id===row.dataset.item?{...item,[field]:value,...(field==='requiresReturn'&&!value?{returned:false}:{})}:item));
 $('handoverStatus').textContent='已儲存';
 const returned=row.querySelector('[data-field="returned"]');if(field==='requiresReturn'&&!value)returned.checked=false;
 }catch(err){$('handoverStatus').textContent='儲存失敗：'+err.message;input.type==='checkbox'?input.checked=!value:input.value=(items(student).find(x=>x.id===row.dataset.item)?.[field]||'');}
 finally{controls.forEach(x=>x.disabled=false);row.querySelector('[data-field="returned"]').disabled=!row.querySelector('[data-field="requiresReturn"]').checked;}
});
page.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-add-other]');if(!btn)return;
 const n=Number(btn.dataset.addOther),input=$('handoverOther'+n),name=input.value.trim();if(!name){input.focus();return;}
 const id='other-'+crypto.randomUUID();btn.disabled=true;
 try{const current=await persist(students[n],list=>{if(list.some(x=>x.name===name))throw Error('已有同名項目。');return [...list,{id,name,givenDate:'',requiresReturn:true,returned:false}];});if(current)render();$('handoverStatus').textContent='已新增並儲存';}catch(err){$('handoverStatus').textContent='新增失敗：'+err.message;}finally{btn.disabled=false;}
});
