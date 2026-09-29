import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, writeBatch, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
const app=getApps()[0]||initializeApp(firebaseConfig), auth=getAuth(app), db=getFirestore(app);
const $=id=>document.getElementById(id), clean=v=>String(v??'').replace(/\s+/g,'').trim();
let contacts=[], names=[], staged=[], canEdit=false;
const chosenContact=new Map();
const personName=v=>clean(v).replace(/[（(][^）)]*[）)]/g,'').replace(/老師$/,'');
const validEmail=v=>/^[^\s@;]+@[^\s@;]+\.[^\s@;]+$/.test(String(v||'').trim());
const textCell=(row,n)=>{
  const c=row.getCell(n), v=c.value;
  if(v&&typeof v==='object')return String(v.text||v.hyperlink||v.result||v.richText?.map(x=>x.text).join('')||'').trim();
  return String(v??'').trim();
};
const status=(id,message)=>$(id).textContent=message;
const sheetNames=sheet=>{
  const result=new Set();
  // 本系統的老師版在 B7；學生版及合併版在「授課教師」欄。
  if(clean(textCell(sheet.getRow(7),1))==='致：'){
    const name=clean(textCell(sheet.getRow(7),2));
    if(name)result.add(name);
    return [...result];
  }
  let teacherColumn=0,headerRow=0;
  sheet.eachRow((row,rowNumber)=>{
    if(teacherColumn)return;
    row.eachCell((cell,column)=>{
      if(clean(textCell(row,column))==='授課教師'){
        teacherColumn=column;headerRow=rowNumber;
      }
    });
  });
  if(teacherColumn){
    sheet.eachRow((row,rowNumber)=>{
      if(rowNumber<=headerRow)return;
      const name=clean(textCell(row,teacherColumn)).replace(/老師$/,'');
      if(/^[\u3400-\u9fff]{2,5}$/.test(name))result.add(name);
    });
  }
  return [...result];
};
function match(name){
  const found=contacts.filter(c=>personName(c.name)===personName(name));
  const distinct=new Map();
  for(const c of found)if(validEmail(c.email)&&!distinct.has(c.email.toLowerCase()))distinct.set(c.email.toLowerCase(),c);
  const selected=found.find(c=>c.id===chosenContact.get(name));
  if(selected&&validEmail(selected.email))return {state:'人工確認',contact:selected,found};
  if(distinct.size===1)return {state:'已配對',contact:[...distinct.values()][0],found};
  if(distinct.size>1)return {state:'同名不同信箱，請選擇系所',found};
  return {state:found.length?'未確認信箱':'通訊錄無資料',found};
}
function renderMatches(){
  const body=$('contactMatches');body.replaceChildren();
  for(const name of names){
    const m=match(name),tr=document.createElement('tr');
    const departments=[...new Set((m.found||[]).map(c=>c.department).filter(Boolean))].join('、');
    for(const value of [name,departments,m.contact?.email||'',m.contact?.extension||'']){
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    }
    const state=document.createElement('td');state.textContent=m.state;
    if(m.state==='同名不同信箱，請選擇系所'){
      const options=document.createElement('div');options.className='contact-choices';
      const choices=new Map();
      m.found.filter(c=>validEmail(c.email)).forEach(c=>{
        const key=c.email.toLowerCase();if(!choices.has(key))choices.set(key,c);
      });
      for(const c of choices.values()){
        const button=document.createElement('button');button.type='button';button.className='secondary';
        button.textContent=`${c.department||'未填系所'}｜${c.email}`;
        button.onclick=()=>{chosenContact.set(name,c.id);renderMatches();};options.append(button);
      }
      state.append(options);
    }
    tr.append(state);body.append(tr);
  }
  const matched=names.filter(n=>match(n).contact).length;
  status('contactStatus',names.length?`辨識 ${names.length} 位老師；${matched} 位已配對，${names.length-matched} 位待確認。`:'尚未匯入簽收表。');
}
function renderDirectory(){const q=clean($('contactSearch').value).toLowerCase(),body=$('contactDirectory');body.replaceChildren();for(const c of contacts.filter(x=>[x.name,x.department,x.email].some(v=>clean(v).toLowerCase().includes(q)))){const tr=document.createElement('tr');for(const v of [c.name,c.department,validEmail(c.email)?c.email:'未確認信箱',c.extension]){const td=document.createElement('td');td.textContent=v||'';tr.append(td);}const actions=document.createElement('td');if(canEdit){const edit=document.createElement('button');edit.type='button';edit.className='secondary';edit.textContent='修改';edit.onclick=()=>{for(const [field,v] of Object.entries({Id:c.id,Name:c.name,Department:c.department,Email:c.email,Extension:c.extension}))$('contact'+field).value=v||'';$('contactName').focus();};const del=document.createElement('button');del.type='button';del.className='delete-doc';del.textContent='刪除';del.onclick=async()=>{if(!confirm(`刪除 ${c.name}（${c.department||'未填系所'}）的通訊資料？`))return;try{await deleteDoc(doc(db,'adminTeacherContacts',c.id));await loadContacts();}catch(e){alert('刪除失敗：'+e.message);}};actions.append(edit,del);}tr.append(actions);body.append(tr);}}
async function loadContacts(){const snap=await getDocs(collection(db,'adminTeacherContacts'));contacts=snap.docs.map(x=>({id:x.id,...x.data()}));contacts.sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));renderDirectory();renderMatches();}
onAuthStateChanged(auth,async user=>{if(!user){contacts=[];names=[];renderDirectory();renderMatches();return;}try{const access=await getDoc(doc(db,'settings','adminAccess'));const record=access.data()?.users?.[user.email.toLowerCase()];canEdit=!!record&&record.enabled!==false;if(!canEdit){const assistant=await getDoc(doc(db,'administrativeAssistants',user.email.toLowerCase()));canEdit=assistant.exists()&&assistant.data()?.enabled===true;}$('contactForm').classList.toggle('hidden',!canEdit);$('contactDirectoryFile').closest('label').classList.toggle('hidden',!canEdit);$('contactImportBtn').classList.toggle('hidden',!canEdit);await loadContacts();}catch(e){status('contactStatus','通訊錄無法載入；請確認權限與資料庫規則。');console.error(e);}});
$('contactParseBtn').onclick=async()=>{const files=[...$('contactReceiptFiles').files];if(!files.length){status('contactStatus','請先選擇 ISP 簽收表 Excel。');return;}try{const set=new Set();for(const f of files){const book=new window.ExcelJS.Workbook();await book.xlsx.load(await f.arrayBuffer());book.eachSheet(sheet=>sheetNames(sheet).forEach(n=>set.add(n)));}names=[...set].sort((a,b)=>a.localeCompare(b,'zh-Hant'));chosenContact.clear();renderMatches();if(!names.length)status('contactStatus','沒有辨識到老師；請確認上傳的是本系統產生的 ISP 簽收表。');}catch(e){status('contactStatus','讀取簽收表失敗：'+e.message);}};
$('contactClearBtn').onclick=()=>{names=[];chosenContact.clear();$('contactReceiptFiles').value='';renderMatches();};
$('contactCopyBtn').onclick=async()=>{const emails=[...new Set(names.map(n=>match(n).contact?.email?.trim()).filter(validEmail))];if(!emails.length){alert('尚無已配對的 Email。');return;}try{await navigator.clipboard.writeText(emails.join('; '));alert(`已複製 ${emails.length} 個 Email；未配對的老師未列入。`);}catch(e){alert('複製失敗，請確認瀏覽器剪貼簿權限。');}};
$('contactDownloadBtn').onclick=async()=>{if(!names.length){alert('請先匯入簽收表。');return;}const book=new window.ExcelJS.Workbook(),sheet=book.addWorksheet('老師聯絡名單');sheet.addRow(['老師姓名','系所','Email','分機','配對狀態']);for(const n of names){const m=match(n);sheet.addRow([n,m.contact?.department||'',m.contact?.email||'',m.contact?.extension||'',m.state]);}sheet.columns=[{width:18},{width:32},{width:38},{width:24},{width:26}];sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF17527A'}};sheet.autoFilter={from:'A1',to:`E${sheet.rowCount}`};window.saveAs(new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'ISP老師聯絡名單.xlsx');};
$('contactCancelEdit').onclick=()=>{$('contactForm').reset();$('contactId').value='';};
$('contactSearch').oninput=renderDirectory;
$('contactForm').onsubmit=async e=>{e.preventDefault();if(!canEdit)return;const name=$('contactName').value.trim(),department=$('contactDepartment').value.trim(),email=$('contactEmail').value.trim().toLowerCase(),extension=$('contactExtension').value.trim(),id=$('contactId').value;if(!name){alert('請填入老師姓名。');return;}if(!id&&contacts.some(c=>clean(c.name)===clean(name)&&clean(c.department)===clean(department))){alert('同名同系所已有資料；請修改既有資料。');return;}try{const data={name,department,email,extension,updatedAt:serverTimestamp()};if(id)await updateDoc(doc(db,'adminTeacherContacts',id),data);else await addDoc(collection(db,'adminTeacherContacts'),data);$('contactCancelEdit').click();await loadContacts();}catch(err){alert('儲存失敗：'+err.message);}};
function parseDelimited(text,delimiter){const rows=[],row=[];let value='',quote=false;for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'&&quote&&text[i+1]==='"'){value+='"';i++;}else if(ch==='"')quote=!quote;else if(ch===delimiter&&!quote){row.push(value);value='';}else if((ch==='\n'||ch==='\r')&&!quote){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(Boolean))rows.push([...row]);row.length=0;value='';}else value+=ch;}row.push(value);if(row.some(Boolean))rows.push(row);return rows;}
async function directoryRows(file){if(/\.xlsx$/i.test(file.name)){const book=new window.ExcelJS.Workbook();await book.xlsx.load(await file.arrayBuffer());const sheet=book.worksheets[0],rows=[];sheet.eachRow(r=>{const row=[];for(let i=1;i<=7;i++)row.push(textCell(r,i));rows.push(row);});return rows;}return parseDelimited(await file.text(),/\.tsv$/i.test(file.name)?'\t':',');}
$('contactImportBtn').onclick=async()=>{
  const file=$('contactDirectoryFile').files[0];
  if(!file)return status('contactImportStatus','請先選取學校名錄。');
  try{
    const rows=await directoryRows(file);
    if(!rows.length)throw Error('檔案是空的');
    const header=rows[0].map(clean);
    const column=terms=>header.findIndex(h=>terms.some(t=>h.toLowerCase()===t.toLowerCase()));
    let ni=column(['老師姓名','姓名','教師姓名']),di=column(['系所','單位','部門']),ei=column(['Email','電子郵件','信箱']),xi=column(['電話','分機','聯絡電話']);
    if(ni>=0&&ei>=0)rows.shift();
    else if(rows[0].length>=7){ni=2;di=1;ei=5;xi=6;}
    else throw Error('找不到「老師姓名」和「Email」欄位，也不是七欄學校名錄');
    const valid=[],keys=new Map();let unnamed=0,unconfirmed=0,duplicates=0;
    for(const r of rows){
      const item={name:String(r[ni]||'').trim(),department:String(r[di]||'').trim(),email:String(r[ei]||'').replace(/\s+/g,'').toLowerCase(),extension:String(r[xi]||'').trim()};
      if(!item.name){unnamed++;continue;}
      if(!validEmail(item.email))unconfirmed++;
      const key=personName(item.name)+'|'+clean(item.department)+'|'+item.email;
      if(keys.has(key)){duplicates++;const old=valid[keys.get(key)];if(!old.extension&&item.extension)old.extension=item.extension;continue;}
      keys.set(key,valid.length);valid.push(item);
    }
    staged=valid;
    status('contactImportStatus',`共 ${rows.length} 列：可匯入 ${staged.length} 筆，重複 ${duplicates} 筆，其中未確認信箱 ${unconfirmed} 列；重複 ${duplicates} 列、無姓名 ${unnamed} 列。相同姓名、系所及 Email 的資料會更新，其餘會新增。`);
    $('contactApplyImportBtn').classList.toggle('hidden',!staged.length);
  }catch(e){staged=[];$('contactApplyImportBtn').classList.add('hidden');status('contactImportStatus','匯入預覽失敗：'+e.message);}
};
$('contactApplyImportBtn').onclick=async()=>{
  if(!canEdit||!staged.length)return;
  const button=$('contactApplyImportBtn');button.disabled=true;let done=0;
  try{
    const existing=new Map(contacts.map(c=>[personName(c.name)+'|'+clean(c.department)+'|'+String(c.email||'').toLowerCase(),c]));
    for(let offset=0;offset<staged.length;offset+=400){
      const batch=writeBatch(db),chunk=staged.slice(offset,offset+400);
      for(const item of chunk){
        const old=existing.get(personName(item.name)+'|'+clean(item.department)+'|'+item.email),ref=old?doc(db,'adminTeacherContacts',old.id):doc(collection(db,'adminTeacherContacts'));
        batch.set(ref,{...item,updatedAt:serverTimestamp()});
      }
      await batch.commit();done+=chunk.length;
      status('contactImportStatus',`已匯入 ${done}/${staged.length} 筆…`);
    }
    staged=[];button.classList.add('hidden');status('contactImportStatus',`完成匯入 ${done} 筆。`);await loadContacts();
  }catch(e){status('contactImportStatus',`已處理 ${done} 筆，後續失敗：${e.message}。可重新預覽並重試。`);await loadContacts();}
  finally{button.disabled=false;}
};
