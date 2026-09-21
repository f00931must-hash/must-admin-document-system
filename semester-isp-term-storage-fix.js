import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const norm=v=>String(v??"").trim();
const normName=v=>norm(v).replace(/[\s　]+/g,"");
let ownerEmail="",semesterDocs=[],baseIspDocs=[],installed=false,suppressSwitch=false;

const gradeNo={"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"研一":1,"研二":2};
const supportConfig={
  learningSupport:["無特殊學習支持需求","課業輔導（視學生主動申請或需求提供）","筆記／同儕協助","學習輔具協助","考試調整（延長時間／獨立考場等）","課業提醒與關懷（出缺席／作業狀況）","必要時協助與任課教師溝通","其他"],
  emotionalSupport:["無特殊需求","個別關懷晤談","團體輔導／主題活動參與","課業壓力與情緒支持","人際互動適應關懷","轉介心理諮商資源","其他"],
  environmentSupport:["無特殊需求","需無障礙環境調整","需生活同儕協助","作息與時間管理協助","交通費補助（無法自行上下學）","其他"],
  academicPlanningSupport:["畢業學分檢視與修課進度追蹤","選課諮詢與修課建議","修課負荷評估與調整建議","課程衝堂與學分風險提醒","畢業進度與延畢風險評估","必要時協助與系上溝通修課需求","其他"],
  careerSupport:["生涯探索／討論","職涯諮詢／評估","畢業準備與轉銜規劃討論","履歷／自傳協助（修改與建議）","就業準備支持（基本面試準備／資訊提供）","個別轉銜會議","轉銜資源連結（就業中心等）"],
  adminSupport:["特教生獎助學金申請協助","校內外資源資訊提供：校內－高教深耕計畫","校內行政資源申請協助","校外資源轉介與申請協助","其他"],
  supportAdjustment:["現有支持適切，持續維持","需調整部分支持內容","需新增或加強支持服務","需減少或結束部分支持","其他"]
};

function serialize(form){
  const data={};
  for(const el of form?.elements||[]){
    if(!el.name||["button","submit"].includes(el.type))continue;
    if(el.type==="checkbox"){
      if(!data[el.name])data[el.name]=[];
      if(el.checked)data[el.name].push(el.value);
    }else if(el.type==="radio"){
      if(el.checked)data[el.name]=el.value;
      else if(!(el.name in data))data[el.name]="";
    }else data[el.name]=el.value;
  }
  return data;
}
async function resolveOwner(user){
  if(!user)return "";
  const email=norm(user.email).toLowerCase();
  try{
    const s=await getDoc(doc(db,"settings","adminAccess"));
    const a=s.data()?.users?.[email];
    if(a?.enabled!==false&&a?.role==="assistant"&&a?.ownerEmail)return norm(a.ownerEmail).toLowerCase();
    if(a?.enabled!==false&&a)return email;
  }catch{}
  try{
    const s=await getDoc(doc(db,"administrativeAssistants",email));
    if(s.exists()&&s.data()?.enabled===true&&s.data()?.ownerEmail)return norm(s.data().ownerEmail).toLowerCase();
  }catch{}
  return email;
}
async function refreshDocs(){
  if(!ownerEmail)return;
  try{
    const snap=await getDocs(query(collection(db,"adminDocuments"),where("ownerEmail","==",ownerEmail)));
    const all=snap.docs.map(x=>({id:x.id,...x.data()}));
    semesterDocs=all.filter(x=>x.type==="SEMESTER_ISP");
    baseIspDocs=all.filter(x=>!x.type||x.type==="ISP");
  }catch(error){console.warn("Semester ISP term load failed",error);}
}
function docGrade(d){return norm(d?.form?.studentGrade)||norm(d?.form?.studentClass).match(/[一二三四五六七]|研[一二]/)?.[0]||"";}
function stamp(d){return d?.updatedAt?.seconds||d?.createdAt?.seconds||0;}
function findTermDoc(name,department,grade,semester){
  return semesterDocs
    .filter(d=>normName(d.studentName)===normName(name)&&norm(d.form?.department)===norm(department)&&docGrade(d)===grade&&String(d.form?.semester||"")===String(semester||""))
    .sort((a,b)=>stamp(b)-stamp(a))[0]||null;
}
function setForm(form,data,id=""){
  suppressSwitch=true;
  try{
    form.reset();
    $("semesterDocId").value=id||"";
    for(const el of form.elements){
      if(!el.name)continue;
      const value=data?.[el.name];
      if(el.type==="checkbox")el.checked=Array.isArray(value)?value.includes(el.value):value===el.value;
      else if(el.type==="radio")el.checked=value===el.value;
      else if(value!==undefined&&value!==null)el.value=value;
    }
  }finally{setTimeout(()=>{suppressSwitch=false;},0);}
}
function adjustedClass(value,targetGrade){
  const s=norm(value);if(!s||!targetGrade)return s;
  if(/^研[一二]/.test(s))return s.replace(/^研[一二]/,targetGrade);
  if(/[一二三四五六七]/.test(s))return s.replace(/[一二三四五六七]/,targetGrade);
  return s;
}
function blankTerm(form,targetGrade,targetSemester){
  const before=serialize(form);
  const oldGrade=norm(before.studentGrade);
  const keep={
    studentName:before.studentName||"",department:before.department||"",
    disabilityType:before.disabilityType||"",disabilityLevel:before.disabilityLevel||"",
    studentClass:adjustedClass(before.studentClass,targetGrade)
  };
  const academicYear=norm(before.academicYear);
  setForm(form,{...keep,academicYear,studentGrade:targetGrade,semester:targetSemester,fillDate:""},"");
}
function switchTerm(){
  if(suppressSwitch)return;
  const form=$("semesterIspForm");if(!form)return;
  const f=serialize(form),name=norm(f.studentName),dept=norm(f.department),grade=norm(f.studentGrade),semester=norm(f.semester);
  if(!name||!grade||!semester)return;
  const hit=findTermDoc(name,dept,grade,semester);
  if(hit)setForm(form,hit.form||{},hit.id);
  else blankTerm(form,grade,semester);
}
function restoreCurrentCheckboxes(){
  const id=$("semesterDocId")?.value;if(!id)return;
  const hit=semesterDocs.find(d=>d.id===id);if(!hit)return;
  const form=$("semesterIspForm");if(!form)return;
  for(const el of form.elements){
    if(el.type!=="checkbox"||!el.name)continue;
    const value=hit.form?.[el.name];
    el.checked=Array.isArray(value)?value.includes(el.value):value===el.value;
  }
}
function ensureHint(){
  const form=$("semesterIspForm");if(!form||$("semesterTermSwitchHint"))return;
  const first=form.querySelector(".official-section");if(!first)return;
  const hint=document.createElement("div");hint.id="semesterTermSwitchHint";hint.className="timetable-notice";hint.style.marginTop="10px";
  hint.textContent="同一位學生會依「年級＋學期」分開儲存。切換年級或學期時，系統會自動載入該學期已儲存資料；尚未建立的學期會顯示空白表單。";
  first.appendChild(hint);
}
function markChecks(values,options){
  const set=new Set(Array.isArray(values)?values:[]);
  return options.map(x=>`${set.has(x)?"■":"□"}${x}`).join("\n");
}
function semesterExportDataV2(f){
  const out={...f};
  for(const [name,options] of Object.entries(supportConfig)){
    const block=`${markChecks(f[name],options)}\n說明：${norm(f[`${name}Note`])}`;
    out[name]=block;
    out[`${name}Block`]=block;
    out[`${name}Text`]=block;
    out[`${name}Checks`]=markChecks(f[name],options);
  }
  const strengthNames=["strengthRelationship","strengthEmotion","strengthIllnessAwareness","strengthProblemSolving","strengthResourceSeeking","strengthSupportSystem","strengthFamilyInteraction","strengthFamilyEconomy"];
  const strengthLabels=["建立人際關係能力","情緒控制能力","個人疾病認識能力","解決問題及處理狀況能力","尋求資源能力","支持系統資源","家人的互動與關懷","家庭經濟狀況"];
  out.strengthBlock=strengthNames.map((n,i)=>`(${i+1})${strengthLabels[i]} ${["良好","尚可","待加強"].map(x=>`${f[n]===x?"■":"□"}${x}`).join(" ")}`).join("\n");
  const analysis=[
    ["analysisSelfCare","生活自理能力",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["analysisStudyWork","職（學）業能力",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["analysisMobility","行動能力",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["analysisTransport","交通能力",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["analysisCommunication","通訊能力",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["analysisUnderstanding","認知理解能力",["完全能理解","部份能理解","完全不能理解","本項不適用"]],
    ["analysisExpression","語言表達能力",["完全能表達","部份能表達","完全不能表達","本項不適用"]],
    ["analysisInteraction","人際互動能力",["能力良好","能力尚可","完全不能理解","本項不適用"]],
    ["analysisLeisure","休閒能力",["能自行參與","部份能參與","完全無法參與","本項不適用"]]
  ];
  out.analysisBlock=analysis.map(([n,label,opts],i)=>`(${i+1})${label} ${opts.map(x=>`${f[n]===x?"■":"□"}${x}`).join(" ")}`).join("\n");
  const lines=norm(f.serviceEvaluationSummary).split(/\n+/).map(x=>x.trim()).filter(Boolean);
  out.supportItems=lines.map((text,i)=>({text:/^\d+[.、]/.test(text)?text:`${i+1}. ${text}`}));
  return out;
}
async function downloadSemesterWord(){
  const form=$("semesterIspForm");if(!form)return;
  if(typeof window.PizZip==="undefined"||typeof window.docxtemplater==="undefined"||typeof window.saveAs==="undefined")throw new Error("Word 下載元件尚未完成載入，請重新整理頁面後再試");
  const f=serialize(form);
  const response=await fetch("./templates/semester-isp-template-v2.docx?v=2.2.0",{cache:"no-store"});
  if(!response.ok)throw new Error("無法讀取新版學期 ISP Word 母版");
  const zip=new window.PizZip(await response.arrayBuffer());
  const word=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
  word.render(semesterExportDataV2(f));
  const blob=word.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  const safe=(f.studentName||"未命名").replace(/[\\/:*?"<>|]/g,"_");
  saveAs(blob,`${safe}_${f.academicYear||""}學年度第${f.semester||""}學期_ISP.docx`);
}
function install(){
  if(installed)return;
  const form=$("semesterIspForm");if(!form||!form.elements.studentGrade||!form.elements.semester)return;
  installed=true;ensureHint();
  form.elements.studentGrade.addEventListener("change",switchTerm);
  form.elements.semester.addEventListener("change",switchTerm);
  form.addEventListener("submit",()=>{setTimeout(refreshDocs,1200);setTimeout(refreshDocs,3000);});
  document.addEventListener("click",event=>{
    if(event.target.closest?.(".open-semester-doc"))setTimeout(restoreCurrentCheckboxes,80);
  });
  document.addEventListener("click",async event=>{
    const btn=event.target.closest?.("#downloadSemesterIspBtn");if(!btn)return;
    event.preventDefault();event.stopImmediatePropagation();
    const old=btn.textContent;btn.disabled=true;btn.textContent="產生 Word 中…";
    try{await downloadSemesterWord();}catch(error){console.error(error);alert(`Word 產生失敗：${error?.message||error}`);}finally{btn.disabled=false;btn.textContent=old;}
  },true);
}

const observer=new MutationObserver(()=>install());observer.observe(document.documentElement,{childList:true,subtree:true});
onAuthStateChanged(auth,async user=>{ownerEmail=await resolveOwner(user);if(user){await refreshDocs();install();setTimeout(restoreCurrentCheckboxes,100);}});
install();
console.log("Semester ISP term storage/export fix v2.2.3 loaded");
