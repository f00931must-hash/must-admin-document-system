import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const norm=v=>String(v??"").trim();
const normName=v=>norm(v).replace(/[\\s　]+/g,"");
const normDept=v=>norm(v).replace(/系$/u,"");

const SAME_NAME_FIELDS=[
  "studentName","department",
  "abilityHealth","abilitySensory","abilityMotor","abilityCognitive",
  "abilityCommunication","abilityAcademic","abilitySelfCare","abilitySocialEmotional",
  "strengthRelationship","strengthEmotion","strengthIllnessAwareness","strengthProblemSolving",
  "strengthResourceSeeking","strengthSupportSystem","strengthFamilyInteraction","strengthFamilyEconomy",
  "analysisSelfCare","analysisStudyWork","analysisMobility","analysisTransport","analysisCommunication",
  "analysisUnderstanding","analysisExpression","analysisInteraction","analysisLeisure",
  "studentNeedsAssessment","serviceEvaluationSummary"
];

async function ownerEmail(){
  const user=auth.currentUser;if(!user?.email)return "";
  const email=norm(user.email).toLowerCase();
  try{
    const s=await getDoc(doc(db,"settings","adminAccess")),a=s.data()?.users?.[email];
    if(a?.enabled!==false&&a?.role==="assistant"&&a?.ownerEmail)return norm(a.ownerEmail).toLowerCase();
    if(a?.enabled!==false&&a)return email;
  }catch{}
  try{
    const s=await getDoc(doc(db,"administrativeAssistants",email));
    if(s.exists()&&s.data()?.enabled===true&&s.data()?.ownerEmail)return norm(s.data().ownerEmail).toLowerCase();
  }catch{}
  return email;
}
async function ownerDocs(){
  const owner=await ownerEmail();
  if(!owner)return [];
  return window.__adminDocumentsCache?.getOwnerDocs?.(owner,{force:true})||[];
}
function semesterValue(form,name){
  const els=[...form.elements].filter(el=>el.name===name);
  if(!els.length)return "";
  const first=els[0];
  if(first.type==="radio")return els.find(el=>el.checked)?.value||"";
  if(first.type==="checkbox")return els.filter(el=>el.checked).map(el=>el.value);
  return first.value??"";
}
function isBlank(value){
  return Array.isArray(value)?value.length===0:!norm(value);
}
function setField(form,name,value,{onlyBlank=false}={}){
  const els=[...form.elements].filter(el=>el.name===name);
  if(!els.length||value===undefined||value===null)return false;
  if(onlyBlank&&!isBlank(semesterValue(form,name)))return false;
  let changed=false;
  for(const el of els){
    if(el.type==="radio"){
      const next=String(el.value)===String(value);
      if(el.checked!==next){el.checked=next;changed=true;}
    }else if(el.type==="checkbox"){
      const values=Array.isArray(value)?value:[value];
      const next=values.map(String).includes(String(el.value));
      if(el.checked!==next){el.checked=next;changed=true;}
    }else{
      const next=Array.isArray(value)?value.join("、"):String(value??"");
      if(el.value!==next){el.value=next;changed=true;}
    }
  }
  if(changed){
    els[0].dispatchEvent(new Event("input",{bubbles:true}));
    els[0].dispatchEvent(new Event("change",{bubbles:true}));
  }
  return changed;
}
function candidateLabel(record){
  const f=record.form||{},id=norm(record.studentId||f.studentId),adm=norm(f.admissionDate);
  return [record.studentName||f.studentName||"未命名",id?("學號 "+id):"",adm?("入學 "+adm):""].filter(Boolean).join("｜");
}
function chooseCandidate(candidates){
  if(candidates.length===1)return Promise.resolve(candidates[0]);
  return new Promise(resolve=>{
    const overlay=document.createElement("div");
    overlay.className="semester-term-modal";
    overlay.innerHTML=`<div class="semester-term-dialog import-newborn-dialog"><h3>找到多份新生 ISP</h3><p>姓名與科系有多筆相符資料，請選擇要帶入哪一份。</p><div class="import-newborn-candidates"></div><div class="actions"><button type="button" class="secondary import-cancel">取消</button></div></div>`;
    document.body.appendChild(overlay);
    const list=overlay.querySelector(".import-newborn-candidates");
    candidates.forEach(record=>{
      const b=document.createElement("button");b.type="button";b.className="secondary import-candidate";
      b.textContent=candidateLabel(record);
      b.onclick=()=>{overlay.remove();resolve(record);};
      list.appendChild(b);
    });
    const close=()=>{overlay.remove();resolve(null);};
    overlay.querySelector(".import-cancel").onclick=close;
    overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
  });
}
function chooseMode(record){
  return new Promise(resolve=>{
    const overlay=document.createElement("div");
    overlay.className="semester-term-modal";
    const f=record.form||{};
    overlay.innerHTML=`<div class="semester-term-dialog import-newborn-dialog">
      <h3>從新生 ISP 帶入</h3>
      <p>找到：<strong>${candidateLabel(record)}</strong></p>
      <p class="field-hint">學年度、學期、填表日期與「其他」不會被修改。班級若目前已有內容，也會保留目前學期的班級。</p>
      <div class="import-mode-grid">
        <button type="button" class="primary import-blank"><strong>只填空白欄位</strong><small>建議使用，不覆蓋老師已修改的內容</small></button>
        <button type="button" class="secondary import-all"><strong>覆蓋共通欄位</strong><small>將共同評估內容更新成新生 ISP 版本</small></button>
      </div>
      <div class="actions"><button type="button" class="secondary import-cancel">取消</button></div>
    </div>`;
    document.body.appendChild(overlay);
    const done=value=>{overlay.remove();resolve(value);};
    overlay.querySelector(".import-blank").onclick=()=>done("blank");
    overlay.querySelector(".import-all").onclick=()=>done("all");
    overlay.querySelector(".import-cancel").onclick=()=>done(null);
    overlay.addEventListener("click",e=>{if(e.target===overlay)done(null);});
  });
}
function applyImport(record,mode){
  const form=$("semesterIspForm"),src=record.form||{};if(!form)return 0;
  const onlyBlank=mode==="blank";
  let changed=0;
  // 姓名、科系可同步；班級只在目前空白時帶入，避免高年級被新生「一甲」蓋回去。
  for(const name of SAME_NAME_FIELDS){
    if(name==="studentName"||name==="department"){
      if(setField(form,name,src[name],{onlyBlank}))changed++;
      continue;
    }
    if(setField(form,name,src[name],{onlyBlank}))changed++;
  }
  if(setField(form,"studentClass",src.studentClass,{onlyBlank:true}))changed++;
  if(setField(form,"disabilityType",src.disabilityType||src.certificateCategory,{onlyBlank}))changed++;
  if(setField(form,"disabilityLevel",src.certificateLevel,{onlyBlank}))changed++;
  return changed;
}
async function runImport(){
  const form=$("semesterIspForm");if(!form)return;
  const name=norm(form.elements.studentName?.value),dept=normDept(form.elements.department?.value);
  if(!name){alert("請先輸入學生姓名，再從新生 ISP 帶入。");form.elements.studentName?.focus();return;}
  const all=await ownerDocs();
  let candidates=all.filter(x=>(!x.type||x.type==="ISP")&&normName(x.studentName||x.form?.studentName)===normName(name));
  if(dept){
    const sameDept=candidates.filter(x=>normDept(x.form?.department)===dept);
    if(sameDept.length)candidates=sameDept;
  }
  candidates.sort((a,b)=>(b.updatedAt?.seconds||b.createdAt?.seconds||0)-(a.updatedAt?.seconds||a.createdAt?.seconds||0));
  if(!candidates.length){alert(`找不到「${name}」對應的新生 ISP 總表。請確認姓名與科系是否一致。`);return;}
  const source=await chooseCandidate(candidates);if(!source)return;
  const mode=await chooseMode(source);if(!mode)return;
  if(mode==="all"&&!confirm("確定要覆蓋目前學期 ISP 的共通欄位嗎？\n\n學年度、學期、填表日期、班級與學期專屬內容不會被覆蓋。"))return;
  const changed=applyImport(source,mode);
  alert(changed?(`已從新生 ISP 帶入 ${changed} 個欄位。\n請確認內容後再按「儲存學期 ISP」。`):"目前沒有需要帶入的空白或不同欄位。");
}
function ensureButton(){
  const nav=$("semesterTermNavigator"),form=$("semesterIspForm");if(!nav||!form||$("importNewbornIspBtn"))return;
  const actions=document.createElement("div");actions.className="semester-import-newborn-actions";
  actions.innerHTML='<button type="button" id="importNewbornIspBtn" class="secondary">↳ 從新生 ISP 帶入</button><small>只複製共通欄位，不會動到學年度、學期與填表日期。</small>';
  const grid=nav.querySelector(".semester-term-grid");
  nav.insertBefore(actions,grid);
  $("importNewbornIspBtn").addEventListener("click",runImport);
}
const observer=new MutationObserver(ensureButton);
observer.observe(document.body,{childList:true,subtree:true});
setTimeout(ensureButton,0);
console.log("Semester ISP import from newborn v1.0.0 loaded");
