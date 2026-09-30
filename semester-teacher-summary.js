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
async function ask(src,kind){const instruction=kind==="status"?"請依據下方學生的障別、個別特質與實際能力資料，整理任課老師在課堂上需要知道的障礙現況，最多 5 點。重點是這位學生實際的學習、理解、記憶、注意力、表達、人際互動、情緒或課堂參與情形；依個別資料選擇相關面向，不要逐欄摘要或按障別套用所有常見特徵。障別可協助理解資料，但不能據此斷言學生具有未記載的症狀或困難。健康、感官、生活自理等資訊只有在實際影響上課、實作、出席或安全時才寫；健康正常、感官正常、自理正常等無關資訊直接省略。例如學習障礙學生若重點是閱讀理解與記憶較弱，就整理這些學習特質，不為湊點數寫健康正常。保留能幫助老師教學的優勢，例如實作較佳或對特定內容有興趣。以自然、尊重學生、具體簡短的語氣描述，避免標籤化用語與空泛贅述。以目前表單記載為準，不將新生時的資料當成本學期新發生的狀況。只整理有依據且與課堂相關的重點，相關內容合併，有幾項就寫幾點，不強制湊足 5 點。每點獨立一行，只輸出列點，不要標題。":"請以資源教室輔導老師撰寫任課老師通知的角度，依下方學生需求評估、實際需要、支持安排及補充說明，整理簡要的特教支持服務及策略。障別及障礙特徵僅作理解需求的背景，不重述障礙現況，不列出能力缺點，也不按障別套用一般策略清單。每點直接寫老師需要留意、配合或協助的重點；把相關需要合併成可執行的一項建議，不逐項照抄勾選內容。優先寫具體科目、學生提出的困難、已規劃的協助與需老師配合的事項。例如需求說明提到微積分課輔，就寫「微積分學習需較多協助，請老師評估課輔需求。」已安排課輔時則依原安排說明老師需配合什麼。可依實際需要提出合理的教學建議，但不能新增未記載的學生困難，或宣告尚未核定的考試調整、助理人員等服務。沒有具體特殊需求時可簡要交代關注學習或必要時反映需求，不補上無根據的服務。使用自然、尊重學生的語氣，重點在掌握個別需要，不靠客套話或長篇解釋。每點以一句短句為主，約 20～45 字，不重複描述學生現況、解釋策略原理或加入空泛目的；有幾項重點就寫幾點，最多 5 點。支持服務調整評估中的「現有支持適切，持續維持」省略。不要附加聯絡人、分機、署名或「若有疑問請聯繫」的結尾段落，這些由文件署名提供。每點獨立一行，只輸出列點，不要標題。";const r=await fetch(AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:instruction+"\n\n【"+(kind==="status"?"目前學期能力資料與學生障別背景":"學生本學期需求評估、個別需要與支持安排")+"】\n"+src,mode:"summary",section:kind==="status"?"學期 ISP－任課老師摘要－障礙現況":"學期 ISP－任課老師摘要－特教支持服務及策略",forceRewrite:true,documentType:"SEMESTER_ISP"})});let p={};try{p=await r.json();}catch{}if(!r.ok)throw new Error(p?.error||p?.message||("AI 服務暫時無法使用（"+r.status+"）"));const out=cleanFive(p?.polished||p?.result||p?.text||p?.summary||"");if(!out)throw new Error("AI 沒有回傳可用內容");return out;}
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
  const hasAny=[status,strategies,norm($("semesterTeacherSummaryDepartment")?.value),norm($("semesterTeacherSummaryClass")?.value),norm($("semesterTeacherSummaryAdvisor")?.value),norm($("semesterTeacherSummaryCounselor")?.value),norm($("semesterTeacherSummaryExtension")?.value)].some(Boolean);
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
  $("semesterTeacherSummaryAdvisor").value=existing?.advisorName||f.advisorName||base?.form?.advisorName||"";
  $("semesterTeacherSummaryCounselor").value=existing?.counselorName||f.counselorName||base?.form?.counselorName||"";
  $("semesterTeacherSummaryExtension").value=existing?.counselorExtension||f.counselorExtension||base?.form?.counselorExtension||"";
  panel.classList.remove("hidden");panel.scrollIntoView({behavior:"smooth",block:"start"});
  const context={...f,disabilityType:f.disabilityType||base?.form?.disabilityType||base?.form?.certificateCategory||"",disabilityFeatures:f.disabilityFeatures||base?.form?.disabilityFeatures||""};
  const ss=source(form,statusFields,context),ts=source(form,["disabilityType","disabilityFeatures","studentNeedsAssessment",...strategyFields],context);
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
function prepareTeacherSummaryTemplate(zip,summary){
  const path="word/document.xml",xml=zip.file(path)?.asText();if(!xml)return;
  const itemCount=text=>String(text||"").split(/\n+/).map(line=>line.replace(/^\s*(?:[-•●▪◆]|(?:\d+|[一二三四五六七八九十]+)[.、）)])\s*/,"").trim()).filter(Boolean).length;
  const counts={status:itemCount(summary?.status),strategy:itemCount(summary?.strategies)};
  const ns="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const documentXml=new DOMParser().parseFromString(xml,"application/xml");
  for(const paragraph of Array.from(documentXml.getElementsByTagNameNS(ns,"p"))){
    const text=Array.from(paragraph.getElementsByTagNameNS(ns,"t")).map(node=>node.textContent).join("");
    const slot=text.match(/\{#(status|strategy)([1-5])\}/);
    if((slot&&Number(slot[2])>counts[slot[1]])||text.startsWith("若對學生狀況有任何疑問，請隨時與我聯繫"))paragraph.remove();
  }
  zip.file(path,new XMLSerializer().serializeToString(documentXml));
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
    const zip=new window.PizZip(await res.arrayBuffer());
    prepareTeacherSummaryTemplate(zip,summary);
    const docx=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
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

let teacherContactSaveQueue=Promise.resolve();
for(const id of ["semesterTeacherSummaryAdvisor","semesterTeacherSummaryCounselor","semesterTeacherSummaryExtension"]){
  $(id)?.addEventListener("change",()=>{teacherContactSaveQueue=teacherContactSaveQueue.then(()=>persistSummaryNow()).then(ok=>{if(!ok)alert("摘要欄位儲存失敗，請按儲存學期 ISP 再試。");});});
}
