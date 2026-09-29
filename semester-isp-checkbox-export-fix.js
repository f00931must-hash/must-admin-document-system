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
  const all=await window.__adminDocumentsCache.getOwnerDocs(owner);
  const grade=norm(f.studentGrade),sem=norm(f.semester),name=normName(f.studentName),dept=norm(f.department);
  const docs=all.filter(x=>x.type==="SEMESTER_ISP"&&normName(x.studentName)===name&&norm(x.form?.department)===dept&&norm(x.form?.studentGrade)===grade&&String(x.form?.semester||"")===sem);
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
function semesterClassDisplay(f){
  const dept=norm(f.department).replace(/系$/u,"");
  const grade=norm(f.studentGrade);
  let cls=norm(f.studentClass);
  if(grade&&cls.startsWith(grade))cls=cls.slice(grade.length);
  cls=cls.replace(/^年級/u,"").trim();
  return `${dept}${grade}${cls}`.trim();
}
function patchSemesterWordLayout(zip,data){
  const file=zip.file("word/document.xml");if(!file)return;
  const NS="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const XMLNS="http://www.w3.org/XML/1998/namespace";
  const xml=new DOMParser().parseFromString(file.asText(),"application/xml");
  const compact=s=>String(s||"").replace(/[\s　]/g,"").replace(/／/g,"/").replace(/[－–—]/g,"-");
  const textOf=node=>[...node.getElementsByTagNameNS(NS,"t")].map(x=>x.textContent||"").join("");
  const elementChildren=(node,name)=>[...node.childNodes].filter(n=>n.nodeType===1&&n.namespaceURI===NS&&(!name||n.localName===name));
  const nextCell=tc=>{
    let n=tc?.nextSibling||null;
    while(n){if(n.nodeType===1&&n.namespaceURI===NS&&n.localName==="tc")return n;n=n.nextSibling;}
    return null;
  };
  function makeRun(text,{bold=false,size=22}={}){
    const r=xml.createElementNS(NS,"w:r"),rPr=xml.createElementNS(NS,"w:rPr");
    const fonts=xml.createElementNS(NS,"w:rFonts");
    fonts.setAttributeNS(NS,"w:ascii","DFKai-SB");fonts.setAttributeNS(NS,"w:hAnsi","DFKai-SB");fonts.setAttributeNS(NS,"w:eastAsia","標楷體");
    rPr.appendChild(fonts);
    if(bold)rPr.appendChild(xml.createElementNS(NS,"w:b"));
    const sz=xml.createElementNS(NS,"w:sz");sz.setAttributeNS(NS,"w:val",String(size));rPr.appendChild(sz);
    const szCs=xml.createElementNS(NS,"w:szCs");szCs.setAttributeNS(NS,"w:val",String(size));rPr.appendChild(szCs);
    r.appendChild(rPr);
    const t=xml.createElementNS(NS,"w:t");t.setAttributeNS(XMLNS,"xml:space","preserve");t.textContent=String(text||"");
    r.appendChild(t);return r;
  }
  function setCellText(tc,text,{bold=false,size=22,center=false,right=false}={}){
    if(!tc)return;
    elementChildren(tc).filter(n=>n.localName!=="tcPr").forEach(n=>tc.removeChild(n));
    const p=xml.createElementNS(NS,"w:p");
    if(center||right){
      const pPr=xml.createElementNS(NS,"w:pPr"),jc=xml.createElementNS(NS,"w:jc");
      jc.setAttributeNS(NS,"w:val",right?"right":"center");pPr.appendChild(jc);p.appendChild(pPr);
    }
    p.appendChild(makeRun(text,{bold,size}));tc.appendChild(p);
  }
  function setCellParagraphs(tc,text,{size=22}={}){
    if(!tc)return;
    const lines=String(text||"").replace(/\r\n?/g,"\n").split(/\n+/).map(x=>x.trim()).filter(Boolean);
    elementChildren(tc).filter(n=>n.localName!=="tcPr").forEach(n=>tc.removeChild(n));
    if(!lines.length){tc.appendChild(xml.createElementNS(NS,"w:p"));return;}
    lines.forEach(line=>{
      const p=xml.createElementNS(NS,"w:p");
      p.appendChild(makeRun(line,{size}));
      tc.appendChild(p);
    });
  }
  function setParagraphText(p,text,{size=22,right=false,center=false,bold=false}={}){
    if(!p)return;
    [...p.childNodes].forEach(n=>p.removeChild(n));
    if(right||center){
      const pPr=xml.createElementNS(NS,"w:pPr"),jc=xml.createElementNS(NS,"w:jc");
      jc.setAttributeNS(NS,"w:val",right?"right":"center");pPr.appendChild(jc);p.appendChild(pPr);
    }
    p.appendChild(makeRun(text,{size,bold}));
  }
  function findCellByLabel(label){
    return [...xml.getElementsByTagNameNS(NS,"tc")].find(tc=>compact(textOf(tc)).includes(compact(label)))||null;
  }
  function setRightCell(label,text,opts={}){
    const labelCell=findCellByLabel(label);if(!labelCell)return;
    const target=nextCell(labelCell);
    if(String(text||"").includes("\n"))setCellParagraphs(target,text,opts);
    else setCellText(target,text,opts);
  }
  function findRowByLabel(label){
    return [...xml.getElementsByTagNameNS(NS,"tr")].find(tr=>compact(textOf(tr)).includes(compact(label)))||null;
  }
  function setSupportNote(rowLabel,note){
    if(!note)return;
    const row=findRowByLabel(rowLabel);if(!row)return;
    const paragraphs=[...row.getElementsByTagNameNS(NS,"p")];
    const p=paragraphs.find(x=>compact(textOf(x)).startsWith(compact("說明：")));
    if(p)setParagraphText(p,`說明：${note}`,{size:22});
  }
  function clearFixedRowHeightForLabels(labels){
    const rows=[...xml.getElementsByTagNameNS(NS,"tr")];
    for(const row of rows){
      const txt=compact(textOf(row));
      if(!labels.some(label=>txt.includes(compact(label))))continue;
      const trPr=elementChildren(row,"trPr")[0];if(!trPr)continue;
      elementChildren(trPr,"trHeight").forEach(n=>trPr.removeChild(n));
    }
  }
  function formatRocDate(value){
    const raw=norm(value);
    const m=raw.match(/^(\d{2,3})[\/.-](\d{1,2})[\/.-](\d{1,2})$/);
    if(!m)return raw;
    return `${Number(m[1])}年${String(Number(m[2])).padStart(2,"0")}月${String(Number(m[3])).padStart(2,"0")}日`;
  }

  // 新版 1150810 母版為正式空白表，所有內容由這裡依欄位定位填入。
  const title=[...xml.getElementsByTagNameNS(NS,"p")].find(p=>compact(textOf(p)).includes("個別化支持計畫(ISP)"));
  if(title)setParagraphText(title,`${data.academicYear||""} 學年度第 ${data.semester||""} 學期  個別化支持計畫（ISP）`,{size:32,center:true,bold:true});

  const dateParagraph=[...xml.getElementsByTagNameNS(NS,"p")].find(p=>compact(textOf(p)).startsWith("日期："));
  if(dateParagraph)setParagraphText(dateParagraph,`日期：${formatRocDate(data.fillDate||data.fillDateText)}`,{size:22,right:true});

  setRightCell("系級",data.classDisplay||"",{center:true,size:22});
  setRightCell("姓名",data.studentName||"",{center:true,size:22});
  setRightCell("障別",data.disabilityType||"",{center:true,size:22});
  setRightCell("程度",data.disabilityLevel||"",{center:true,size:22});

  [
    ["健康狀況","abilityHealth"],["感官功能","abilitySensory"],["知覺動作","abilityMotor"],
    ["認知能力","abilityCognitive"],["溝通能力","abilityCommunication"],["學業能力","abilityAcademic"],
    ["生活自理能力","abilitySelfCare"],["社會化及情緒行為能力","abilitySocialEmotional"],
    ["修課學分","courseCredits"],["學生需求評估","studentNeedsAssessment"]
  ].forEach(([label,key])=>setRightCell(label,data[key]||"",{size:22}));

  setSupportNote("學習支持",norm(data.learningSupportNote));
  setSupportNote("情緒與人際支持",norm(data.emotionalSupportNote));
  setSupportNote("生活與環境適應支持",norm(data.environmentSupportNote));
  setSupportNote("學業規劃支持",norm(data.academicPlanningSupportNote));
  setSupportNote("生涯與轉銜支持",norm(data.careerSupportNote));

  clearFixedRowHeightForLabels([
    "健康狀況","感官功能","知覺動作","認知能力","溝通能力","學業能力",
    "生活自理能力","社會化及情緒行為能力","修課學分",
    "綜合評估學生優弱勢能力","現況分析","學生需求評估",
    "學習支持","情緒與人際支持","生活與環境適應支持","學業規劃支持","生涯與轉銜支持"
  ]);

  zip.file("word/document.xml",new XMLSerializer().serializeToString(xml));
}
function patchStaticCheckboxes(zip,selectedByName){
  const f=zip.file("word/document.xml");if(!f)return;
  const NS="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const xml=new DOMParser().parseFromString(f.asText(),"application/xml");
  const compact=s=>String(s||"").replace(/[\s　]/g,"").replace(/／/g,"/").replace(/[－–—]/g,"-");
  const textOf=node=>[...node.getElementsByTagNameNS(NS,"t")].map(x=>x.textContent||"").join("");
  const rowLabelByName={
    learningSupport:"學習支持",
    emotionalSupport:"情緒與人際支持",
    environmentSupport:"生活與環境適應支持",
    academicPlanningSupport:"學業規劃支持",
    careerSupport:"生涯與轉銜支持",
    adminSupport:"行政與資源申請支持",
    supportAdjustment:"支持服務調整評估"
  };
  const rows=[...xml.getElementsByTagNameNS(NS,"tr")];
  for(const [name,options] of Object.entries(supportConfig)){
    const selected=new Set(selectedByName[name]||[]);
    const row=rows.find(tr=>compact(textOf(tr)).includes(compact(rowLabelByName[name]||name)));
    if(!row)continue;
    const textNodes=[...row.getElementsByTagNameNS(NS,"t")];
    for(const option of options){
      const target=compact(option);let idx=-1;
      for(let i=0;i<textNodes.length;i++){
        if(compact(textNodes[i].textContent).includes(target)){idx=i;break;}
      }
      if(idx<0)continue;
      const mark=selected.has(option)?"■":"□",node=textNodes[idx];
      if(/[□■]/.test(node.textContent))node.textContent=node.textContent.replace(/[□■]/,mark);
      else{
        for(let j=idx-1;j>=Math.max(0,idx-5);j--){
          if(/[□■]/.test(textNodes[j].textContent)){
            textNodes[j].textContent=textNodes[j].textContent.replace(/([□■])(?!.*[□■])/,mark);
            break;
          }
        }
      }
    }
  }
  zip.file("word/document.xml",new XMLSerializer().serializeToString(xml));
}
function patchOfficialRatings(zip,data){
  const f=zip.file("word/document.xml");if(!f)return;
  const NS="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const XMLNS="http://www.w3.org/XML/1998/namespace";
  const xml=new DOMParser().parseFromString(f.asText(),"application/xml");
  const compact=s=>String(s||"").replace(/[\s　]/g,"").replace(/／/g,"/").replace(/[－–—]/g,"-");
  const textOf=node=>[...node.getElementsByTagNameNS(NS,"t")].map(x=>x.textContent||"").join("");
  const setParagraphText=(p,text)=>{
    const runs=[...p.getElementsByTagNameNS(NS,"r")];
    let firstText=null;
    for(const run of runs){
      const texts=[...run.getElementsByTagNameNS(NS,"t")];
      for(const t of texts){
        if(!firstText)firstText=t;
        else t.textContent="";
      }
    }
    if(!firstText){
      const run=xml.createElementNS(NS,"w:r"),t=xml.createElementNS(NS,"w:t");
      t.setAttributeNS(XMLNS,"xml:space","preserve");run.appendChild(t);p.appendChild(run);firstText=t;
    }
    firstText.setAttributeNS(XMLNS,"xml:space","preserve");
    firstText.textContent=text;
  };
  const paragraphs=[...xml.getElementsByTagNameNS(NS,"p")];
  const strengths=[
    ["建立人際關係能力","strengthRelationship"],["情緒控制能力","strengthEmotion"],
    ["個人疾病認識能力","strengthIllnessAwareness"],["解決問題及處理狀況能力","strengthProblemSolving"],
    ["尋求資源能力","strengthResourceSeeking"],["支持系統資源","strengthSupportSystem"],
    ["家人的互動與關懷","strengthFamilyInteraction"],["家庭經濟狀況","strengthFamilyEconomy"]
  ];
  strengths.forEach(([label,name],i)=>{
    const p=paragraphs.find(x=>compact(textOf(x)).includes(compact(`(${i+1})${label}`)));if(!p)return;
    const value=data[name]==="待加強"?"弱":data[name];
    const line=`(${i+1})${label}　${["良好","尚可","弱"].map(x=>`${value===x?"■":"□"}${x}`).join("")}`;
    setParagraphText(p,line);
  });
  const analyses=[
    ["生活自理能力","analysisSelfCare",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["職(學)業能力","analysisStudyWork",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["行動能力","analysisMobility",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["交通能力","analysisTransport",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["通訊能力","analysisCommunication",["無需協助","需部份協助","完全需要協助","本項不適用"]],
    ["認知理解能力","analysisUnderstanding",["完全能理解","部份能理解","完全不能理解","本項不適用"]],
    ["語言表達能力","analysisExpression",["完全能表達","部份能表達","完全不能表達","本項不適用"]],
    ["人際互動能力","analysisInteraction",["能力良好","能力尚可","完全不能理解","本項不適用"]],
    ["休閒能力","analysisLeisure",["能自行參與","部份能參與","完全無法參與","本項不適用"]]
  ];
  analyses.forEach(([label,name,options],i)=>{
    const p=paragraphs.find(x=>compact(textOf(x)).includes(compact(`(${i+1})${label}`)));if(!p)return;
    const line=`(${i+1})${label} ${options.map(x=>`${data[name]===x?"■":"□"}${x}`).join("")}`;
    setParagraphText(p,line);
  });
  zip.file("word/document.xml",new XMLSerializer().serializeToString(xml));
}

async function downloadFixed(event){
  const btn=event.target.closest?.("#downloadSemesterIspBtn");if(!btn)return;
  event.preventDefault();event.stopImmediatePropagation();
  const form=$("semesterIspForm");
  if(!form||!window.PizZip||!window.docxtemplater||!window.saveAs)return alert("Word 下載元件尚未完成載入，請重新整理後再試");
  const f=serialize(form),old=btn.textContent;btn.disabled=true;btn.textContent="產生新版 Word 中…";
  try{
    const response=await fetch("./templates/semester-isp-template-v2.docx?v=3.0.0",{cache:"no-store"});
    if(!response.ok)throw new Error("無法讀取新版學期 ISP Word 母版");
    const zip=new window.PizZip(await response.arrayBuffer());
    const word=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
    const data={...f,classDisplay:semesterClassDisplay(f),fillDateText:norm(f.fillDate)};
    for(const [name,options] of Object.entries(supportConfig)){
      const values=Array.isArray(f[name])?f[name]:[];
      const checks=options.map(o=>`${values.includes(o)?"■":"□"}${o}`).join("\n");
      data[`${name}Checks`]=checks;data[`${name}Block`]=`${checks}\n說明：${norm(f[`${name}Note`])}`;data[`${name}Text`]=data[`${name}Block`];
    }
    word.render(data);
    patchStaticCheckboxes(word.getZip(),f);
    patchOfficialRatings(word.getZip(),f);
    patchSemesterWordLayout(word.getZip(),data);
    const blob=word.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    const safe=(f.studentName||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    saveAs(blob,`${safe}_${f.academicYear||""}學年度第${f.semester||""}學期_ISP.docx`);
  }catch(e){console.error(e);alert(`Word 產生失敗：${e.message||e}`);}finally{btn.disabled=false;btn.textContent=old;}
}
function install(){
  const form=$("semesterIspForm");if(!form||form.dataset.checkboxFix23)return;form.dataset.checkboxFix23="1";
  // 年級／學期不再用下拉選單觸發資料切換；由 16 學期按鈕導航統一接管。
  // 本模組只保留勾選輸出與 Word 下載。
  document.addEventListener("click",downloadFixed,true);
}
install();
console.log("Semester ISP checkbox/export fix v3.1.0 loaded");