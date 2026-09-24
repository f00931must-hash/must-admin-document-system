import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, query, where, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const norm=v=>String(v??"").trim();
const normName=v=>norm(v).replace(/[\s　]+/g,"");
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
function applySupports(form,data){
  for(const name of Object.keys(supportConfig)){
    const values=Array.isArray(data?.[name])?data[name]:[];
    form.querySelectorAll(`input[type="checkbox"][name="${name}"]`).forEach(cb=>cb.checked=values.includes(cb.value));
    const note=form.elements[`${name}Note`];if(note)note.value=norm(data?.[`${name}Note`]);
  }
}
async function liveTermDoc(form){
  const f=serialize(form),user=auth.currentUser;if(!user)return null;
  const email=norm(user.email).toLowerCase();
  let owner=email;
  try{
    const s=await getDoc(doc(db,"settings","adminAccess"));const a=s.data()?.users?.[email];
    if(a?.enabled!==false&&a?.role==="assistant"&&a?.ownerEmail)owner=norm(a.ownerEmail).toLowerCase();
  }catch{}
  const snap=await getDocs(query(collection(db,"adminDocuments"),where("ownerEmail","==",owner)));
  const grade=norm(f.studentGrade),sem=norm(f.semester),name=normName(f.studentName),dept=norm(f.department);
  const docs=snap.docs.map(x=>({id:x.id,...x.data()})).filter(x=>x.type==="SEMESTER_ISP"&&normName(x.studentName)===name&&norm(x.form?.department)===dept&&norm(x.form?.studentGrade)===grade&&String(x.form?.semester||"")===sem);
  docs.sort((a,b)=>(b.updatedAt?.seconds||b.createdAt?.seconds||0)-(a.updatedAt?.seconds||a.createdAt?.seconds||0));
  return docs[0]||null;
}
async function switchTermLive(event){
  const form=$("semesterIspForm");if(!form)return;
  event.stopImmediatePropagation();
  const keep=serialize(form),grade=norm(form.elements.studentGrade?.value),sem=norm(form.elements.semester?.value);
  if(!keep.studentName||!grade||!sem)return;
  const hit=await liveTermDoc(form);
  if(hit){
    $("semesterDocId").value=hit.id;
    for(const el of form.elements){
      if(!el.name||el.type==="checkbox")continue;
      const v=hit.form?.[el.name];
      if(el.type==="radio")el.checked=v===el.value;
      else if(v!==undefined&&v!==null)el.value=v;
    }
    applySupports(form,hit.form||{});
  }else{
    const basic={studentName:keep.studentName,department:keep.department,studentClass:keep.studentClass,disabilityType:keep.disabilityType,disabilityLevel:keep.disabilityLevel,academicYear:keep.academicYear,studentGrade:grade,semester:sem};
    form.reset();$("semesterDocId").value="";
    Object.entries(basic).forEach(([k,v])=>{if(form.elements[k])form.elements[k].value=v||"";});
    applySupports(form,{});
  }
}
function supportSnapshot(form){
  const f=serialize(form),out={};
  for(const name of Object.keys(supportConfig)){
    out[name]=Array.isArray(f[name])?f[name]:[];
    out[`${name}Note`]=norm(f[`${name}Note`]);
  }
  return out;
}
async function persistExactSupports(snapshot){
  const id=$("semesterDocId")?.value;if(!id)return;
  const patch={};
  for(const [k,v] of Object.entries(snapshot))patch[`form.${k}`]=v;
  try{await updateDoc(doc(db,"adminDocuments",id),patch);}catch(e){console.warn("semester support exact save failed",e);}
}
function patchStaticCheckboxes(zip,selectedByName){
  const f=zip.file("word/document.xml");if(!f)return;
  const xml=new DOMParser().parseFromString(f.asText(),"application/xml");
  const textNodes=[...xml.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main","t")];
  const compact=s=>String(s||"").replace(/[\s　]/g,"");
  for(const [name,options] of Object.entries(supportConfig)){
    const selected=new Set(selectedByName[name]||[]);
    for(const option of options){
      const target=compact(option);let idx=-1;
      for(let i=0;i<textNodes.length;i++){if(compact(textNodes[i].textContent).includes(target)){idx=i;break;}}
      if(idx<0)continue;
      const mark=selected.has(option)?"■":"□";
      const node=textNodes[idx];
      if(/[□■]/.test(node.textContent))node.textContent=node.textContent.replace(/[□■]/,mark);
      else{
        for(let j=idx-1;j>=Math.max(0,idx-4);j--){
          if(/[□■]/.test(textNodes[j].textContent)){textNodes[j].textContent=textNodes[j].textContent.replace(/([□■])(?!.*[□■])/,mark);break;}
        }
      }
    }
  }
  zip.file("word/document.xml",new XMLSerializer().serializeToString(xml));
}
async function downloadFixed(event){
  const btn=event.target.closest?.("#downloadSemesterIspBtn");if(!btn)return;
  event.preventDefault();event.stopImmediatePropagation();
  const form=$("semesterIspForm");
  if(!form||!window.PizZip||!window.docxtemplater||!window.saveAs)return alert("Word 下載元件尚未完成載入，請重新整理後再試");
  const f=serialize(form),old=btn.textContent;btn.disabled=true;btn.textContent="產生新版 Word 中…";
  try{
    const response=await fetch("./templates/semester-isp-template-v2.docx?v=2.3.0",{cache:"no-store"});
    if(!response.ok)throw new Error("無法讀取新版學期 ISP Word 母版");
    const zip=new window.PizZip(await response.arrayBuffer());
    const word=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
    const data={...f};
    for(const [name,options] of Object.entries(supportConfig)){
      const values=Array.isArray(f[name])?f[name]:[];
      const checks=options.map(o=>`${values.includes(o)?"■":"□"}${o}`).join("\n");
      data[`${name}Checks`]=checks;data[`${name}Block`]=`${checks}\n說明：${norm(f[`${name}Note`])}`;data[`${name}Text`]=data[`${name}Block`];
    }
    word.render(data);
    patchStaticCheckboxes(word.getZip(),f);
    const blob=word.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    const safe=(f.studentName||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    saveAs(blob,`${safe}_${f.academicYear||""}學年度第${f.semester||""}學期_ISP.docx`);
  }catch(e){console.error(e);alert(`Word 產生失敗：${e.message||e}`);}finally{btn.disabled=false;btn.textContent=old;}
}
function install(){
  const form=$("semesterIspForm");if(!form||form.dataset.checkboxFix23)return;form.dataset.checkboxFix23="1";
  // 唯一的年級／學期切換主流程。
  form.elements.studentGrade?.addEventListener("change",switchTermLive,true);
  form.elements.semester?.addEventListener("change",switchTermLive,true);
  // 勾選值校正與開啟既有文件後的還原交由 checkbox-value-guard；
  // 正式 submit 會一次儲存完整表單，不再額外重複 patch Firestore。
  document.addEventListener("click",downloadFixed,true);
}
install();
console.log("Semester ISP checkbox/export fix v2.3.0 loaded");