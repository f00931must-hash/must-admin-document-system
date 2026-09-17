import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const db=getFirestore(getApp());
const $=id=>document.getElementById(id);
const norm=v=>String(v??"").trim();

const supportConfig={
  learningSupport:["無特殊學習支持需求","課業輔導（視學生主動申請或需求提供）","筆記／同儕協助","學習輔具協助","考試調整（延長時間／獨立考場等）","課業提醒與關懷（出缺席／作業狀況）","必要時協助與任課教師溝通","其他"],
  emotionalSupport:["無特殊需求","個別關懷晤談","團體輔導／主題活動參與","課業壓力與情緒支持","人際互動適應關懷","轉介心理諮商資源","其他"],
  environmentSupport:["無特殊需求","需無障礙環境調整","需生活同儕協助","作息與時間管理協助","交通費補助（無法自行上下學）","其他"],
  academicPlanningSupport:["畢業學分檢視與修課進度追蹤","選課諮詢與修課建議","修課負荷評估與調整建議","課程衝堂與學分風險提醒","畢業進度與延畢風險評估","必要時協助與系上溝通修課需求","其他"],
  careerSupport:["生涯探索／討論","職涯諮詢／評估","畢業準備與轉銜規劃討論","履歷／自傳協助（修改與建議）","就業準備支持（基本面試準備／資訊提供）","個別轉銜會議","轉銜資源連結（就業中心等）"],
  adminSupport:["特教生獎助學金申請協助","校內外資源資訊提供：校內－高教深耕計畫","校內行政資源申請協助","校外資源轉介與申請協助","其他"],
  supportAdjustment:["現有支持適切，持續維持","需調整部分支持內容","需新增或加強支持服務","需減少或結束部分支持","其他"]
};

function canonicalizeCheckboxValues(form=$("semesterIspForm")){
  if(!form)return;
  for(const [name,options] of Object.entries(supportConfig)){
    const boxes=[...form.querySelectorAll(`input[type="checkbox"][name="${name}"]`)];
    boxes.forEach((cb,index)=>{
      if(options[index]!==undefined)cb.value=options[index];
    });
  }
}

function applyExactSupports(form,data){
  canonicalizeCheckboxValues(form);
  for(const [name] of Object.entries(supportConfig)){
    const selected=Array.isArray(data?.[name])?data[name]:[];
    form.querySelectorAll(`input[type="checkbox"][name="${name}"]`).forEach(cb=>{cb.checked=selected.includes(cb.value);});
    const note=form.elements[`${name}Note`];
    if(note)note.value=norm(data?.[`${name}Note`]);
  }
}

async function restoreFromCurrentDoc(){
  const form=$("semesterIspForm"),id=$("semesterDocId")?.value;
  if(!form||!id)return;
  try{
    const snap=await getDoc(doc(db,"adminDocuments",id));
    if(!snap.exists())return;
    applyExactSupports(form,snap.data()?.form||{});
  }catch(error){
    console.warn("semester checkbox exact restore failed",error);
  }
}

// The legacy semester loader assigns an array directly to checkbox.value.
// Normalize values before any change/save/download handlers read the form.
document.addEventListener("change",event=>{
  if(event.target.closest?.("#semesterIspForm"))canonicalizeCheckboxValues();
},true);

document.addEventListener("submit",event=>{
  if(event.target?.id==="semesterIspForm")canonicalizeCheckboxValues(event.target);
},true);

document.addEventListener("click",event=>{
  if(event.target.closest?.("#downloadSemesterIspBtn"))canonicalizeCheckboxValues();
  if(event.target.closest?.(".open-semester-doc")){
    setTimeout(()=>{canonicalizeCheckboxValues();restoreFromCurrentDoc();},0);
    setTimeout(()=>{canonicalizeCheckboxValues();restoreFromCurrentDoc();},180);
  }
},true);

// Also repair the current editor after the dynamic support fields are inserted.
setTimeout(()=>{canonicalizeCheckboxValues();restoreFromCurrentDoc();},250);
setTimeout(()=>{canonicalizeCheckboxValues();restoreFromCurrentDoc();},900);

console.log("Semester ISP checkbox value guard v2.4.0 loaded");
