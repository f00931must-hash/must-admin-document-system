import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const norm=v=>String(v||"").trim();
const normName=v=>norm(v).replace(/[\s　]+/g,"");
const deptText=v=>norm(v).replace(/系$/u,"");
const gradeOrder={"一":1,"二":2,"三":3,"四":4,"五":5,"六":6,"七":7,"研一":8,"研二":9,"未設定":99,"":99};
const gradeText=n=>({1:"一",2:"二",3:"三",4:"四",5:"五",6:"六",7:"七"})[n]||"";
let ownerEmail="",docs=[];

function currentAcademicYear(){const d=new Date();return d.getFullYear()-1911-(d.getMonth()<7?1:0);}
function rocYear(value){const m=norm(value).match(/^(\d{2,4})/);if(!m)return 0;const y=Number(m[1]);return y>1911?y-1911:y;}
function gradeFromAdmission(value){const y=rocYear(value);if(!y)return "";const g=currentAcademicYear()-y+1;return g>=1&&g<=7?gradeText(g):"";}
function extractGrade(value){const s=norm(value);if(/^研[一二]/.test(s))return s.slice(0,2);return s.match(/[一二三四五六七]/)?.[0]||"";}
function classSuffix(value){return norm(value).replace(/^(?:[^一二三四五六七研]*系)?(?:研[一二]|[一二三四五六七])?/u,"").trim();}
function docGrade(d){return norm(d?.form?.studentGrade)||extractGrade(d?.form?.studentClass)||gradeFromAdmission(d?.form?.admissionDate)||"未設定";}
function docClass(d){const f=d?.form||{},grade=docGrade(d)==="未設定"?"":docGrade(d);return `${deptText(f.department)}${grade}${classSuffix(f.studentClass)}`.trim()||"未設定";}
function docDepartment(d){return norm(d?.form?.department);}
function docAcademicYear(d){
  const explicit=Number(norm(d?.form?.academicYear));
  if(explicit>0)return String(explicit);
  const m=norm(d?.form?.admissionDate).match(/^(\d{2,4})\s*[年\/.\-]\s*(\d{1,2})/);
  if(!m)return "";
  let y=Number(m[1]);if(y>=1912)y-=1911;
  const month=Number(m[2]);
  return String(month>=8?y:Math.max(0,y-1));
}

async function resolveOwner(user){
  if(!user)return "";const email=norm(user.email).toLowerCase();
  try{const s=await getDoc(doc(db,"settings","adminAccess"));const a=s.data()?.users?.[email];if(a?.enabled!==false&&a?.role==="assistant"&&a?.ownerEmail)return norm(a.ownerEmail).toLowerCase();if(a?.enabled!==false&&a)return email;}catch{}
  try{const s=await getDoc(doc(db,"administrativeAssistants",email));if(s.exists()&&s.data()?.enabled===true&&s.data()?.ownerEmail)return norm(s.data().ownerEmail).toLowerCase();}catch{}
  return email;
}
async function refreshDocs(){if(!ownerEmail)return;try{docs=await window.__adminDocumentsCache.getOwnerDocs(ownerEmail);applyAll();}catch(e){console.warn("ISP filter load failed",e);}}

function totalDocForNode(node){const name=(node.querySelector("strong")?.textContent||"").split("｜")[0].trim();const meta=node.querySelector(".doc-meta")?.textContent||"";const studentId=meta.trim().split(/\s+/)[0];return docs.find(d=>(!d.type||d.type==="ISP")&&((studentId&&norm(d.studentId)===studentId)||normName(d.studentName)===normName(name)));}
function ensureTotalFilters(){
  const head=$("mine")?.querySelector(".page-head");if(!head||$("ispClassFilter"))return;
  const wrap=document.createElement("div");wrap.className="sort-control";
  wrap.style.cssText="display:flex;gap:8px;align-items:end;flex-wrap:wrap";
  wrap.innerHTML='<label>科系篩選<select id="ispClassFilter"><option value="">全部科系</option></select></label><label>學年度篩選<select id="ispAcademicYearFilter"><option value="">全部學年度</option></select></label>';
  head.insertBefore(wrap,head.querySelector(".sort-control")||null);
  wrap.querySelectorAll("select").forEach(s=>s.addEventListener("change",applyTotalFilters));
}
function applyTotalFilters(){
  ensureTotalFilters();
  const list=$("docList");if(!list)return;
  const data=docs.filter(d=>!d.type||d.type==="ISP"),deptSel=$("ispClassFilter"),yearSel=$("ispAcademicYearFilter");
  const oldD=deptSel?.value||"",oldY=yearSel?.value||"";
  const departments=[...new Set(data.map(docDepartment).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"zh-Hant"));
  const years=[...new Set(data.map(docAcademicYear).filter(Boolean))].sort((a,b)=>Number(b)-Number(a));
  if(deptSel){
    deptSel.innerHTML=`<option value="">全部科系</option>${departments.map(x=>`<option value="${x}">${x}</option>`).join("")}`;
    if(departments.includes(oldD))deptSel.value=oldD;
  }
  if(yearSel){
    yearSel.innerHTML=`<option value="">全部學年度</option>${years.map(x=>`<option value="${x}">${x}學年度</option>`).join("")}`;
    if(years.includes(oldY))yearSel.value=oldY;
  }
  const dSel=deptSel?.value||"",ySel=yearSel?.value||"";
  [...list.children].filter(n=>n.classList.contains("doc-item")).forEach(node=>{
    const d=totalDocForNode(node);if(!d)return;
    node.dataset.filterDepartment=docDepartment(d);
    node.dataset.filterAcademicYear=docAcademicYear(d);
    node.style.display=(!dSel||node.dataset.filterDepartment===dSel)&&(!ySel||node.dataset.filterAcademicYear===ySel)?"flex":"none";
  });
}

function semesterDocFromRecordNode(node){const strong=node.querySelector("strong")?.textContent||"",name=strong.split("｜")[0].trim(),m=strong.match(/｜(.+?)學年度第(.+?)學期/),year=m?.[1]||"",sem=m?.[2]||"";return docs.find(d=>d.type==="SEMESTER_ISP"&&normName(d.studentName)===normName(name)&&String(d.form?.academicYear||"")===year&&String(d.form?.semester||"")===sem);}
function ensureSemesterFilters(){const head=$("semesterIsp")?.querySelector(".page-head");if(!head||$("semesterClassFilter"))return;const wrap=document.createElement("div");wrap.className="sort-control";wrap.style.cssText="display:flex;gap:8px;align-items:end;flex-wrap:wrap";wrap.innerHTML='<label>科系篩選<select id="semesterClassFilter"><option value="">全部科系</option></select></label><label>年級篩選<select id="semesterGradeFilter"><option value="">全部年級</option></select></label>';const sort=$("semesterIspSort")?.parentElement;head.insertBefore(wrap,sort||$("newSemesterIspListBtn"));wrap.querySelectorAll("select").forEach(s=>s.addEventListener("change",applySemesterFilters));}
function applySemesterFilters(){ensureSemesterFilters();const list=$("semesterIspList");if(!list)return;const data=docs.filter(d=>d.type==="SEMESTER_ISP"),deptSel=$("semesterClassFilter"),gradeSel=$("semesterGradeFilter"),oldD=deptSel?.value||"",oldG=gradeSel?.value||"";const departments=[...new Set(data.map(docDepartment).filter(x=>x!=="未設定"))].sort((a,b)=>a.localeCompare(b,"zh-Hant"));const grades=[...new Set(data.map(docGrade).filter(x=>x!=="未設定"))].sort((a,b)=>(gradeOrder[a]??99)-(gradeOrder[b]??99));if(deptSel){deptSel.innerHTML=`<option value="">全部科系</option>${departments.map(x=>`<option value="${x}">${x}</option>`).join("")}`;if(departments.includes(oldD))deptSel.value=oldD;}if(gradeSel){gradeSel.innerHTML=`<option value="">全部年級</option>${grades.map(x=>`<option value="${x}">${x}年級</option>`).join("")}`;if(grades.includes(oldG))gradeSel.value=oldG;}const dSel=deptSel?.value||"",g=gradeSel?.value||"";const groups=[...list.querySelectorAll(":scope > .semester-student-group")];for(const group of groups){const records=[...group.querySelectorAll(".semester-grade-records > .doc-item")],matches=[];for(const node of records){const d=semesterDocFromRecordNode(node);if(!d)continue;matches.push({node,d,dept:docDepartment(d),grade:docGrade(d)});}const ok=matches.some(x=>(!dSel||x.dept===dSel)&&(!g||x.grade===g));group.style.display=ok?"block":"none";if(ok&&g){const picker=group.querySelector(".semester-grade-picker");if(picker&&[...picker.options].some(o=>o.value===g)){picker.value=g;picker.dispatchEvent(new Event("change"));}}}
  if(!groups.length){[...list.children].filter(n=>n.classList.contains("doc-item")).forEach(node=>{const d=semesterDocFromRecordNode(node);if(!d)return;node.style.display=(!dSel||docDepartment(d)===dSel)&&(!g||docGrade(d)===g)?"flex":"none";});}}

function fieldset(title,name,options,noteLabel="說明（可視個別狀況作質性／補充說明）"){
  return `<fieldset class="official-fieldset semester-support-fieldset"><legend>${title}</legend><div class="checks">${options.map(o=>`<label><input type="checkbox" name="${name}" value="${o.value||o}">${o.label||o.value||o}</label>`).join("")}</div><label>${noteLabel}<textarea name="${name}Note" rows="3"></textarea></label></fieldset>`;
}
function ensureSemesterSupportFields(){const form=$("semesterIspForm");if(!form||$("semesterSupportFields"))return;const strategy=form.querySelector('[name="serviceEvaluationSummary"]')?.closest("label");if(!strategy)return;const box=document.createElement("div");box.id="semesterSupportFields";box.innerHTML=`<h3>特教支持服務及策略（新版）</h3>
${fieldset("學習支持","learningSupport",["無特殊學習支持需求",{value:"課業輔導（視學生主動申請或需求提供）",label:"課業輔導（視學生主動申請或需求提供）"},"筆記／同儕協助","學習輔具協助","考試調整（延長時間／獨立考場等）","課業提醒與關懷（出缺席／作業狀況）","必要時協助與任課教師溝通","其他"])}
${fieldset("情緒與人際支持","emotionalSupport",["無特殊需求","個別關懷晤談","團體輔導／主題活動參與","課業壓力與情緒支持","人際互動適應關懷","轉介心理諮商資源","其他"])}
${fieldset("生活與環境適應支持","environmentSupport",["無特殊需求","需無障礙環境調整","需生活同儕協助","作息與時間管理協助","交通費補助（無法自行上下學）","其他"])}
${fieldset("學業規劃支持","academicPlanningSupport",["畢業學分檢視與修課進度追蹤","選課諮詢與修課建議","修課負荷評估與調整建議","課程衝堂與學分風險提醒","畢業進度與延畢風險評估","必要時協助與系上溝通修課需求","其他"])}
${fieldset("生涯與轉銜支持","careerSupport",["生涯探索／討論","職涯諮詢／評估","畢業準備與轉銜規劃討論","履歷／自傳協助（修改與建議）","就業準備支持（基本面試準備／資訊提供）","個別轉銜會議","轉銜資源連結（就業中心等）"])}
${fieldset("行政與資源申請支持","adminSupport",["特教生獎助學金申請協助","校內外資源資訊提供：校內－高教深耕計畫","校內行政資源申請協助","校外資源轉介與申請協助","其他"],"說明")}
${fieldset("支持服務調整評估","supportAdjustment",["現有支持適切，持續維持","需調整部分支持內容","需新增或加強支持服務","需減少或結束部分支持","其他"],"說明")}`;
  strategy.parentNode.insertBefore(box,strategy);
}

function ensureClassHints(){
  document.querySelectorAll('#ispForm input[name="studentClass"]').forEach(input=>{
    const label=input.closest("label");if(!label||label.querySelector(".student-class-example"))return;
    const hint=document.createElement("small");hint.className="student-class-example";hint.textContent="例如：機械一甲";hint.style.cssText="display:block;margin-top:6px;color:#8a94a6;font-size:12px;font-weight:400";label.appendChild(hint);
  });
}

function applyAll(){ensureSemesterSupportFields();ensureClassHints();ensureTotalFilters();ensureSemesterFilters();applyTotalFilters();applySemesterFilters();}
const totalObserver=$("docList")?new MutationObserver(()=>setTimeout(applyTotalFilters,50)):null;totalObserver?.observe($("docList"),{childList:true,subtree:true});
const semesterObserver=$("semesterIspList")?new MutationObserver(()=>setTimeout(applySemesterFilters,80)):null;semesterObserver?.observe($("semesterIspList"),{childList:true,subtree:true});
ensureSemesterSupportFields();ensureClassHints();ensureTotalFilters();ensureSemesterFilters();
onAuthStateChanged(auth,async user=>{ownerEmail=await resolveOwner(user);if(user)await refreshDocs();});
console.log("ISP UI filters/support v2.1.1 loaded");
