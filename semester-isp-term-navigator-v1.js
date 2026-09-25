import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const norm=v=>String(v??"").trim();
const normName=v=>norm(v).replace(/[\s　]+/g,"");
const gradeValues=["一","二","三","四","五","六","七","八"];
const gradeIndex=v=>gradeValues.indexOf(norm(v))+1;
const gradeFor=n=>gradeValues[n-1]||"";
const currentAcademicYear=()=>{const d=new Date();return d.getFullYear()-1911-(d.getMonth()<7?1:0);};

function inferredGrade(form){
  const direct=gradeIndex(form?.studentGrade);if(direct)return direct;
  const m=norm(form?.studentClass).match(/[一二三四五六七八]/);
  return m?gradeIndex(m[0]):0;
}
function baseYearFromForm(form){
  const year=Number(norm(form?.academicYear)),g=inferredGrade(form);
  return year&&g?year-g+1:(year||currentAcademicYear());
}
function targetFor(baseYear,yearIndex,semester){
  return {academicYear:String(Number(baseYear)+yearIndex-1),studentGrade:gradeFor(yearIndex),semester:String(semester),yearIndex};
}
function adjustClass(value,targetGrade){
  const s=norm(value);if(!s||!targetGrade)return s;
  if(/[一二三四五六七八]/.test(s))return s.replace(/[一二三四五六七八]/,targetGrade);
  return s;
}
function serialize(form){
  const out={};
  for(const el of form?.elements||[]){
    if(!el.name||["button","submit"].includes(el.type))continue;
    if(el.type==="checkbox"){if(!out[el.name])out[el.name]=[];if(el.checked)out[el.name].push(el.value);}
    else if(el.type==="radio"){if(el.checked)out[el.name]=el.value;else if(!(el.name in out))out[el.name]="";}
    else out[el.name]=el.value;
  }
  return out;
}
function fillForm(form,data,id=""){
  form.reset();$("semesterDocId").value=id||"";
  for(const el of form.elements){
    if(!el.name)continue;
    const value=data?.[el.name];
    if(el.type==="checkbox")el.checked=Array.isArray(value)?value.includes(el.value):value===el.value;
    else if(el.type==="radio")el.checked=value===el.value;
    else if(value!==undefined&&value!==null)el.value=value;
  }
}
async function ownerEmail(){
  const user=auth.currentUser;if(!user?.email)return "";
  const email=norm(user.email).toLowerCase();
  try{
    const s=await getDoc(doc(db,"settings","adminAccess"));const a=s.data()?.users?.[email];
    if(a?.enabled!==false&&a?.role==="assistant"&&a?.ownerEmail)return norm(a.ownerEmail).toLowerCase();
  }catch{}
  try{
    const s=await getDoc(doc(db,"administrativeAssistants",email));
    if(s.exists()&&s.data()?.enabled===true&&s.data()?.ownerEmail)return norm(s.data().ownerEmail).toLowerCase();
  }catch{}
  return email;
}
async function docsForOwner(force=false){
  const owner=await ownerEmail();if(!owner)return [];
  return window.__adminDocumentsCache.getOwnerDocs(owner,{force});
}
function matchingDoc(all,form,target){
  const name=normName(form?.studentName),dept=norm(form?.department);
  return all.filter(x=>x.type==="SEMESTER_ISP")
    .filter(x=>normName(x.studentName||x.form?.studentName)===name)
    .filter(x=>!dept||!norm(x.form?.department)||norm(x.form?.department)===dept)
    .filter(x=>String(x.form?.academicYear||"")===target.academicYear&&String(x.form?.semester||"")===target.semester)
    .sort((a,b)=>(b.updatedAt?.seconds||b.createdAt?.seconds||0)-(a.updatedAt?.seconds||a.createdAt?.seconds||0))[0]||null;
}
function markActive(){
  const form=$("semesterIspForm"),nav=$("semesterTermNavigator");if(!form||!nav)return;
  const f=serialize(form),base=Number($("semesterBaseYear")?.value)||baseYearFromForm(f);
  const g=inferredGrade(f),sem=Number(f.semester);
  nav.querySelectorAll(".semester-term-btn").forEach(btn=>{
    const y=Number(btn.dataset.yearIndex),s=Number(btn.dataset.semester);
    const target=targetFor(base,y,s);
    btn.classList.toggle("active",target.academicYear===String(f.academicYear||"")&&s===sem&&(g===y||!g));
  });
}
function renderButtons(){
  const nav=$("semesterTermNavigator"),baseInput=$("semesterBaseYear");if(!nav||!baseInput)return;
  const base=Number(baseInput.value)||currentAcademicYear();
  const grid=nav.querySelector(".semester-term-grid");grid.innerHTML="";
  for(let y=1;y<=8;y++){
    for(let s=1;s<=2;s++){
      const t=targetFor(base,y,s),btn=document.createElement("button");
      btn.type="button";btn.className="semester-term-btn";
      btn.dataset.yearIndex=String(y);btn.dataset.semester=String(s);
      btn.innerHTML=`<strong>${y}-${s}</strong><small>${t.academicYear}-${s}</small>`;
      btn.addEventListener("click",()=>selectTerm(y,s));
      grid.appendChild(btn);
    }
  }
  markActive();
}
async function selectTerm(yearIndex,semester){
  const form=$("semesterIspForm");if(!form)return;
  const before=serialize(form),base=Number($("semesterBaseYear")?.value)||baseYearFromForm(before),target=targetFor(base,yearIndex,semester);
  if(!before.studentName){
    form.elements.academicYear.value=target.academicYear;
    form.elements.studentGrade.value=target.studentGrade;
    form.elements.semester.value=target.semester;
    markActive();return;
  }
  const all=await docsForOwner(true),hit=matchingDoc(all,before,target);
  if(hit){
    fillForm(form,hit.form||{},hit.id);
    $("semesterBaseYear").value=String(baseYearFromForm(hit.form||{}));
    renderButtons();
    document.dispatchEvent(new CustomEvent("semester:term-loaded",{detail:{id:hit.id}}));
    return;
  }
  const currentYear=String(before.academicYear||""),currentSem=String(before.semester||"");
  if(currentYear===target.academicYear&&currentSem===target.semester){markActive();return;}
  if(!confirm(`${target.academicYear} 學年度第 ${target.semester} 學期尚未建立。\n\n要保留目前內容，切換成這個學期的新草稿嗎？\n（尚未儲存前不會新增資料。）`)){markActive();return;}
  $("semesterDocId").value="";
  form.elements.academicYear.value=target.academicYear;
  form.elements.studentGrade.value=target.studentGrade;
  form.elements.semester.value=target.semester;
  if(form.elements.studentClass)form.elements.studentClass.value=adjustClass(before.studentClass,target.studentGrade);
  if(form.elements.fillDate)form.elements.fillDate.value="";
  markActive();
  document.dispatchEvent(new Event("input",{bubbles:true}));
}
function ensureNavigator(){
  const form=$("semesterIspForm");if(!form||$("semesterTermNavigator"))return;
  const h2=[...form.querySelectorAll("h2")].find(x=>x.textContent.includes("學期與學生資料"));
  if(!h2)return;
  const box=document.createElement("div");box.id="semesterTermNavigator";box.className="semester-term-navigator";
  box.innerHTML=`<div class="semester-term-head"><div><strong>學期快速切換</strong><small>每顆按鈕代表一個學期；有既有資料時會直接開啟，空白學期可保留目前內容建立新草稿。</small></div><label>第一學年學年度<input id="semesterBaseYear" inputmode="numeric"></label></div><div class="semester-term-grid"></div>`;
  h2.insertAdjacentElement("afterend",box);
  const baseInput=$("semesterBaseYear");
  baseInput.addEventListener("change",renderButtons);
  baseInput.addEventListener("input",()=>{if(/^\d{2,3}$/.test(baseInput.value))renderButtons();});

  const year=form.elements.academicYear,grade=form.elements.studentGrade,sem=form.elements.semester;
  if(year){year.readOnly=true;year.title="由上方學期按鈕決定";}
  if(grade){grade.disabled=true;grade.title="由上方學期按鈕決定";}
  if(sem){sem.disabled=true;sem.title="由上方學期按鈕決定";}

  const updateFromCurrent=()=>{
    const f=serialize(form);
    if(!$("semesterBaseYear").matches(":focus"))$("semesterBaseYear").value=String(baseYearFromForm(f));
    renderButtons();
  };
  document.addEventListener("click",event=>{
    if(event.target.closest?.(".open-semester-doc"))setTimeout(updateFromCurrent,80);
    if(event.target.closest?.("#newSemesterIspBtn,#newSemesterIspListBtn"))setTimeout(()=>{
      $("semesterBaseYear").value=String(currentAcademicYear());renderButtons();selectTerm(1,1);
    },80);
  },true);
  form.addEventListener("reset",()=>setTimeout(()=>{$("semesterBaseYear").value=String(currentAcademicYear());renderButtons();},0));
  setTimeout(updateFromCurrent,0);
}
function copyDialog(record){
  return new Promise(resolve=>{
    const form=record?.form||{},baseDefault=baseYearFromForm(form);
    const overlay=document.createElement("div");overlay.className="semester-term-modal";
    overlay.innerHTML=`<div class="semester-term-dialog"><h3>複製到哪一個學期？</h3><p>原本資料不會修改。請直接選擇目標學期。</p><label class="copy-base-year">第一學年學年度<input inputmode="numeric" value="${baseDefault}"></label><div class="semester-copy-grid"></div><button type="button" class="secondary semester-copy-cancel">取消</button></div>`;
    document.body.appendChild(overlay);
    const baseInput=overlay.querySelector(".copy-base-year input"),grid=overlay.querySelector(".semester-copy-grid");
    const close=value=>{overlay.remove();resolve(value);};
    const draw=async()=>{
      grid.innerHTML="";
      const base=Number(baseInput.value)||baseDefault,all=await docsForOwner(true);
      for(let y=1;y<=8;y++)for(let s=1;s<=2;s++){
        const target=targetFor(base,y,s),exists=matchingDoc(all,form,target),btn=document.createElement("button");
        btn.type="button";btn.className="semester-term-btn"+(exists?" occupied":"");
        btn.disabled=!!exists;
        btn.innerHTML=`<strong>${y}-${s}</strong><small>${target.academicYear}-${s}${exists?"｜已有資料":""}</small>`;
        btn.onclick=()=>close(target);grid.appendChild(btn);
      }
    };
    baseInput.addEventListener("change",draw);overlay.querySelector(".semester-copy-cancel").onclick=()=>close(null);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close(null);});
    draw();
  });
}
async function copyRecord(record){
  if(!record)return false;
  const target=await copyDialog(record);if(!target)return false;
  if(!confirm(`確定要把「${record.studentName||"未命名"}」複製到 ${target.academicYear} 學年度第 ${target.semester} 學期（第 ${target.yearIndex} 年）嗎？\n\n原本資料不會被修改。`))return false;
  const owner=await ownerEmail(),user=auth.currentUser,form=structuredClone(record.form||{});
  form.academicYear=target.academicYear;form.semester=target.semester;form.studentGrade=target.studentGrade;
  form.studentClass=adjustClass(form.studentClass,target.studentGrade);form.fillDate="";
  await addDoc(collection(db,"adminDocuments"),{
    ownerEmail:owner,type:"SEMESTER_ISP",studentName:norm(record.studentName||form.studentName),form,
    copiedFromId:record.id,copiedAt:serverTimestamp(),ownerUid:user?.uid||record.ownerUid||"",
    createdByUid:user?.uid||"",createdByEmail:norm(user?.email).toLowerCase(),createdAt:serverTimestamp(),updatedAt:serverTimestamp(),
    lastEditorUid:user?.uid||"",lastEditorEmail:norm(user?.email).toLowerCase()
  });
  window.__adminDocumentsCache?.invalidate?.(owner);
  return true;
}

ensureNavigator();
new MutationObserver(()=>ensureNavigator()).observe(document.body,{childList:true,subtree:true});
window.__semesterTermNav={ensureNavigator,renderButtons,markActive,copyRecord,baseYearFromForm};
console.log("Semester ISP 16-term navigator v1.0.0 loaded");
