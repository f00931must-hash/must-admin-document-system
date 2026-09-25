import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const AI_ENDPOINT="https://must-isp-ai-697793258377.asia-east1.run.app/ai/isp-summary";
const $=id=>document.getElementById(id),norm=v=>String(v??"").trim(),normName=v=>norm(v).replace(/[\\s　]+/g,"");
function serialize(form){const data={};for(const el of form?.elements||[]){if(!el.name||["button","submit"].includes(el.type))continue;if(el.type==="checkbox"){if(!data[el.name])data[el.name]=[];if(el.checked)data[el.name].push(el.value);}else if(el.type==="radio"){if(el.checked)data[el.name]=el.value;else if(!(el.name in data))data[el.name]="";}else data[el.name]=el.value;}return data;}
async function ownerEmail(){const user=auth.currentUser;if(!user?.email)return "";const email=norm(user.email).toLowerCase();try{const s=await getDoc(doc(db,"settings","adminAccess")),a=s.data()?.users?.[email];if(a?.enabled!==false&&a?.role==="assistant"&&a?.ownerEmail)return norm(a.ownerEmail).toLowerCase();if(a?.enabled!==false&&a)return email;}catch{}try{const s=await getDoc(doc(db,"administrativeAssistants",email));if(s.exists()&&s.data()?.enabled===true&&s.data()?.ownerEmail)return norm(s.data().ownerEmail).toLowerCase();}catch{}return email;}
async function baseIsp(name,department){const owner=await ownerEmail();if(!owner||!name)return null;const all=await window.__adminDocumentsCache.getOwnerDocs(owner),dept=norm(department).replace(/系$/u,"");const list=all.filter(x=>(!x.type||x.type==="ISP")&&normName(x.studentName||x.form?.studentName)===normName(name));return list.find(x=>norm(x.form?.department).replace(/系$/u,"")===dept)||list[0]||null;}
const labels={abilityHealth:"健康狀況",abilitySensory:"感官功能",abilityMotor:"知覺動作",abilityCognitive:"認知能力",abilityCommunication:"溝通能力",abilityAcademic:"學業能力",abilitySelfCare:"生活自理能力",abilitySocialEmotional:"社會化及情緒行為能力",courseCredits:"修課學分",studentNeedsAssessment:"學生需求評估",serviceEvaluationSummary:"特教支持服務及策略",learningSupport:"學習支持",emotionalSupport:"情緒與人際支持",environmentSupport:"生活與環境適應支持",academicPlanningSupport:"學業規劃支持",careerSupport:"生涯與轉銜支持",adminSupport:"行政與資源申請支持",supportAdjustment:"支持服務調整評估"};
const statusFields=["abilityHealth","abilitySensory","abilityMotor","abilityCognitive","abilityCommunication","abilityAcademic","abilitySelfCare","abilitySocialEmotional","courseCredits","studentNeedsAssessment"];
const strategyFields=[...statusFields,"serviceEvaluationSummary","learningSupport","learningSupportNote","emotionalSupport","emotionalSupportNote","environmentSupport","environmentSupportNote","academicPlanningSupport","academicPlanningSupportNote","careerSupport","careerSupportNote","adminSupport","adminSupportNote","supportAdjustment","supportAdjustmentNote"];
function source(form,fields){const f=serialize(form);return fields.map(name=>{const v=f[name],t=Array.isArray(v)?v.filter(Boolean).join("、"):norm(v);return t?((labels[name]||name)+"："+t):"";}).filter(Boolean).join("\\n");}
function stripListPrefix(value){let out=String(value||"").trim(),prev="";while(out&&out!==prev){prev=out;out=out.replace(/^\s*(?:[-•●▪◆]|(?:\d+|[一二三四五六七八九十]+)[.、）])\s*/,"").trim();}return out;}
function cleanFive(text){const raw=norm(text);let lines=raw.split(/\n+/).map(stripListPrefix).filter(Boolean);if(lines.length<2)lines=raw.split(/[。；]\s*/).map(stripListPrefix).filter(Boolean).map(x=>/[。！？]$/.test(x)?x:x+"。");return lines.slice(0,5).map((x,i)=>(i+1)+". "+x).join("\n");}
async function ask(src,kind){const instruction=kind==="status"?"請依據以下本學期 ISP 資料，統整任課老師需要知道的學生目前能力與障礙相關現況。請去除重複資訊，使用正式、客觀、具體的繁體中文，列出最重要的 5 點；不可新增資料中沒有的診斷、能力、需求、原因或風險。只輸出 5 點，不要標題。":"請依據以下本學期 ISP 資料，統整任課老師在課程中可採取的特教支持服務及策略。請將本學期勾選與文字內容整合成具體、可執行建議，避免只重複勾選文字；只列真正有依據且必要的 5 點，不可虛構。只輸出 5 點，不要標題。";const r=await fetch(AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:instruction+"\\n\\n【僅限目前學期 ISP 表單資料】\\n"+src,mode:"summary",section:kind==="status"?"學期 ISP－任課老師摘要－障礙現況":"學期 ISP－任課老師摘要－特教支持服務及策略",forceRewrite:true,documentType:"SEMESTER_ISP"})});let p={};try{p=await r.json();}catch{}if(!r.ok)throw new Error(p?.error||p?.message||("AI 服務暫時無法使用（"+r.status+"）"));const out=cleanFive(p?.polished||p?.result||p?.text||p?.summary||"");if(!out)throw new Error("AI 沒有回傳可用內容");return out;}
function teacherClassDisplay(department,studentClass){
  const dept=norm(department).replace(/系$/u,""),cls=norm(studentClass);
  if(!dept)return cls;
  if(!cls)return dept;
  return cls.startsWith(dept)?cls:dept+cls;
}
function setMainButtonState(hasSummary){
  const button=$("generateSemesterTeacherSummaryBtn");if(!button)return;
  button.dataset.hasSummary=hasSummary?"1":"0";
  button.textContent=hasSummary?"查看任師摘要":"產生任課老師 ISP 摘要";
}
function clearSummary(){
  for(const id of ["semesterTeacherSummaryDepartment","semesterTeacherSummaryClass","semesterTeacherSummaryStudentName","semesterTeacherSummaryDisability","semesterTeacherSummaryAdvisor","semesterTeacherSummaryCounselor","semesterTeacherSummaryExtension","semesterTeacherSummaryStatus","semesterTeacherSummaryStrategies"]){
    const el=$(id);if(el)el.value="";
  }
  $("semesterTeacherIspSummaryPanel")?.classList.add("hidden");
  setMainButtonState(false);
}
function getSummaryData(){
  const status=norm($("semesterTeacherSummaryStatus")?.value),strategies=norm($("semesterTeacherSummaryStrategies")?.value);
  const hasAny=[status,strategies,norm($("semesterTeacherSummaryDepartment")?.value),norm($("semesterTeacherSummaryClass")?.value)].some(Boolean);
  if(!hasAny)return null;
  return {
    department:norm($("semesterTeacherSummaryDepartment")?.value),
    studentClass:norm($("semesterTeacherSummaryClass")?.value),
    studentName:norm($("semesterTeacherSummaryStudentName")?.value),
    disabilityType:norm($("semesterTeacherSummaryDisability")?.value),
    advisorName:norm($("semesterTeacherSummaryAdvisor")?.value),
    counselorName:norm($("semesterTeacherSummaryCounselor")?.value),
    counselorExtension:norm($("semesterTeacherSummaryExtension")?.value),
    status,strategies
  };
}
function loadSummary(data){
  clearSummary();
  if(!data)return;
  $("semesterTeacherSummaryDepartment").value=data.department||"";
  $("semesterTeacherSummaryClass").value=data.studentClass||"";
  $("semesterTeacherSummaryStudentName").value=data.studentName||"";
  $("semesterTeacherSummaryDisability").value=data.disabilityType||"";
  $("semesterTeacherSummaryAdvisor").value=data.advisorName||"";
  $("semesterTeacherSummaryCounselor").value=data.counselorName||"";
  $("semesterTeacherSummaryExtension").value=data.counselorExtension||"";
  $("semesterTeacherSummaryStatus").value=data.status||"";
  $("semesterTeacherSummaryStrategies").value=data.strategies||"";
  const ready=!!(data.status&&data.strategies);
  setMainButtonState(ready);
  if(ready)$("semesterTeacherIspSummaryPanel")?.classList.remove("hidden");
}
async function persistSummaryNow(){
  const form=$("semesterIspForm"),data=getSummaryData();if(!form||!data)return;
  const id=$("semesterDocId")?.value;
  if(id){
    try{
      await updateDoc(doc(db,"adminDocuments",id),{teacherSummary:data,updatedAt:serverTimestamp()});
      const owner=await ownerEmail();window.__adminDocumentsCache?.invalidate?.(owner);
      return true;
    }catch(error){console.warn("teacher summary immediate save failed",error);return false;}
  }
  // 尚未建立學期文件時，直接走既有「儲存學期 ISP」流程，讓摘要與表單一起建立。
  try{form.requestSubmit();return true;}catch(error){console.warn("teacher summary new document save failed",error);return false;}
}

async function generate({force=false}={}){
  const form=$("semesterIspForm"),panel=$("semesterTeacherIspSummaryPanel");if(!form||!panel)return;
  const existing=getSummaryData();
  if(existing?.status&&existing?.strategies&&!force){
    panel.classList.remove("hidden");
    setMainButtonState(true);
    panel.scrollIntoView({behavior:"smooth",block:"start"});
    return;
  }
  const f=serialize(form),base=await baseIsp(f.studentName,f.department);
  $("semesterTeacherSummaryDepartment").value=f.department||"";
  $("semesterTeacherSummaryClass").value=teacherClassDisplay(f.department,f.studentClass);
  $("semesterTeacherSummaryStudentName").value=f.studentName||"";
  $("semesterTeacherSummaryDisability").value=f.disabilityType||base?.form?.disabilityType||base?.form?.certificateCategory||"";
  $("semesterTeacherSummaryAdvisor").value=base?.form?.advisorName||"";
  $("semesterTeacherSummaryCounselor").value=base?.form?.counselorName||"";
  $("semesterTeacherSummaryExtension").value=base?.form?.counselorExtension||"";
  panel.classList.remove("hidden");panel.scrollIntoView({behavior:"smooth",block:"start"});
  const ss=source(form,statusFields),ts=source(form,strategyFields);
  if(!ss&&!ts){alert("目前這份學期 ISP 尚無足夠資料可供統整。");return;}
  const b=force?$("regenerateSemesterTeacherSummaryBtn"):$("generateSemesterTeacherSummaryBtn"),old=b?.textContent||"";
  if(b){b.disabled=true;b.textContent="AI 統整中…";}
  try{
    const result=await Promise.all([ask(ss||ts,"status"),ask(ts||ss,"strategies")]);
    $("semesterTeacherSummaryStatus").value=result[0];
    $("semesterTeacherSummaryStrategies").value=result[1];
    setMainButtonState(true);
    await persistSummaryNow();
  }catch(e){console.error(e);alert(e?.message||"任課老師 ISP 摘要產生失敗，請稍後再試。");}
  finally{if(b){b.disabled=false;b.textContent=old;}}
}
async function downloadSummaryData(summary){
  try{
    const status=norm(summary?.status),strategies=norm(summary?.strategies);
    if(!status||!strategies)throw new Error("這份學期 ISP 尚未產生任課老師摘要");
    const counselorName=norm(summary?.counselorName).replace(/老師$/,""),counselorExtension=norm(summary?.counselorExtension);
    if(!counselorName||!counselorExtension)throw new Error("任課老師摘要尚缺輔導老師姓名或分機");
    if(typeof window.PizZip==="undefined"||typeof window.docxtemplater==="undefined"||typeof window.saveAs==="undefined")throw new Error("Word 下載元件尚未完成載入，請重新整理頁面後再試");
    const res=await fetch("./templates/teacher-isp-summary-template.docx?v=1.5.1",{cache:"no-store"});
    if(!res.ok)throw new Error("無法讀取任課老師 ISP 摘要 Word 母版");
    const zip=new window.PizZip(await res.arrayBuffer()),docx=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
    const itemLines=text=>text.split(/\n+/).map(stripListPrefix).filter(Boolean),statusItems=itemLines(status),strategyItems=itemLines(strategies);
    if(statusItems.length!==5||strategyItems.length!==5)throw new Error("障礙現況與支持策略都必須各有 5 點，請確認列點內容");
    const data={
      department:norm(summary?.department),studentClass:norm(summary?.studentClass),studentName:norm(summary?.studentName),
      disabilityType:norm(summary?.disabilityType),advisorName:norm(summary?.advisorName).replace(/老師$/,""),
      counselorName,counselorExtension
    };
    for(let i=1;i<=5;i++)data["status"+i]=[{text:statusItems[i-1]}];
    for(let i=1;i<=5;i++)data["strategy"+i]=[{text:strategyItems[i-1]}];
    docx.render(data);
    const blob=docx.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),safe=(data.studentName||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    window.saveAs(blob,safe+"_任課老師ISP摘要.docx");
  }catch(e){console.error(e);alert("Word 產生失敗："+(e?.message||e));}
}
async function download(){return downloadSummaryData(getSummaryData());}
$("generateSemesterTeacherSummaryBtn")?.addEventListener("click",()=>generate({force:false}));$("regenerateSemesterTeacherSummaryBtn")?.addEventListener("click",()=>generate({force:true}));$("downloadSemesterTeacherSummaryBtn")?.addEventListener("click",download);window.__semesterTeacherSummary={getData:getSummaryData,load:loadSummary,clear:clearSummary,downloadData:downloadSummaryData};console.log("Semester teacher ISP summary v1.3.0 loaded");
