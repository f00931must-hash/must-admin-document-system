import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const AI_ENDPOINT="https://must-isp-ai-697793258377.asia-east1.run.app/ai/isp-summary";
const $=id=>document.getElementById(id),norm=v=>String(v??"").trim(),normName=v=>norm(v).replace(/[\\s　]+/g,"");
function serialize(form){const data={};for(const el of form?.elements||[]){if(!el.name||["button","submit"].includes(el.type))continue;if(el.type==="checkbox"){if(!data[el.name])data[el.name]=[];if(el.checked)data[el.name].push(el.value);}else if(el.type==="radio"){if(el.checked)data[el.name]=el.value;else if(!(el.name in data))data[el.name]="";}else data[el.name]=el.value;}return data;}
async function ownerEmail(){const user=auth.currentUser;if(!user?.email)return "";const email=norm(user.email).toLowerCase();try{const s=await getDoc(doc(db,"settings","adminAccess")),a=s.data()?.users?.[email];if(a?.enabled!==false&&a?.role==="assistant"&&a?.ownerEmail)return norm(a.ownerEmail).toLowerCase();if(a?.enabled!==false&&a)return email;}catch{}try{const s=await getDoc(doc(db,"administrativeAssistants",email));if(s.exists()&&s.data()?.enabled===true&&s.data()?.ownerEmail)return norm(s.data().ownerEmail).toLowerCase();}catch{}return email;}
async function baseIsp(name,department){const owner=await ownerEmail();if(!owner||!name)return null;const all=await window.__adminDocumentsCache.getOwnerDocs(owner),dept=norm(department).replace(/系$/u,"");const list=all.filter(x=>(!x.type||x.type==="ISP")&&normName(x.studentName||x.form?.studentName)===normName(name));return list.find(x=>norm(x.form?.department).replace(/系$/u,"")===dept)||list[0]||null;}
const labels={disabilityType:"障別",disabilityFeatures:"障礙特徵（新生 ISP 背景資料）",abilityHealth:"健康狀況",abilitySensory:"感官功能",abilityMotor:"知覺動作",abilityCognitive:"認知能力",abilityCommunication:"溝通能力",abilityAcademic:"學業能力",abilitySelfCare:"生活自理能力",abilitySocialEmotional:"社會化及情緒行為能力",courseCredits:"修課學分",studentNeedsAssessment:"學生需求評估",learningSupport:"學習支持",emotionalSupport:"情緒與人際支持",environmentSupport:"生活與環境適應支持",academicPlanningSupport:"學業規劃支持",careerSupport:"生涯與轉銜支持",adminSupport:"行政與資源申請支持",supportAdjustment:"支持服務調整評估"};
const statusFields=["disabilityType","disabilityFeatures","abilityHealth","abilitySensory","abilityMotor","abilityCognitive","abilityCommunication","abilityAcademic","abilitySelfCare","abilitySocialEmotional","courseCredits","studentNeedsAssessment"];
const strategyFields=["learningSupport","learningSupportNote","emotionalSupport","emotionalSupportNote","environmentSupport","environmentSupportNote","academicPlanningSupport","academicPlanningSupportNote","careerSupport","careerSupportNote","adminSupport","adminSupportNote","supportAdjustment","supportAdjustmentNote"];
function source(form,fields,values=null){const f=values||serialize(form);return fields.map(name=>{const v=name==="supportAdjustment"?(Array.isArray(f[name])?f[name]:norm(f[name]).split(/[、\n]/)).filter(item=>norm(item)!=="現有支持適切，持續維持"):f[name],t=Array.isArray(v)?v.filter(Boolean).join("、"):norm(v);return t?((name.endsWith("Note")?(labels[name.slice(0,-4)]||name.slice(0,-4))+"補充說明":labels[name]||name)+"："+t):"";}).filter(Boolean).join("\n");}
function stripListPrefix(value){let out=String(value||"").trim(),prev="";while(out&&out!==prev){prev=out;out=out.replace(/^\s*(?:[-•●▪◆]|(?:\d+|[一二三四五六七八九十]+)[.、）])\s*/,"").trim();}return out;}
function cleanFive(text){const raw=norm(text);let lines=raw.split(/\n+/).map(stripListPrefix).filter(Boolean);return lines.slice(0,5).map((x,i)=>(i+1)+". "+x).join("\n");}
async function ask(src,kind){const instruction=kind==="status"?"請依據下方學生的障別、個別特質與實際能力資料，整理任課老師在課堂上需要知道的障礙現況，最多 5 點。重點是這位學生實際的學習、理解、記憶、注意力、表達、人際互動、情緒或課堂參與情形；依個別資料選擇相關面向，不要逐欄摘要或按障別套用所有常見特徵。障別可協助理解資料，但不能據此斷言學生具有未記載的症狀或困難。健康、感官、生活自理等資訊只有在實際影響上課、實作、出席或安全時才寫；健康正常、感官正常、自理正常等無關資訊直接省略。例如學習障礙學生若重點是閱讀理解與記憶較弱，就整理這些學習特質，不為湊點數寫健康正常。保留能幫助老師教學的優勢，例如實作較佳或對特定內容有興趣。以自然、尊重學生、具體簡短的語氣描述，避免標籤化用語與空泛贅述。以目前表單記載為準，不將新生時的資料當成本學期新發生的狀況。只整理有依據且與課堂相關的重點，相關內容合併，有幾項就寫幾點，不強制湊足 5 點。每點獨立一行，只輸出列點，不要標題。":"請綜合下方學生的障別、實際特質、能力現況、學習困難、需求評估與已規劃的支持服務，撰寫最多 5 點給任課老師的具體支持建議，不限於特教支持服務及策略的勾選項目，也不要逐字抄寫。先理解這位學生在課堂上可能需要的協助，再將其個別特質連結到可行的教學方式；障別作為理解背景，實際個別資料優先，不要因障別而假定學生具有所有常見症狀。允許依據已記載的特質提出相應的課堂協助建議，即使未勾選該項策略；用建議語氣，勿把建議寫成已核定或已安排的服務。例如已記載記憶較弱，可建議將重點分段說明並適時提醒；理論課較難專注但實作較佳，可建議搭配示範或實作引導；較少主動表達困難，可建議老師適時主動關心學習情形。範例只供理解推理方式，不得套用到沒有相關特質的學生。若資料只有障別而無具體特質，可針對該障別提出保守、可調整的教學建議，使用「可視學生實際需要」等措辭，不新增學生事實。考試延長、成績調整、正式課輔、助理人員等服務不可自行宣告核定或承諾，需依已記載安排或寫為評估建議。保留具體科目、已安排的服務與老師或資源教室的分工；目前學期記載優先於新生背景。語氣應像老師依學生情況交代需要的協助，自然、尊重、簡短，有實際內容，不靠固定客套話製造溫度。每點簡短說明需要與協助方式，不加「以維護學生權益」等空泛目的。支持服務調整評估若只是「現有支持適切，持續維持」，不寫入摘要，也不另列維持現有支持；有具體調整才整理。重複建議合併，不為湊點數新增無關內容，有幾項相關重點就寫幾點，最多 5 點。每點獨立一行，只輸出列點，不要標題。";const r=await fetch(AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:instruction+"\n\n【"+(kind==="status"?"目前學期能力資料與學生障別背景":"學生個別特質、本學期能力現況、需求與支持安排")+"】\n"+src,mode:"summary",section:kind==="status"?"學期 ISP－任課老師摘要－障礙現況":"學期 ISP－任課老師摘要－特教支持服務及策略",forceRewrite:true,documentType:"SEMESTER_ISP"})});let p={};try{p=await r.json();}catch{}if(!r.ok)throw new Error(p?.error||p?.message||("AI 服務暫時無法使用（"+r.status+"）"));const out=cleanFive(p?.polished||p?.result||p?.text||p?.summary||"");if(!out)throw new Error("AI 沒有回傳可用內容");return out;}
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
  const context={...f,disabilityType:f.disabilityType||base?.form?.disabilityType||base?.form?.certificateCategory||"",disabilityFeatures:f.disabilityFeatures||base?.form?.disabilityFeatures||""};
  const ss=source(form,statusFields,context),ts=source(form,[...new Set([...statusFields,...strategyFields])],context);
  if(!ss&&!ts){alert("目前這份學期 ISP 尚無足夠資料可供統整。");return;}
  const b=force?$("regenerateSemesterTeacherSummaryBtn"):$("generateSemesterTeacherSummaryBtn"),old=b?.textContent||"";
  if(b){b.disabled=true;b.textContent="AI 統整中…";}
  try{
    const result=await Promise.all([ask(ss||ts,"status"),ts?ask(ts,"strategies"):Promise.resolve("")]);
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
    if(statusItems.length<1||statusItems.length>5)throw new Error("障礙現況請填寫 1～5 點，請確認列點內容");
    if(strategyItems.length<1||strategyItems.length>5)throw new Error("特教支持服務及策略請填寫 1～5 點，請確認列點內容");
    const data={
      department:norm(summary?.department),studentClass:norm(summary?.studentClass),studentName:norm(summary?.studentName),
      disabilityType:norm(summary?.disabilityType),advisorName:norm(summary?.advisorName).replace(/老師$/,""),
      counselorName,counselorExtension
    };
    for(let i=1;i<=5;i++)data["status"+i]=statusItems[i-1]?[{text:statusItems[i-1]}]:[];
    for(let i=1;i<=5;i++)data["strategy"+i]=strategyItems[i-1]?[{text:strategyItems[i-1]}]:[];
    docx.render(data);
    const blob=docx.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),safe=(data.studentName||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    window.saveAs(blob,safe+"_任課老師ISP摘要.docx");
  }catch(e){console.error(e);alert("Word 產生失敗："+(e?.message||e));}
}
async function download(){return downloadSummaryData(getSummaryData());}
$("semesterBackToTopBtn")?.addEventListener("click",()=>{
  const target=$("semesterTermNavigator")||$("semesterIspEditor")||$("semesterIspForm");
  target?.scrollIntoView({behavior:"smooth",block:"start"});
});
$("generateSemesterTeacherSummaryBtn")?.addEventListener("click",()=>generate({force:false}));$("regenerateSemesterTeacherSummaryBtn")?.addEventListener("click",()=>generate({force:true}));$("downloadSemesterTeacherSummaryBtn")?.addEventListener("click",download);window.__semesterTeacherSummary={getData:getSummaryData,load:loadSummary,clear:clearSummary,downloadData:downloadSummaryData};console.log("Semester teacher ISP summary v1.3.2 loaded");
