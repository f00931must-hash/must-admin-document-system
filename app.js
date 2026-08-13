import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDoc, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const $=id=>document.getElementById(id);let currentUser=null,currentAccess=null;
const ISP_AI_ENDPOINT="https://must-resource-ai.f00931-must.workers.dev/ai/isp-summary";
function normalizedEmail(value){return String(value||'').trim().toLowerCase();}
function workspaceOwnerEmail(){return currentAccess?.role==='assistant'?normalizedEmail(currentAccess.ownerEmail):normalizedEmail(currentAccess?.email||currentUser?.email);}
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]));}
function formData(){const f=$("ispForm"),data={};for(const el of f.elements){if(!el.name||el.type==='submit'||el.type==='button')continue;if(el.type==='checkbox'){if(!data[el.name])data[el.name]=[];if(el.checked)data[el.name].push(el.value);}else if(el.type==='radio'){if(el.checked)data[el.name]=el.value;else if(!(el.name in data))data[el.name]='';}else data[el.name]=el.value;}return data;}
function clearForm(){$("ispForm").reset();$("docId").value='';}
function fillForm(data){clearForm();$("docId").value=data.id||'';for(const el of $("ispForm").elements){if(!el.name)continue;const v=data.form?.[el.name];if(el.type==='checkbox')el.checked=Array.isArray(v)?v.includes(el.value):v===el.value;else if(el.type==='radio')el.checked=v===el.value;else if(v!==undefined)el.value=el.matches('[data-roc-date]')?rocInputDate(v):v??'';}}
$("loginBtn").onclick=()=>signInWithPopup(auth,provider);$("logoutBtn").onclick=()=>signOut(auth);$("newIspBtn").onclick=()=>{clearForm();showPage('ispEditor')};$("backBtn").onclick=()=>showPage('home');
document.querySelectorAll('.nav[data-view]').forEach(btn=>btn.onclick=async()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showPage(btn.dataset.view);if(btn.dataset.view==='mine')await loadDocs();});
$("ispForm").onsubmit=async e=>{e.preventDefault();if(!currentUser||!currentAccess)return;const form=formData(),ownerEmail=workspaceOwnerEmail();const common={ownerEmail,type:'ISP',studentName:(form.studentName||'').trim(),studentId:(form.studentId||'').trim(),form,updatedAt:serverTimestamp(),lastEditorUid:currentUser.uid,lastEditorEmail:normalizedEmail(currentUser.email)};const id=$("docId").value;if(id)await updateDoc(doc(db,'adminDocuments',id),common);else{const payload={...common,ownerUid:currentUser.uid,createdByUid:currentUser.uid,createdByEmail:normalizedEmail(currentUser.email),createdAt:serverTimestamp()};const ref=await addDoc(collection(db,'adminDocuments'),payload);$("docId").value=ref.id;}alert('草稿已儲存');};
let ispDocuments=[];
function admissionYear(value){const parsed=dateParts(value);return parsed?.y||0;}
function createdSeconds(item){return item.createdAt?.seconds||0;}
function sortedIspDocuments(){const mode=$("ispSort")?.value||"admission-desc";return [...ispDocuments].sort((a,b)=>{if(mode.startsWith("admission")){const yearA=admissionYear(a.form?.admissionDate),yearB=admissionYear(b.form?.admissionDate);if(!yearA||!yearB){if(yearA!==yearB)return yearA? -1:1;}else if(yearA!==yearB)return mode==="admission-asc"?yearA-yearB:yearB-yearA;return mode==="admission-asc"?createdSeconds(a)-createdSeconds(b):createdSeconds(b)-createdSeconds(a);}return mode==="created-asc"?createdSeconds(a)-createdSeconds(b):createdSeconds(b)-createdSeconds(a);});}
function renderDocs(){const list=$("docList");list.innerHTML='';const items=sortedIspDocuments();if(!items.length){list.innerHTML='<div class="doc-item">目前尚無新生 ISP 總表。</div>';return;}for(const d of items){const div=document.createElement('div');div.className='doc-item';const year=admissionYear(d.form?.admissionDate);div.innerHTML=`<div><strong>${esc(d.studentName||'未命名')}｜ISP</strong><div class="doc-meta">${esc(d.studentId||'尚未填學號')}　${year?`入學年 ${year}`:'尚未填入學年'}</div></div><div class="doc-actions"><button class="secondary open-doc">開啟</button>${currentAccess?.role==='assistant'?'':'<button class="delete-doc">刪除</button>'}</div>`;div.querySelector('.open-doc').onclick=()=>{fillForm(d);showPage('ispEditor')};const deleteButton=div.querySelector('.delete-doc');if(deleteButton)deleteButton.onclick=async()=>{const name=d.studentName||'未命名';if(!confirm(`確定要永久刪除「${name}」的新生 ISP 總表嗎？\n\n刪除後無法復原。`))return;if(!confirm(`請再次確認：真的要永久刪除「${name}」嗎？`))return;deleteButton.disabled=true;try{await deleteDoc(doc(db,'adminDocuments',d.id));ispDocuments=ispDocuments.filter(item=>item.id!==d.id);renderDocs();alert('已永久刪除，系統不會保留垃圾桶或封存副本。');}catch(error){console.error(error);deleteButton.disabled=false;alert('刪除失敗，請確認帳號權限或稍後再試。');}};list.appendChild(div);}}
async function loadDocs(){if(!currentUser||!currentAccess)return;const q=query(collection(db,'adminDocuments'),where('ownerEmail','==',workspaceOwnerEmail()));const snap=await getDocs(q);ispDocuments=[];snap.forEach(s=>{const item={id:s.id,...s.data()};if(!item.type||item.type==='ISP')ispDocuments.push(item);});renderDocs();}
$("ispSort").onchange=renderDocs;
onAuthStateChanged(auth,async user=>{currentUser=user;currentAccess=null;$("appView").classList.add('hidden');$("loginView").classList.add('hidden');$("deniedView").classList.add('hidden');if(!user){$("loginView").classList.remove('hidden');return}try{const email=String(user.email||'').trim().toLowerCase();const snap=await getDoc(doc(db,'settings','adminAccess'));const access=snap.data()?.users?.[email];if(!access||access.enabled===false)throw new Error('not-authorized');currentAccess=access;$("appView").classList.remove('hidden');$("userEmail").textContent=`${access.displayName||email}\n${email}`;}catch(err){console.error(err);$("deniedMessage").textContent='此帳號尚未由資源教室行政平台開通行政文書權限，或權限尚未同步。';$("deniedView").classList.remove('hidden');}});
$("deniedLogoutBtn").onclick=()=>signOut(auth);


function markOne(value, option){ return value===option ? "■" : "□"; }
function markMany(values, option){ return Array.isArray(values) && values.includes(option) ? "■" : "□"; }
function checkLines(values, options){ return options.map(x=>`${markMany(values,x)} ${x}`).join("\n"); }
function checkInline(values, options){ return options.map(x=>`${markMany(values,x)}${x}`).join("　"); }
function ratingLine(label, value, options){ return `${label} ${options.map(x=>`${markOne(value,x)}${x}`).join(" ")}`; }
function ratingOptions(value, options){return options.map(x=>`${markOne(value,x)}${x}`).join(" ");}
function compactRatingLine(label, value, options){return `${label} ${options.map(x=>`${markOne(value,x)}${x}`).join("")}`;}
function serviceOption(values, option, label=option){return `${markMany(values,option)}${label}`;}
const rocDateFields=["fillDate","birthday","admissionDate","leaveDate","assessmentDate","reassessmentDate","medStart1","medNextChange1","medStart2","medNextChange2"];
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
function compactDateText(v){const p=dateParts(v);return p?`${p.y}/${String(p.month).padStart(2,'0')}/${String(p.day).padStart(2,'0')}`:String(v??'').trim();}
function exportData(f){
  const sys=f.schoolSystem||"";
  const adm=f.admissionMethod||"";
  const rocData={...f};
  rocDateFields.forEach(name=>{rocData[name]=dateText(f[name]);});
  ["medStart1","medNextChange1","medStart2","medNextChange2"].forEach(name=>{rocData[name]=compactDateText(f[name]);});
  return {
    ...rocData,
    fillDateText: dateText(f.fillDate),
    birthdayText: compactDateText(f.birthday), admissionDateText: compactDateText(f.admissionDate),
    genderChecks:`${markOne(f.gender,"男")}男${markOne(f.gender,"女")}女`,
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
      `4.主要照顧者：${["父親","母親","祖父","祖母","其他"].map(x=>`${markMany(f.primaryCaregiver,x)}${x}`).join(" ")}${f.primaryCaregiverOther?`：${f.primaryCaregiverOther}`:""}\n`+
      `5.家中主要使用語言：${f.familyLanguage||""}，父母是否會說（或瞭解）國語：${markOne(f.parentsMandarin,"會")}會 ${markOne(f.parentsMandarin,"不會")}不會\n`+
      `6.家中成員是否有其他特殊個案：${markOne(f.familySpecialCase,"無")}無 ${markOne(f.familySpecialCase,"有")}有（說明：${f.familySpecialCaseNote||""}）\n`+
      `7.其他特殊身分：${["無","原住民","新住民","低收入戶","其他"].map(x=>`${markMany(f.specialIdentity,x)}${x}`).join(" ")}　原住民族別：${f.indigenousGroup||""}　其他：${f.specialIdentityOther||""}\n`+
      `8.家庭經濟狀況：${["富裕","小康","清寒"].map(x=>`${markOne(f.economicStatus,x)}${x}`).join(" ")}（是否為低收／中低收入戶？${markOne(f.lowIncomeStatus,"是")}是 ${markOne(f.lowIncomeStatus,"否")}否）`,
    familyReferralBlock:`${["生活輔助","獎助學金","輔具提供","醫療諮詢","居家照護/喘息服務訊息","身障生心理諮商/輔導","特殊教育諮詢","職訓及就輔","其他"].map(x=>`${markMany(f.familyReferral,x)}${x}`).join("　")}${f.familyReferralOther?`：${f.familyReferralOther}`:""}`,
    parentExpectationChecks:["支持就學","不支持就學","沒意見"].map(x=>`${markOne(f.parentExpectation,x)}${x}`).join("　"),
    selfExpectationBlock:`${markOne(f.selfExpectation,"就讀科系符合興趣")}就讀科系符合興趣　${markOne(f.selfExpectation,"就讀科系不符合興趣")}就讀科系不符合興趣：${markMany(f.selfExpectationAction,"考慮轉系")}考慮轉系${Array.isArray(f.selfExpectationAction)&&f.selfExpectationAction.includes("考慮轉系")&&f.selfExpectationTransferDepartment?`：${f.selfExpectationTransferDepartment}`:""}　${markMany(f.selfExpectationAction,"其他")}其他${f.selfExpectationNote?`：${f.selfExpectationNote}`:""}`
    ,physicalSymptomsPresenceChecks:`${markOne(f.physicalSymptomsPresence,"無")}無　${markOne(f.physicalSymptomsPresence,"有")}有（請勾選或填寫下列選項）`,
    physicalSymptomsLine1:["癲癇","心臟病","腦性麻痺","妥瑞症","氣喘病","高血壓"].map(x=>`${markMany(f.physicalSymptoms,x)}${x}`).join("　"),
    physicalSymptomsLine2:["低血壓","糖尿病","便溺失禁","蠶豆症","骨骼易脆","腦膜炎"].map(x=>`${markMany(f.physicalSymptoms,x)}${x}`).join("　"),
    physicalSymptomsLine3:["脊柱側彎","精神疾病","甲狀腺機能低下","甲狀腺機能亢進"].map(x=>`${markMany(f.physicalSymptoms,x)}${x}`).join("　"),
    physicalSymptomsLine4:`${markMany(f.physicalSymptoms,"惡性腫瘤")}惡性腫瘤${Array.isArray(f.physicalSymptoms)&&f.physicalSymptoms.includes("惡性腫瘤")&&f.malignantTumorName?`，${f.malignantTumorName}`:""}　${["地中海貧血","暈眩","長期失眠"].map(x=>`${markMany(f.physicalSymptoms,x)}${x}`).join("　")}`,
    physicalSymptomsLine5:`${markMany(f.physicalSymptoms,"過敏")}過敏，過敏原：${f.allergen||""}　${markMany(f.physicalSymptoms,"其他")}其他：${f.symptomsOther||""}`,
    medicationUseChecks:`${markOne(f.medicationUse,"無")}無　${markOne(f.medicationUse,"有")}有（請填寫下表）`,
    otherHealthBlock:`${markOne(f.otherHealthPresence,"無")}無　${markOne(f.otherHealthPresence,"有")}有，請說明：${f.otherHealthDescription||""}`,
    strengthsBlock:[
      ratingLine("(1)建立人際關係能力",f.strengthRelationship,["良好","尚可","弱"]), ratingLine("(2)情緒控制能力",f.strengthEmotion,["良好","尚可","弱"]),
      ratingLine("(3)個人疾病認識能力",f.strengthIllnessAwareness,["良好","尚可","弱"]), ratingLine("(4)解決問題及處理狀況能力",f.strengthProblemSolving,["良好","尚可","弱"]),
      ratingLine("(5)尋求資源能力",f.strengthResourceSeeking,["良好","尚可","弱"]), ratingLine("(6)支持系統資源",f.strengthSupportSystem,["良好","尚可","弱"]),
      ratingLine("(7)家人的互動與關懷",f.strengthFamilyInteraction,["良好","尚可","弱"]), ratingLine("(8)家庭經濟狀況",f.strengthFamilyEconomy,["良好","尚可","弱"])
    ].join("\n"),
    strengthLine1:ratingOptions(f.strengthRelationship,["良好","尚可","弱"]),
    strengthLine2:ratingOptions(f.strengthEmotion,["良好","尚可","弱"]),
    strengthLine3:ratingOptions(f.strengthIllnessAwareness,["良好","尚可","弱"]),
    strengthLine4:ratingOptions(f.strengthProblemSolving,["良好","尚可","弱"]),
    strengthLine5:ratingOptions(f.strengthResourceSeeking,["良好","尚可","弱"]),
    strengthLine6:ratingOptions(f.strengthSupportSystem,["良好","尚可","弱"]),
    strengthLine7:ratingOptions(f.strengthFamilyInteraction,["良好","尚可","弱"]),
    strengthLine8:ratingOptions(f.strengthFamilyEconomy,["良好","尚可","弱"]),
    analysisBlock:[
      compactRatingLine("(1)生活自理能力",f.analysisSelfCare,["無需協助","需部份協助","完全需要協助","本項不適用"]), compactRatingLine("(2)職(學)業能力",f.analysisStudyWork,["無需協助","需部份協助","完全需要協助","本項不適用"]),
      compactRatingLine("(3)行動能力",f.analysisMobility,["無需協助","需部份協助","完全需要協助","本項不適用"]), compactRatingLine("(4)交通能力",f.analysisTransport,["無需協助","需部份協助","完全需要協助","本項不適用"]),
      compactRatingLine("(5)通訊能力",f.analysisCommunication,["無需協助","需部份協助","完全需要協助","本項不適用"]), compactRatingLine("(6)認知理解能力",f.analysisUnderstanding,["完全能理解","部份能理解","完全不能理解","本項不適用"]),
      compactRatingLine("(7)語言表達能力",f.analysisExpression,["完全能表達","部份能表達","完全不能表達","本項不適用"]), compactRatingLine("(8)人際互動能力",f.analysisInteraction,["能力良好","能力尚可","完全不能理解","本項不適用"]),
      compactRatingLine("(9)休閒能力",f.analysisLeisure,["能自行參與","部份能參與","完全無法參與","本項不適用"])
    ].join("\n"),
    learningSupportBlock:`${checkLines(f.learningSupport,["無特殊學習支持需求","課業輔導（視學生主動申請或需求提供）","筆記／同儕協助","學習輔具協助","考試調整（延長時間／獨立考場等）","課業提醒與關懷（出缺席／作業狀況）","必要時協助與任課教師溝通","其他"])}\n說明：${f.learningSupportNote||""}`,
    emotionalSupportBlock:`${checkLines(f.emotionalSupport,["無特殊需求","個別關懷晤談","團體輔導／主題活動參與","課業壓力與情緒支持","人際互動適應關懷","轉介心理諮商資源","其他"])}\n說明：${f.emotionalSupportNote||""}`,
    environmentSupportBlock:`${checkLines(f.environmentSupport,["無特殊需求","需無障礙環境調整","需生活同儕協助","作息與時間管理協助","交通費補助（無法自行上下學）","其他"])}\n說明：${f.environmentSupportNote||""}`,
    academicPlanningSupportBlock:`${checkLines(f.academicPlanningSupport,["畢業學分檢視與修課進度追蹤","選課諮詢與修課建議","修課負荷評估與調整建議","課程衝堂與學分風險提醒","畢業進度與延畢風險評估","必要時協助與系上溝通修課需求","其他"])}\n說明：${f.academicPlanningSupportNote||""}`,
    careerSupportBlock:`${checkLines(f.careerSupport,["生涯探索／討論","職涯諮詢／評估","畢業準備與轉銜規劃討論","履歷／自傳協助（修改與建議）","就業準備支持（基本面試準備／資訊提供）","個別轉銜會議","轉銜資源連結（就業中心等）"])}\n說明：${f.careerSupportNote||""}`,
    adminSupportBlock:`${checkLines(f.adminSupport,["特教生獎助學金申請協助","校內外資源資訊提供：校內－高教深耕計畫","校內行政資源申請協助","校外資源轉介與申請協助","其他"])}\n其他：${f.adminSupportNote||""}`,
    supportAdjustmentBlock:`${checkLines(f.supportAdjustment,["現有支持適切，持續維持","需調整部分支持內容","需新增或加強支持服務","需減少或結束部分支持","其他"])}\n其他：${f.supportAdjustmentNote||""}`,
    relatedServicesBlock:`（1）經濟補助\n`+
      `${serviceOption(f.relatedServices,"低收入戶生活補助")} ${serviceOption(f.relatedServices,"身心障礙者生活補助")} ${serviceOption(f.relatedServices,"身心障礙者津貼")}\n`+
      `${serviceOption(f.relatedServices,"健保自付保費補助")} ${serviceOption(f.relatedServices,"急難救助")} ${serviceOption(f.relatedServices,"學雜費減免補助")}\n`+
      `${serviceOption(f.relatedServices,"獎助學金")} ${serviceOption(f.relatedServices,"生活及復健輔助器具補助")} ${serviceOption(f.relatedServices,"醫療補助")}\n`+
      `${serviceOption(f.relatedServices,"租賃補助")} ${serviceOption(f.relatedServices,"經濟補助其他","其他")}：________________（請註明）\n`+
      `（2）支持性服務\n`+
      `${serviceOption(f.relatedServices,"居家照顧服務")} ${serviceOption(f.relatedServices,"臨時照顧服務")} ${serviceOption(f.relatedServices,"親職教育")} ${serviceOption(f.relatedServices,"交通服務")}\n`+
      `${serviceOption(f.relatedServices,"諮詢服務")} ${serviceOption(f.relatedServices,"諮商輔導服務")} ${serviceOption(f.relatedServices,"休閒活動")} ${serviceOption(f.relatedServices,"支持性服務其他","其他")}：________\n`+
      `（3）復健與醫療服務\n`+
      `${serviceOption(f.relatedServices,"物理治療")} ${serviceOption(f.relatedServices,"職能治療")} ${serviceOption(f.relatedServices,"語言治療")} ${serviceOption(f.relatedServices,"個別心理治療")}\n`+
      `${serviceOption(f.relatedServices,"團體治療")} ${serviceOption(f.relatedServices,"聽力復健")} ${serviceOption(f.relatedServices,"精神科醫療")} ${serviceOption(f.relatedServices,"視力復健")} ${serviceOption(f.relatedServices,"營養諮詢")}\n`+
      `${serviceOption(f.relatedServices,"居家護理")} ${serviceOption(f.relatedServices,"居家復健")} ${serviceOption(f.relatedServices,"輔助器具")} ${serviceOption(f.relatedServices,"精神復健機構")}\n`+
      `${serviceOption(f.relatedServices,"障礙重新鑑定")} ${serviceOption(f.relatedServices,"重大疾病性醫療")}：________（請註明）\n`+
      `${serviceOption(f.relatedServices,"復健醫療其他","其他")}：________________________（請註明）\n`+
      `（4）就學服務\n`+
      `${serviceOption(f.relatedServices,"教育輔具")} ${serviceOption(f.relatedServices,"行為輔導")} ${serviceOption(f.relatedServices,"課業輔導")} ${serviceOption(f.relatedServices,"生活輔導")} ${serviceOption(f.relatedServices,"職業輔導")}\n`+
      `${serviceOption(f.relatedServices,"就業輔導")} ${serviceOption(f.relatedServices,"入學管道","入學管道")}：請註明\n`+
      `${serviceOption(f.relatedServices,"工讀")} ${serviceOption(f.relatedServices,"校外實習","校外實習業")}：請註明職種及時間\n`+
      `${serviceOption(f.relatedServices,"就學服務其他","其他")}：________________________（請註明）\n`+
      `（5）住宿\n${serviceOption(f.relatedServices,"保留床位")} ${serviceOption(f.relatedServices,"特殊寢室")} ${serviceOption(f.relatedServices,"室友安排")} ${serviceOption(f.relatedServices,"住宿其他","其他")}：________\n`+
      `（6）交通：\n${serviceOption(f.relatedServices,"無法自行上學（政府補助800元／月）")}\n${serviceOption(f.relatedServices,"專用停車位識別證／專用牌照")}\n`+
      `（7）活動參與：${serviceOption(f.relatedServices,"期初會議")} ${serviceOption(f.relatedServices,"迎新、送舊")} ${serviceOption(f.relatedServices,"校外參訪")}\n`+
      `　　　　　　 ${serviceOption(f.relatedServices,"講座")} ${serviceOption(f.relatedServices,"競賽活動")} ${serviceOption(f.relatedServices,"轉銜會議")}\n`+
      `（8）其他：${f.relatedServicesNote||""}　　　　　　　　　（請註明）`,
    otherServiceSuggestionsBlock:`經濟補助 ${serviceOption(f.otherServiceSuggestions,"居家照顧服務")} ${serviceOption(f.otherServiceSuggestions,"臨時照顧服務")} ${serviceOption(f.otherServiceSuggestions,"發展評估")}\n`+
      `${serviceOption(f.otherServiceSuggestions,"物理治療")} ${serviceOption(f.otherServiceSuggestions,"居家護理")} ${serviceOption(f.otherServiceSuggestions,"職能治療")} ${serviceOption(f.otherServiceSuggestions,"語言治療")} ${serviceOption(f.otherServiceSuggestions,"聽力復健")}\n`+
      `${serviceOption(f.otherServiceSuggestions,"視力復健")} ${serviceOption(f.otherServiceSuggestions,"心理復健")} ${serviceOption(f.otherServiceSuggestions,"居家復健")} ${serviceOption(f.otherServiceSuggestions,"輔助器具")} ${serviceOption(f.otherServiceSuggestions,"障礙再鑑定")}\n`+
      `${serviceOption(f.otherServiceSuggestions,"職業輔導評量")} ${serviceOption(f.otherServiceSuggestions,"職業訓練")} ${serviceOption(f.otherServiceSuggestions,"就業服務")}${serviceOption(f.otherServiceSuggestions,"安置服務")} ${serviceOption(f.otherServiceSuggestions,"家庭輔導")}\n`+
      `${serviceOption(f.otherServiceSuggestions,"法律協助")} ${serviceOption(f.otherServiceSuggestions,"個案管理")} ${serviceOption(f.otherServiceSuggestions,"其他")}：${f.otherServiceSuggestionsNote||""}（請註明）`
  };
}

function getIspAiText(payload){
  return String(payload?.polishedText ?? payload?.polished ?? payload?.text ?? payload?.result ?? payload?.output ?? "").trim();
}

const AI_NEEDS_FIELDS=[
  "disabilityFeatures","currentDisabilityStatus","otherHealthDescription",
  "abilityHealth","abilitySensory","abilityMotor","abilityCognitive",
  "abilityCommunication","abilityAcademic","abilitySelfCare","abilitySocialEmotional",
  "strengthRelationship","strengthEmotion","strengthIllnessAwareness","strengthProblemSolving",
  "strengthResourceSeeking","strengthSupportSystem","strengthFamilyInteraction","strengthFamilyEconomy",
  "analysisSelfCare","analysisStudyWork","analysisMobility","analysisTransport","analysisCommunication",
  "analysisUnderstanding","analysisExpression","analysisInteraction","analysisLeisure",
  "familyReferral","familyReferralOther","parentExpectation","selfExpectation","selfExpectationAction","selfExpectationNote"
];
const AI_SERVICE_FIELDS=[
  "studentNeedsAssessment","learningSupport","learningSupportNote","emotionalSupport","emotionalSupportNote",
  "environmentSupport","environmentSupportNote","academicPlanningSupport","academicPlanningSupportNote",
  "careerSupport","careerSupportNote","adminSupport","adminSupportNote","supportAdjustment","supportAdjustmentNote",
  "relatedServices","relatedServicesNote","otherServiceSuggestions","otherServiceSuggestionsNote"
];
function aiFieldLabel(name){
  const el=document.querySelector(`[name="${name}"]`);
  if(!el)return name;
  const label=el.closest("label");
  const text=label?.childNodes?.[0]?.textContent?.trim();
  return text||name;
}
function buildAiSource(mode){
  const values=formData();
  const fields=mode==="service-evaluation"?AI_SERVICE_FIELDS:AI_NEEDS_FIELDS;
  return fields.map(name=>{
    const value=values[name];
    const text=Array.isArray(value)?value.filter(Boolean).join("、"):String(value||"").trim();
    return text?`${aiFieldLabel(name)}：${text}`:"";
  }).filter(Boolean).join("\n");
}
function attachUndoButton(button){
  const buttonGroup=document.createElement("div");
  buttonGroup.className="ai-button-group";
  button.parentNode.insertBefore(buttonGroup,button);
  buttonGroup.appendChild(button);
  const undoButton=document.createElement("button");
  undoButton.type="button";
  undoButton.className="ai-undo-btn";
  undoButton.textContent="↩ 還原";
  undoButton.disabled=true;
  buttonGroup.appendChild(undoButton);
  undoButton.addEventListener("click",()=>{
    const textarea=document.querySelector(`[name="${button.dataset.aiTarget}"]`);
    if(!textarea||typeof undoButton.dataset.original!=="string")return;
    textarea.value=undoButton.dataset.original;
    textarea.dispatchEvent(new Event("input",{bubbles:true}));
    delete undoButton.dataset.original;
    undoButton.disabled=true;
  });
  return undoButton;
}

document.querySelectorAll(".ai-polish-btn").forEach(button=>{
  const undoButton=attachUndoButton(button);

  button.addEventListener("click",async()=>{
    const textarea=document.querySelector(`[name="${button.dataset.aiTarget}"]`);
    const original=textarea?.value.trim()||"";
    if(!original){ alert("請先輸入內容，再使用 AI 潤飾。"); textarea?.focus(); return; }
    const oldLabel=button.textContent;
    button.disabled=true; button.textContent="AI 潤飾中…";
    try{
      const response=await fetch(ISP_AI_ENDPOINT,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({text:original,section:button.dataset.aiSection,documentType:"ISP"})
      });
      let payload={};
      try{ payload=await response.json(); }catch{}
      if(!response.ok) throw new Error(payload?.error||payload?.message||`AI 服務暫時無法使用（${response.status}）`);
      const polished=getIspAiText(payload);
      if(!polished) throw new Error("AI 沒有回傳可用內容");
      undoButton.dataset.original=original;
      textarea.value=polished;
      textarea.dispatchEvent(new Event("input",{bubbles:true}));
      undoButton.disabled=false;
    }catch(error){
      console.error(error);
      alert(error?.message||"AI 潤飾失敗，請稍後再試。");
    }finally{ button.disabled=false; button.textContent=oldLabel; }
  });
});

document.querySelectorAll(".ai-generate-btn").forEach(button=>{
  const undoButton=attachUndoButton(button);
  button.addEventListener("click",async()=>{
    const textarea=document.querySelector(`[name="${button.dataset.aiTarget}"]`);
    const source=buildAiSource(button.dataset.aiMode);
    if(!source){alert("目前沒有足夠的已填資料可供 AI 產生，請先填寫前面的相關欄位。");return;}
    const original=textarea?.value||"";
    const oldLabel=button.textContent;
    button.disabled=true;button.textContent="AI 產生中…";
    try{
      const response=await fetch(ISP_AI_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:source,mode:button.dataset.aiMode,documentType:"ISP"})});
      let payload={};try{payload=await response.json();}catch{}
      if(!response.ok)throw new Error(payload?.error||payload?.message||`AI 服務暫時無法使用（${response.status}）`);
      const generated=getIspAiText(payload);
      if(!generated)throw new Error("AI 沒有回傳可用內容");
      undoButton.dataset.original=original;
      textarea.value=generated;
      textarea.dispatchEvent(new Event("input",{bubbles:true}));
      undoButton.disabled=false;
    }catch(error){console.error(error);alert(error?.message||"AI 產生失敗，請稍後再試。");}
    finally{button.disabled=false;button.textContent=oldLabel;}
  });
});

$("downloadBtn").onclick=async()=>{
  try{
    if (typeof window.PizZip === "undefined") throw new Error("Word 元件 PizZip 載入失敗，請重新整理頁面後再試");
    if (typeof window.docxtemplater === "undefined") throw new Error("Word 元件 Docxtemplater 載入失敗，請重新整理頁面後再試");
    if (typeof window.saveAs === "undefined") throw new Error("下載元件 FileSaver 載入失敗，請重新整理頁面後再試");
    const f=formData();
    const res=await fetch("./templates/ISP-template-v0.4.2.docx?v=1.0.4",{cache:"no-store"});
    if(!res.ok) throw new Error("無法讀取 ISP Word 母版");
    const buf=await res.arrayBuffer();
    const zip=new window.PizZip(buf);
    const docx=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
    docx.render(exportData(f));
    const blob=docx.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    const safe=(f.studentName||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    saveAs(blob,`${safe}_新生ISP總表.docx`);
  }catch(err){ console.error(err); alert(`Word 產生失敗：${err?.message||err}`); }
};
