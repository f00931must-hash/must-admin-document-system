import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const $=id=>document.getElementById(id);let currentUser=null;
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]));}
function formData(){const f=$("ispForm"),data={};for(const el of f.elements){if(!el.name||el.type==='submit'||el.type==='button')continue;if(el.type==='checkbox'){if(!data[el.name])data[el.name]=[];if(el.checked)data[el.name].push(el.value);}else if(el.type==='radio'){if(el.checked)data[el.name]=el.value;else if(!(el.name in data))data[el.name]='';}else data[el.name]=el.value;}return data;}
function clearForm(){$("ispForm").reset();$("docId").value='';}
function fillForm(data){clearForm();$("docId").value=data.id||'';for(const el of $("ispForm").elements){if(!el.name)continue;const v=data.form?.[el.name];if(el.type==='checkbox')el.checked=Array.isArray(v)&&v.includes(el.value);else if(el.type==='radio')el.checked=v===el.value;else if(v!==undefined)el.value=el.matches('[data-roc-date]')?rocInputDate(v):v??'';}}
$("loginBtn").onclick=()=>signInWithPopup(auth,provider);$("logoutBtn").onclick=()=>signOut(auth);$("newIspBtn").onclick=()=>{clearForm();showPage('ispEditor')};$("backBtn").onclick=()=>showPage('home');
document.querySelectorAll('.nav[data-view]').forEach(btn=>btn.onclick=async()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showPage(btn.dataset.view);if(btn.dataset.view==='mine')await loadDocs();});
$("ispForm").onsubmit=async e=>{e.preventDefault();if(!currentUser)return;const form=formData();const payload={ownerUid:currentUser.uid,ownerEmail:currentUser.email||'',type:'ISP',studentName:(form.studentName||'').trim(),studentId:(form.studentId||'').trim(),form,updatedAt:serverTimestamp()};const id=$("docId").value;if(id)await updateDoc(doc(db,'adminDocuments',id),payload);else{payload.createdAt=serverTimestamp();const ref=await addDoc(collection(db,'adminDocuments'),payload);$("docId").value=ref.id;}alert('草稿已儲存');};
async function loadDocs(){if(!currentUser)return;const q=query(collection(db,'adminDocuments'),where('ownerUid','==',currentUser.uid));const snap=await getDocs(q),items=[];snap.forEach(s=>items.push({id:s.id,...s.data()}));items.sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0));const list=$("docList");list.innerHTML='';if(!items.length){list.innerHTML='<div class="doc-item">目前尚無行政文書。</div>';return;}for(const d of items){const div=document.createElement('div');div.className='doc-item';div.innerHTML=`<div><strong>${esc(d.studentName||'未命名')}｜ISP</strong><div class="doc-meta">${esc(d.studentId||'尚未填學號')}　第一階段資料</div></div><button class="secondary">開啟</button>`;div.querySelector('button').onclick=()=>{fillForm(d);showPage('ispEditor')};list.appendChild(div);}}
onAuthStateChanged(auth,user=>{currentUser=user;if(user){$("loginView").classList.add('hidden');$("appView").classList.remove('hidden');$("userEmail").textContent=user.email||'';}else{$("appView").classList.add('hidden');$("loginView").classList.remove('hidden');}});


function markOne(value, option){ return value===option ? "■" : "□"; }
function markMany(values, option){ return Array.isArray(values) && values.includes(option) ? "■" : "□"; }
const rocDateFields=["fillDate","birthday","admissionDate","leaveDate","assessmentDate","reassessmentDate","medStart1","medNextChange1","medStart2","medNextChange2","medStart3","medNextChange3"];
function dateParts(v){
  const m=String(v??'').trim().match(/^(?:民國\s*)?(\d{2,4})\s*[年\/.\-]\s*(\d{1,2})\s*[月\/.\-]\s*(\d{1,2})\s*日?$/);
  if(!m)return null;
  let y=Number(m[1]);const month=Number(m[2]),day=Number(m[3]);
  if(y>=1912)y-=1911;
  if(y<1||month<1||month>12||day<1||day>31)return null;
  return {y,month,day};
}
function rocInputDate(v){const p=dateParts(v);return p?`${p.y}/${String(p.month).padStart(2,'0')}/${String(p.day).padStart(2,'0')}`:String(v??'');}
function dateText(v){const p=dateParts(v);return p?`${p.y}年${p.month}月${p.day}日`:String(v??'').trim();}
function exportData(f){
  const sys=f.schoolSystem||"";
  const adm=f.admissionMethod||"";
  const rocData={...f};
  rocDateFields.forEach(name=>{rocData[name]=dateText(f[name]);});
  return {
    ...rocData,
    fillDateText: dateText(f.fillDate),
    birthdayText: dateText(f.birthday), admissionDateText: dateText(f.admissionDate),
    genderChecks:`${markOne(f.gender,"男")}男  ${markOne(f.gender,"女")}女`,
    schoolSystemChecks:`${markOne(sys,"大學部")}大學部  ${markOne(sys,"研究所碩士班")}研究所碩士班  ${markOne(sys,"進修部")}進修部  ${markOne(sys,"其他")}其他${sys==="其他"&&f.schoolSystemOther?`：${f.schoolSystemOther}`:""}`,
    admissionMethodChecks:`${markOne(adm,"一般入學考試")}一般入學考試  ${markOne(adm,"身心障礙甄試")}身心障礙甄試\n${markOne(adm,"推薦甄選")}推薦甄選  ${markOne(adm,"轉學考")}轉學考  ${markOne(adm,"其他")}其他${adm==="其他"&&f.admissionMethodOther?`：${f.admissionMethodOther}`:""}`,
    addressBlock:`就學期間通訊（${markOne(f.livingType,"自家")}自家 ${markOne(f.livingType,"校舍")}校舍 ${markOne(f.livingType,"外宿")}外宿 ${markOne(f.livingType,"其他")}其他）
通訊：${f.mailingAddress||""}
戶籍：${markMany(f.registeredSame,"是")}同上 ${f.registeredAddress||""}`,
    phoneBlock:`寢電：${f.dormPhone||""}
住宅：${f.homePhone||""}
手機：${f.mobile||""}`,
    certificateBlock:`身心障礙手冊（證明）：${markOne(f.disabilityCertificate,"有")}有（手冊記載類別：${f.certificateCategory||""} 程度：${f.certificateLevel||""}）ICD：${f.icd||""}\n鑑定日期：${dateText(f.assessmentDate)}；重新鑑定日期：${dateText(f.reassessmentDate)}\n${markOne(f.disabilityCertificate,"無")}無，其他：${markMany(f.otherCertificate,"鑑輔會證明")}鑑輔會證明（證書編號：${f.certificateNo||""} 障別：${f.disabilityType||""}） ${markMany(f.otherCertificate,"醫院診斷證明")}醫院診斷證明（最近文號：${f.hospitalDocNo||""}）`,
    disabilityBlock:`障礙特徵：${f.disabilityFeatures||""}\n致障時間：${markOne(f.onsetType,"先天")}先天 ${markOne(f.onsetType,"後天")}後天（年齡：${f.onsetAge||""}歲）`,
    causeBlock:`致障原因：${f.disabilityCause||""}`, treatmentBlock:`治療經過：${f.treatmentHistory||""}`, statusBlock:`障礙現況：（目前復原情形？身體健康狀況？繼續接受治療？）\n${f.currentDisabilityStatus||""}`,
    visionBlock:`（裸視）左：${f.visionRawLeft||""}度 右：${f.visionRawRight||""}度\n（矯正後）左：${f.visionCorrectedLeft||""}度 右：${f.visionCorrectedRight||""}度`,
    hearingBlock:`（裸耳）左：${f.hearingRawLeft||""} 右：${f.hearingRawRight||""}（dB）
${markMany(f.hearingDevice,"助聽器")}助聽器 ${markMany(f.hearingDevice,"人工電子耳")}人工電子耳 左：${f.hearingAidLeft||""} 右：${f.hearingAidRight||""}（dB）`,
    strengthChecks:["舉","扔","推","拉","抓","握"].map(x=>`${markMany(f.physicalStrength,x)}${x}`).join(""),
    postureChecks:["彎腰","跪蹲","匍匐","平衡"].map(x=>`${markMany(f.posture,x)}${x}`).join(""),
    mobilityChecks:["行走","坐","立","攀登","爬行","手指運轉"].map(x=>`${markMany(f.mobility,x)}${x}`).join(""),
    communicationChecks:["口語","國語","台語","客語","手語","讀唇","筆談","其他"].map(x=>`${markMany(f.communication,x)}${x}`).join(""),
    orientationChecks:["能迅速正確辨別方位","方位辨別遲緩","不能辨別方位"].map(x=>`${markOne(f.orientation,x)}${x}`).join(""),
    motorChecks:["粗大動作","精細動作","協調動作"].map(x=>`${markMany(f.motorAbility,x)}${x}`).join(""),
    reactionChecks:["反應靈敏","反應尚可","反應遲緩"].map(x=>`${markOne(f.reaction,x)}${x}`).join("\n"),
    assistiveBlock:`${markOne(f.needAssistiveDevice,"否")}否\n${markOne(f.needAssistiveDevice,"是")}是 何種輔具：${f.assistiveDeviceType||""}`,
    emergencyCompanyPhoneText:`公司：${f.emergencyCompanyPhone||""}`,
    emergencyHomePhoneText:`住家：${f.emergencyHomePhone||""}`,
    emergencyMobileText:`手機：${f.emergencyMobile||""}`,
    emergencyEmailText:`E-mail：${f.emergencyEmail||""}`,
    emergencyAddressBlock:`（${markOne(f.emergencyAddressType,"同戶籍")}同戶籍 ${markOne(f.emergencyAddressType,"公司")}公司 ${markOne(f.emergencyAddressType,"其他")}其他） ${f.emergencyAddress||""}`,
    talentsBlock:[
      ["唱歌","樂器","舞蹈","運動"],
      ["美演","語言","手工藝","機械"],
      ["網頁設計","撰寫程式","文藝創作","手語翻譯","表演"],
    ].map(row=>row.map(x=>`${markMany(f.talents,x)}${x}`).join("　")).join("\n")+
      `\n${markMany(f.talents,"其他")}其他${f.talentsOther?`：${f.talentsOther}`:""}`,
    highSchoolTypeChecks:["普通班","特殊學校","資源班","特殊班","巡迴輔導"].map(x=>`${markMany(f.highSchoolType,x)}${x}`).join(""),
    cadreBlock:`幹部名稱（何時擔任）\n1. ${f.cadreExperience1||""}\n2. ${f.cadreExperience2||""}\n3. ${f.cadreExperience3||""}`,
    clubBlock:`社團名稱　參與項目\n1. ${f.clubName1||""}　${f.clubItem1||""}\n2. ${f.clubName2||""}　${f.clubItem2||""}\n3. ${f.clubName3||""}　${f.clubItem3||""}`,
    workBlock:`工作職稱　從事內容\n1. ${f.workTitle1||""}　${f.workContent1||""}\n2. ${f.workTitle2||""}　${f.workContent2||""}\n3. ${f.workTitle3||""}　${f.workContent3||""}`,
    transportLicenseBlock:`到校交通工具：${["大眾運輸","無法自行上學","自行開車","自行騎機車","步行"].map(x=>`${markMany(f.transport,x)}${x}`).join("　")}\n`+
      `${markMany(f.transport,"其他")}其他：${f.transportOther||""}\n`+
      `我擁有的駕照：${markMany(f.license,"汽車")}汽車（加註條件：${f.carLicenseCondition||""}）　${markMany(f.license,"機車")}機車（加註條件：${f.motorcycleLicenseCondition||""}）`,
    assistiveUseBlock:`現階段使用的輔具：\n${markOne(f.assistiveNeed,"無需求")}無需求\n${markOne(f.assistiveNeed,"有需求")}有需求：1.生活輔具：${f.assistiveLife||""}\n2.學習輔具：${f.assistiveLearning||""}\n3.醫療輔具：${f.assistiveMedical||""}\n4.其它輔具：${f.assistiveOther||""}`,
    assistiveStatusBlock:`輔具使用狀況：\n輔具來源：${markOne(f.assistiveSource,"自備")}自備　${markOne(f.assistiveSource,"借用")}借用：${f.assistiveBorrowFrom||""}\n`+
      `輔具現況：${markOne(f.assistiveCondition,"良好")}良好　${markOne(f.assistiveCondition,"需定時評估調整")}需定時評估調整（頻率：${f.assistiveFrequency||""}／次）　${markOne(f.assistiveCondition,"急需調整")}急需調整\n其他：${f.assistiveStatusOther||""}`,
    familyStatusBlock:`1.排行：${f.birthOrder||""}，兄：${f.brothersOlder||""}人、姊：${f.sistersOlder||""}人、弟：${f.brothersYounger||""}人、妹：${f.sistersYounger||""}人\n`+
      `2.父母關係：${["同居","分居","離異","其他"].map(x=>`${markOne(f.parentsRelationship,x)}${x}`).join(" ")}${f.parentsRelationshipOther?`：${f.parentsRelationshipOther}`:""}\n`+
      `3.個人婚姻狀況：${markOne(f.maritalStatus,"未婚")}未婚 ${markOne(f.maritalStatus,"已婚")}已婚（子女：${f.childrenCount||""}人）\n`+
      `4.主要照顧者：${["父親","母親","祖父","祖母","其他"].map(x=>`${markOne(f.primaryCaregiver,x)}${x}`).join(" ")}${f.primaryCaregiverOther?`：${f.primaryCaregiverOther}`:""}\n`+
      `5.家中主要使用語言：${f.familyLanguage||""}，父母是否會說（或瞭解）國語：${markOne(f.parentsMandarin,"會")}會 ${markOne(f.parentsMandarin,"不會")}不會\n`+
      `6.家中成員是否有其他特殊個案：${markOne(f.familySpecialCase,"無")}無 ${markOne(f.familySpecialCase,"有")}有（說明：${f.familySpecialCaseNote||""}）\n`+
      `7.其他特殊身分：${["無","原住民","新住民","低收入戶","其他"].map(x=>`${markMany(f.specialIdentity,x)}${x}`).join(" ")}　原住民族別：${f.indigenousGroup||""}　其他：${f.specialIdentityOther||""}\n`+
      `8.家庭經濟狀況：${["富裕","小康","清寒"].map(x=>`${markOne(f.economicStatus,x)}${x}`).join(" ")}（是否為低收／中低收入戶？${markOne(f.lowIncomeStatus,"是")}是 ${markOne(f.lowIncomeStatus,"否")}否）`,
    familyReferralBlock:`${["生活輔助","獎助學金","輔具提供","醫療諮詢","居家照護/喘息服務訊息","身障生心理諮商/輔導","特殊教育諮詢","職訓及就輔","其他"].map(x=>`${markMany(f.familyReferral,x)}${x}`).join("　")}${f.familyReferralOther?`：${f.familyReferralOther}`:""}`,
    parentExpectationChecks:["支持就學","不支持就學","沒意見"].map(x=>`${markOne(f.parentExpectation,x)}${x}`).join("　"),
    selfExpectationBlock:`${markOne(f.selfExpectation,"就讀科系符合興趣")}就讀科系符合興趣　${markOne(f.selfExpectation,"就讀科系不符合興趣")}就讀科系不符合興趣：${markMany(f.selfExpectationAction,"考慮轉系")}考慮轉系　${markMany(f.selfExpectationAction,"其他")}其他${f.selfExpectationNote?`：${f.selfExpectationNote}`:""}`
  };
}
$("downloadBtn").onclick=async()=>{
  try{
    if (typeof window.PizZip === "undefined") throw new Error("Word 元件 PizZip 載入失敗，請重新整理頁面後再試");
    if (typeof window.docxtemplater === "undefined") throw new Error("Word 元件 Docxtemplater 載入失敗，請重新整理頁面後再試");
    if (typeof window.saveAs === "undefined") throw new Error("下載元件 FileSaver 載入失敗，請重新整理頁面後再試");
    const f=formData();
    const res=await fetch("./templates/ISP-template-v0.4.2.docx?v=0.4.2.4",{cache:"no-store"});
    if(!res.ok) throw new Error("無法讀取 ISP Word 母版");
    const buf=await res.arrayBuffer();
    const zip=new window.PizZip(buf);
    const docx=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
    docx.render(exportData(f));
    const blob=docx.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    const safe=(f.studentName||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    saveAs(blob,`${safe}_ISP_輸出測試.docx`);
  }catch(err){ console.error(err); alert(`Word 產生失敗：${err?.message||err}`); }
};
