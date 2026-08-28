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
onAuthStateChanged(auth,async user=>{currentUser=user;currentAccess=null;$("appView").classList.add('hidden');$("loginView").classList.add('hidden');$("deniedView").classList.add('hidden');if(!user){$("loginView").classList.remove('hidden');return}try{const email=String(user.email||'').trim().toLowerCase();const snap=await getDoc(doc(db,'settings','adminAccess'));const baseAccess=snap.data()?.users?.[email];let access=baseAccess?.enabled!==false?baseAccess:null;if(!access){const assistantSnap=await getDoc(doc(db,'administrativeAssistants',email));const assistantData=assistantSnap.exists()?assistantSnap.data():null;if(assistantData?.enabled===true&&assistantData.ownerEmail){access={...assistantData,email,role:'assistant',ownerEmail:normalizedEmail(assistantData.ownerEmail)};}}if(!access)throw new Error('not-authorized');currentAccess={...access,email};$("appView").classList.remove('hidden');$("userEmail").textContent=`${access.displayName||email}\n${email}`;}catch(err){console.error(err);$("deniedMessage").textContent='此帳號尚未由資源教室行政平台開通行政文書權限，或權限尚未同步。';$("deniedView").classList.remove('hidden');}});
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
    leaveDateText: compactDateText(f.leaveDate),
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
      `　　　　　　　 ${serviceOption(f.relatedServices,"講座")} ${serviceOption(f.relatedServices,"競賽活動")} ${serviceOption(f.relatedServices,"轉銜會議")}\n`+
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
function normalizedIspAiComparison(text){
  return String(text||"").replace(/\s+/g,"").replace(/[，。；：、,.!！?？]/g,"").trim();
}

const AI_NEEDS_FIELDS=[
  // 僅限「貳、現況能力摘要與特殊教育需求服務」中，
  // 位於學生需求評估之前的欄位；不得傳送「壹、基本資料」。
  "abilityHealth","abilitySensory","abilityMotor","abilityCognitive",
  "abilityCommunication","abilityAcademic","abilitySelfCare","abilitySocialEmotional",
  "strengthRelationship","strengthEmotion","strengthIllnessAwareness","strengthProblemSolving",
  "strengthResourceSeeking","strengthSupportSystem","strengthFamilyInteraction","strengthFamilyEconomy",
  "analysisSelfCare","analysisStudyWork","analysisMobility","analysisTransport","analysisCommunication",
  "analysisUnderstanding","analysisExpression","analysisInteraction","analysisLeisure"
];
const AI_SERVICE_NARRATIVE_FIELDS=[
  "abilityHealth","abilitySensory","abilityMotor","abilityCognitive",
  "abilityCommunication","abilityAcademic","abilitySelfCare","abilitySocialEmotional",
  "studentNeedsAssessment"
];
const AI_SERVICE_PLAN_FIELDS=[
  "learningSupport","learningSupportNote","emotionalSupport","emotionalSupportNote",
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
  const formatFields=fields=>fields.map(name=>{
    const value=values[name];
    const text=Array.isArray(value)?value.filter(Boolean).join("、"):String(value||"").trim();
    return text?`${aiFieldLabel(name)}：${text}`:"";
  }).filter(Boolean).join("\n");
  if(mode==="service-evaluation"){
    const narrative=formatFields(AI_SERVICE_NARRATIVE_FIELDS);
    const plans=formatFields(AI_SERVICE_PLAN_FIELDS);
    return [
      narrative?`【主要評估依據：請優先統整，不要逐欄重述】\n${narrative}`:"",
      plans?`【目前服務規劃：僅供核對方向，不要逐項羅列】\n${plans}`:""
    ].filter(Boolean).join("\n\n");
  }
  return formatFields(AI_NEEDS_FIELDS);
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
      const requestPolish=async forceRewrite=>{
        const response=await fetch(ISP_AI_ENDPOINT,{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({text:original,mode:"summary",section:button.dataset.aiSection,forceRewrite,documentType:"ISP"})
        });
        let payload={};
        try{payload=await response.json();}catch{}
        if(!response.ok)throw new Error(payload?.error||payload?.message||`AI 服務暫時無法使用（${response.status}）`);
        return getIspAiText(payload);
      };
      let polished=await requestPolish(false);
      if(polished&&normalizedIspAiComparison(polished)===normalizedIspAiComparison(original))polished=await requestPolish(true);
      if(!polished) throw new Error("AI 沒有回傳可用內容");
      if(normalizedIspAiComparison(polished)===normalizedIspAiComparison(original)){
        alert("AI 判斷此格內容已符合正式文體，目前沒有可在不新增資訊下安全修改的地方。");
        return;
      }
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
    const res=await fetch("./templates/ISP-template-v0.4.2.docx?v=1.0.12",{cache:"no-store"});
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

// 課表格式優化：資料只保存在目前頁面記憶體，不讀寫 Firestore。
const timetablePeriods=[
  {period:1,start:"0810",end:"0900",time:"08:10–09:00"},
  {period:2,start:"0910",end:"1000",time:"09:10–10:00"},
  {period:3,start:"1010",end:"1100",time:"10:10–11:00"},
  {period:4,start:"1110",end:"1200",time:"11:10–12:00"},
  {period:5,start:"1310",end:"1400",time:"13:10–14:00"},
  {period:6,start:"1410",end:"1500",time:"14:10–15:00"},
  {period:7,start:"1510",end:"1600",time:"15:10–16:00"},
  {period:8,start:"1610",end:"1700",time:"16:10–17:00"},
  {period:9,start:"1710",end:"1800",time:"17:10–18:00"},
  {period:10,start:"1745",end:"1830",time:"17:45–18:30"},
  {period:11,start:"1830",end:"1915",time:"18:30–19:15"},
  {period:12,start:"1915",end:"2000",time:"19:15–20:00"},
  {period:13,start:"2010",end:"2055",time:"20:10–20:55"},
  {period:14,start:"2055",end:"2140",time:"20:55–21:40"},
  {period:15,start:"2145",end:"2230",time:"21:45–22:30"}
];
let timetableClipboardHtml="";
let parsedTimetable=null;

function timetablePlainText(html){
  const holder=document.createElement("div");
  holder.innerHTML=html;
  holder.querySelectorAll("script,style,noscript").forEach(node=>node.remove());
  return holder.textContent||"";
}

function timetableCellLines(cell){
  const holder=document.createElement("div");
  holder.innerHTML=cell.innerHTML
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(?:div|p|li|section|article|h[1-6])>/gi,"\n");
  return (holder.textContent||"").split(/\n+/).map(line=>line.replace(/\u00a0/g," ").trim()).filter(Boolean);
}

function removeEnglishCourseName(line){
  return line
    .replace(/[A-Za-z][A-Za-z0-9\s.,()\/&:'’+\-]*/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function splitTimetableTeacherLocation(text){
  const value=(text||"").replace(/\s+/g," ").trim();
  if(!value)return [];
  const parts=value.split(" ").filter(Boolean);
  if(parts.length>1)return [parts[0],parts.slice(1).join(" ")];
  const compoundSurname=/^(歐陽|司馬|上官|諸葛|夏侯|東方|尉遲|公孫)/.test(value);
  const teacherLength=compoundSurname?4:3;
  const teacher=value.slice(0,teacherLength);
  const location=value.slice(teacherLength);
  return teacher.length>=2&&/(?:樓|館|校區|教室|實驗室)/.test(location)?[teacher,location]:[value];
}

function arrangeTimetableCourseLines(lines){
  const unique=[...new Set(lines.map(line=>line.trim()).filter(Boolean))];
  if(!unique.length)return [];
  const joined=unique.join(" ").replace(/\s+/g," ").trim();
  const classPattern=/(四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己]/;
  const classMatch=joined.match(classPattern);
  if(!classMatch)return unique;
  const className=classMatch[0].trim();
  const before=joined.slice(0,classMatch.index).trim();
  const after=joined.slice(classMatch.index+classMatch[0].length).trim();
  const teachingMode=before.match(/(同步遠距教學|非同步遠距教學|遠距教學|遠距授課|實體教學|實體授課)$/);
  const courseInfo=teachingMode
    ? [before.slice(0,teachingMode.index).trim(),teachingMode[0]].filter(Boolean)
    : before.split(/\s+/).filter(Boolean);
  return [...courseInfo,className,...splitTimetableTeacherLocation(after)];
}

function cleanTimetableCourse(cell){
  const ignored=/^(課程|Course|星期|Mon|Tue|Wed|Thu|Thr|Fri|Sat|Sun)$/i;
  const lines=timetableCellLines(cell)
    .map(removeEnglishCourseName)
    .map(line=>line.replace(/^[｜|]+|[｜|]+$/g,"").trim())
    .filter(line=>line&&!ignored.test(line));
  return arrangeTimetableCourseLines(lines).join("\n");
}

function timetablePeriodFromCell(cell){
  const digits=(cell.textContent||"").replace(/\D/g,"");
  return timetablePeriods.find(item=>digits.startsWith(`${item.period}${item.start}${item.end}`))||null;
}

function parseTimetableHtml(html){
  if(!html)throw new Error("沒有取得網站表格格式，請直接從網站按 Ctrl+A、Ctrl+C 後貼上。");
  const holder=document.createElement("div");
  holder.innerHTML=html;
  const tables=[...holder.querySelectorAll("table")];
  const table=tables.find(item=>/星期一/.test(item.textContent||"")&&/星期二/.test(item.textContent||""));
  if(!table)throw new Error("找不到課表。請確認貼上的是『本學期課表查詢』完整頁面。");
  const allText=(holder.textContent||"").replace(/\u00a0/g," ");
  const academic=allText.match(/(\d{3})\s*學年[\s\S]{0,20}?第?\s*([123])\s*學期/);
  const id=allText.match(/學號\s*(?:\(\s*Std\.?\s*ID\s*\))?\s*[:：]?\s*([A-Za-z]\d{7,12}|\d{7,12})/i);
  const name=allText.match(/姓名\s*(?:\(\s*Name\s*\))?\s*[:：]?\s*([^\s©]{2,20})/i);
  const classInfo=allText.match(/MUST\s*Stdinfo\s+([^\s]{2,30})\s+(?:[A-Za-z]\d{7,12}|\d{7,12})/i)||allText.match(/((?:四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己])\s*(?:[A-Za-z]\d{7,12}|\d{7,12})/i)||allText.match(/(?:學生)?班級\s*[:：]?\s*((?:四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己])/);
  const rows=[...table.rows];
  const header=rows.find(row=>/星期一/.test(row.textContent||""));
  if(!header)throw new Error("課表星期欄位無法辨識。");
  const headers=[...header.cells].map(cell=>(cell.textContent||"").replace(/\s+/g,""));
  const dayIndexes=["星期一","星期二","星期三","星期四","星期五","星期六"].map(day=>headers.findIndex(text=>text.includes(day)));
  if(dayIndexes.some(index=>index<0))throw new Error("課表缺少星期一至星期六欄位，請重新複製完整頁面。");
  const courses={};
  timetablePeriods.forEach(item=>{for(let day=1;day<=6;day++)courses[`p${item.period}d${day}`]="";});
  for(const row of rows){
    if(row===header||row.cells.length<Math.max(...dayIndexes)+1)continue;
    const period=timetablePeriodFromCell(row.cells[0]);
    if(!period)continue;
    dayIndexes.forEach((cellIndex,dayOffset)=>{
      courses[`p${period.period}d${dayOffset+1}`]=cleanTimetableCourse(row.cells[cellIndex]);
    });
  }
  return {
    academicYear:academic?.[1]||"",
    semester:academic?.[2]||"",
    studentId:id?.[1]||"",
    studentName:name?.[1]?.replace(/[｜|].*$/,"")||"",
    studentClass:classInfo?.[1]||"",
    courses
  };
}

function renderTimetablePreview(data){
  $("timetableMeta").textContent=`${data.academicYear||"未辨識"}學年第${data.semester||"未辨識"}學期　學號：${data.studentId||"未辨識"}　姓名：${data.studentName||"未辨識"}　班級：${data.studentClass||"未辨識"}`;
  const body=$("timetablePreviewBody");body.innerHTML="";
  const visiblePeriods=timetablePeriods.filter(item=>Array.from({length:6},(_,index)=>data.courses[`p${item.period}d${index+1}`]).some(Boolean));
  for(const item of visiblePeriods){
    const row=document.createElement("tr");
    const periodCell=document.createElement("td");periodCell.textContent=`${item.period}\n${item.time}`;row.appendChild(periodCell);
    for(let day=1;day<=6;day++){const cell=document.createElement("td");cell.textContent=data.courses[`p${item.period}d${day}`]||"";row.appendChild(cell);}
    body.appendChild(row);
  }
  $("timetablePreview").classList.remove("hidden");
}

function runTimetableParsing(){
  const status=$("timetableStatus");status.classList.remove("error");
  try{
    parsedTimetable=parseTimetableHtml(timetableClipboardHtml);
    renderTimetablePreview(parsedTimetable);
    status.textContent="課表已完成整理。請確認預覽後下載 Word。";
  }catch(error){parsedTimetable=null;$("timetablePreview").classList.add("hidden");status.textContent=error.message;status.classList.add("error");}
}

$("openTimetableBtn").onclick=()=>showPage("timetable");
$("timetablePaste").addEventListener("paste",event=>{
  event.preventDefault();
  timetableClipboardHtml=event.clipboardData?.getData("text/html")||"";
  const plain=event.clipboardData?.getData("text/plain")||timetablePlainText(timetableClipboardHtml);
  $("timetablePaste").textContent=plain;
  $("timetableStatus").textContent="已貼上內容，請按「格式優化」。";
  $("timetableStatus").classList.remove("error");
  $("timetablePreview").classList.add("hidden");parsedTimetable=null;
});
$("parseTimetableBtn").onclick=runTimetableParsing;
$("clearTimetableBtn").onclick=()=>{timetableClipboardHtml="";parsedTimetable=null;$("timetablePaste").textContent="";$("timetableStatus").textContent="";$("timetablePreview").classList.add("hidden");};
$("downloadTimetableBtn").onclick=async()=>{
  if(!parsedTimetable){alert("請先貼上課表並完成格式優化。");return;}
  try{
    const response=await fetch("./templates/timetable-template.docx?v=1.3.0",{cache:"no-store"});
    if(!response.ok)throw new Error("無法讀取課表 Word 母版");
    const zip=new window.PizZip(await response.arrayBuffer());
    const word=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
    const periodVisibility={};
    for(let period=1;period<=15;period++)periodVisibility[`show${period}`]=Array.from({length:6},(_,index)=>parsedTimetable.courses[`p${period}d${index+1}`]).some(Boolean);
    word.render({...parsedTimetable,...parsedTimetable.courses,...periodVisibility});
    const blob=word.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    const safe=(parsedTimetable.studentName||parsedTimetable.studentId||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    saveAs(blob,`${safe}_課表.docx`);
  }catch(error){console.error(error);alert(`Word 產生失敗：${error?.message||error}`);}
};

// 成績格式優化：同一入口自動辨識期中／學期，內容僅保存在頁面記憶體。
let gradeClipboardHtml="";
let gradeClipboardText="";
let parsedGrade=null;
const gradeEscape=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));

function gradeCellText(cell){
  return (cell?.innerText||cell?.textContent||"").replace(/\u00a0/g," ").replace(/[ \t]+/g," ").trim();
}

function gradeRowsFromClipboard(html,plain){
  const rows=[];
  if(html){
    const doc=new DOMParser().parseFromString(html,"text/html");
    doc.querySelectorAll("table").forEach(table=>{
      const tableRows=[];
      table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr").forEach(row=>{
        const cells=[...row.children].filter(cell=>/^(TD|TH)$/.test(cell.tagName)).map(gradeCellText);
        if(cells.length)tableRows.push(cells);
      });
      if(tableRows.length)rows.push(tableRows);
    });
  }
  if(!rows.length&&plain){
    const tabRows=plain.split(/\r?\n/).map(line=>line.split("\t").map(value=>value.trim())).filter(row=>row.length>1);
    if(tabRows.length)rows.push(tabRows);
  }
  return rows;
}

function gradeHeaderIndex(row,patterns,excluded=[]){
  return row.findIndex(cell=>patterns.some(pattern=>pattern.test(cell))&&!excluded.some(pattern=>pattern.test(cell)));
}

function cleanChineseCourseName(value){
  return value
    .split(/\r?\n/)
    .map(line=>line.replace(/[A-Za-z][A-Za-z0-9 .,'&/:()\-]*/g," ").replace(/\s+/g," ").trim())
    .filter(line=>/[\u3400-\u9fff]/.test(line))
    .join(" ")
    .replace(/\s*[-–—]\s*$/g,"")
    .trim();
}

function cleanChineseValue(value){
  const chinese=(value||"").match(/[\u3400-\u9fff]+(?:[／/、－-][\u3400-\u9fff]+)*/g);
  return chinese?chinese.join(""):String(value||"").trim();
}

function gradeMetadata(text){
  const normalized=(text||"").replace(/\s+/g," ");
  const year=normalized.match(/(\d{2,3})\s*學年/);
  const semester=normalized.match(/(?:第\s*)?([12])\s*學期/);
  const studentId=normalized.match(/(?:學號(?:\s*\(\s*Std\.?\s*ID\s*\))?|Std\.?\s*ID)\s*[:：]?\s*([A-Za-z0-9_-]+)/i);
  const studentName=normalized.match(/(?:姓名(?:\s*\(\s*Name\s*\))?|Name)\s*[:：]?\s*([^\s｜|]+)/i);
  return {academicYear:year?.[1]||"",semester:semester?.[1]||"",studentId:studentId?.[1]||"",studentName:studentName?.[1]||""};
}

function findGradeTable(tables){
  for(const rows of tables){
    const headerIndex=rows.findIndex(row=>row.some(cell=>/課號|Course\s*ID/i.test(cell))&&row.some(cell=>/課名|Course\s*Title/i.test(cell)));
    if(headerIndex>=0)return {rows,headerIndex};
  }
  return null;
}

function parseGradeClipboard(html,plain){
  const tables=gradeRowsFromClipboard(html,plain);
  const target=findGradeTable(tables);
  if(!target)throw new Error("沒有辨識到成績表格，請重新圈選包含欄位標題與成績內容的範圍再複製。");
  const header=target.rows[target.headerIndex];
  const type=header.some(cell=>/期中成績|Mid\s*Term/i.test(cell))?"midterm":"semester";
  const courseIdIndex=gradeHeaderIndex(header,[/課號/i,/Course\s*ID/i]);
  const courseNameIndex=gradeHeaderIndex(header,[/^\s*課名/i]);
  const unitsIndex=gradeHeaderIndex(header,[/學分/i,/Units?/i]);
  const selectionIndex=gradeHeaderIndex(header,[/選別/i,/Required|Elective/i]);
  const classIndex=gradeHeaderIndex(header,[/班別/i,/Class/i]);
  const midtermIndex=gradeHeaderIndex(header,[/期中成績/i,/Mid\s*Term/i]);
  const finalIndex=gradeHeaderIndex(header,[/學期成績/i,/Final/i]);
  const scoreIndex=gradeHeaderIndex(header,[/^\s*成績/i,/Score/i]);
  if(courseIdIndex<0||courseNameIndex<0)throw new Error("成績欄位不完整，請將課號與課名欄位一起圈選複製。");
  const courses=target.rows.slice(target.headerIndex+1).map(row=>({
    courseId:(row[courseIdIndex]||"").replace(/\s+/g," ").trim(),
    courseName:cleanChineseCourseName(row[courseNameIndex]||""),
    className:classIndex>=0?cleanChineseValue(row[classIndex]):"",
    selection:selectionIndex>=0?cleanChineseValue(row[selectionIndex]):"",
    units:unitsIndex>=0?(row[unitsIndex]||"").trim():"",
    midterm:midtermIndex>=0?(row[midtermIndex]||"").trim():"",
    final:finalIndex>=0?(row[finalIndex]||"").trim():"",
    score:scoreIndex>=0?(row[scoreIndex]||"").trim():""
  })).filter(course=>course.courseId&&!/課號|Course\s*ID/i.test(course.courseId)&&course.courseName);
  if(!courses.length)throw new Error("已找到成績欄位，但沒有辨識到課程內容；請確認圈選範圍包含課程資料列。");
  const result={type,courses,...gradeMetadata(plain||timetablePlainText(html))};
  if(type==="semester"){
    const summaryHeaders=["共修學分","實得學分","未過學分","總分","平均","操行","名次"];
    const summary={};
    for(const rows of tables){
      const index=rows.findIndex(row=>summaryHeaders.filter(label=>row.some(cell=>cell.includes(label))).length>=3);
      if(index<0)continue;
      const values=rows[index+1]||[];
      summaryHeaders.forEach((label,position)=>{
        const column=rows[index].findIndex(cell=>cell.includes(label));
        summary[["totalUnits","earnedUnits","failedUnits","totalScore","average","conduct","rank"][position]]=column>=0?(values[column]||"").trim():"";
      });
      break;
    }
    Object.assign(result,{totalUnits:"",earnedUnits:"",failedUnits:"",totalScore:"",average:"",conduct:"",rank:""},summary);
  }
  return result;
}

function renderGradePreview(data){
  $("gradeMeta").textContent=`${data.academicYear||"未辨識"}學年第${data.semester||"未辨識"}學期　學號：${data.studentId||"未辨識"}　姓名：${data.studentName||"未辨識"}　｜　${data.type==="midterm"?"期中成績":"學期成績"}`;
  const headers=data.type==="midterm"?["課號","課名","班別","選別","學分","期中成績","學期成績"]:["課號","課名","學分","選別","成績"];
  const fields=data.type==="midterm"?["courseId","courseName","className","selection","units","midterm","final"]:["courseId","courseName","units","selection","score"];
  $("gradePreviewHead").innerHTML=`<tr>${headers.map(header=>`<th>${header}</th>`).join("")}</tr>`;
  $("gradePreviewBody").innerHTML=data.courses.map(course=>`<tr>${fields.map(field=>`<td>${gradeEscape(course[field]||"")}</td>`).join("")}</tr>`).join("");
  if(data.type==="semester"){
    $("gradeSummaryBody").innerHTML=`<tr>${["totalUnits","earnedUnits","failedUnits","totalScore","average","conduct","rank"].map(field=>`<td>${gradeEscape(data[field]||"")}</td>`).join("")}</tr>`;
    $("gradeSummaryWrap").classList.remove("hidden");
  }else $("gradeSummaryWrap").classList.add("hidden");
  $("gradePreview").classList.remove("hidden");
}

$("openGradeBtn").onclick=()=>showPage("grade");
$("gradePaste").addEventListener("paste",event=>{
  event.preventDefault();
  gradeClipboardHtml=event.clipboardData?.getData("text/html")||"";
  gradeClipboardText=event.clipboardData?.getData("text/plain")||timetablePlainText(gradeClipboardHtml);
  $("gradePaste").textContent=gradeClipboardText;
  $("gradeStatus").textContent="已貼上內容，請按「格式優化」。";
  $("gradeStatus").classList.remove("error");
  $("gradePreview").classList.add("hidden");parsedGrade=null;
});
$("parseGradeBtn").onclick=()=>{
  const status=$("gradeStatus");status.classList.remove("error");
  try{
    parsedGrade=parseGradeClipboard(gradeClipboardHtml,gradeClipboardText||$("gradePaste").innerText);
    renderGradePreview(parsedGrade);
    status.textContent=`已辨識為${parsedGrade.type==="midterm"?"期中":"學期"}成績，共 ${parsedGrade.courses.length} 門課。`;
  }catch(error){parsedGrade=null;$("gradePreview").classList.add("hidden");status.textContent=error.message;status.classList.add("error");}
};
$("clearGradeBtn").onclick=()=>{gradeClipboardHtml="";gradeClipboardText="";parsedGrade=null;$("gradePaste").textContent="";$("gradeStatus").textContent="";$("gradePreview").classList.add("hidden");};
$("downloadGradeBtn").onclick=async()=>{
  if(!parsedGrade){alert("請先貼上成績並完成格式優化。");return;}
  try{
    const template=parsedGrade.type==="midterm"?"grade-midterm-template.docx":"grade-semester-template.docx";
    const response=await fetch(`./templates/${template}?v=1.2.1`,{cache:"no-store"});
    if(!response.ok)throw new Error("無法讀取成績 Word 母版");
    const zip=new window.PizZip(await response.arrayBuffer());
    const word=new window.docxtemplater(zip,{paragraphLoop:true,linebreaks:true,nullGetter:()=>""});
    word.render(parsedGrade);
    const blob=word.getZip().generate({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    const safe=(parsedGrade.studentName||parsedGrade.studentId||"未命名").replace(/[\\/:*?"<>|]/g,"_");
    saveAs(blob,`${safe}_${parsedGrade.type==="midterm"?"期中":"學期"}成績.docx`);
  }catch(error){console.error(error);alert(`Word 產生失敗：${error?.message||error}`);}
};

// ISP 簽收表：一次解析多份整理後課表，所有資料只留在目前頁面記憶體。
let receiptStudents=[];
const WORD_NS="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const receiptClassPattern=/(四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己]/;

function maskReceiptStudentName(name){
  const chars=Array.from((name||"").trim());
  if(chars.length<2)return name||"";
  return `${chars[0]}○${chars.slice(2).join("")}`;
}

function wordNodeText(node){
  let output="";
  for(const child of node.childNodes||[]){
    if(child.localName==="t")output+=child.textContent||"";
    else if(child.localName==="br"||child.localName==="cr")output+="\n";
    else{
      output+=wordNodeText(child);
      if(child.localName==="p")output+="\n";
    }
  }
  return output.replace(/\u00a0/g," ");
}

function parseReceiptCourseCell(cell){
  const lines=wordNodeText(cell).split(/\r?\n/).map(line=>line.replace(/\s+/g," ").trim()).filter(Boolean);
  const classIndex=lines.findIndex(line=>receiptClassPattern.test(line));
  if(classIndex<1)return null;
  const className=lines[classIndex].match(receiptClassPattern)?.[0]||lines[classIndex];
  const trailing=lines.slice(classIndex+1);
  let teacher=trailing.find(line=>line&&!/教室|樓|館|校區|實驗室/.test(line))||"";
  if(!teacher){
    for(const line of trailing){
      const split=splitTimetableTeacherLocation(line);
      if(split.length>1&&split[0]&&!/教室|樓|館|校區|實驗室/.test(split[0])){teacher=split[0];break;}
    }
  }
  const courseName=lines.slice(0,classIndex).join("－").replace(/－{2,}/g,"－");
  if(!courseName)return null;
  return {courseName,className,teacher};
}

async function parseReceiptTimetableFile(file){
  const zip=new window.PizZip(await file.arrayBuffer());
  const xmlFile=zip.file("word/document.xml");
  if(!xmlFile)throw new Error("不是可辨識的 Word 課表");
  const xml=new DOMParser().parseFromString(xmlFile.asText(),"application/xml");
  if(xml.getElementsByTagName("parsererror").length)throw new Error("Word 內容無法讀取");
  const allText=[...xml.getElementsByTagNameNS(WORD_NS,"t")].map(node=>node.textContent||"").join(" ").replace(/\s+/g," ");
  const paragraphTexts=[...xml.getElementsByTagNameNS(WORD_NS,"p")].map(node=>wordNodeText(node).replace(/\s+/g," ").trim()).filter(Boolean);
  const studentInfoText=paragraphTexts.find(text=>/學號/.test(text)&&/姓名/.test(text))||allText;
  const academic=allText.match(/(\d{2,3})\s*學年[\s\S]{0,30}?第?\s*([123])\s*學期/);
  const id=studentInfoText.match(/學號\s*(?:\(\s*Std\.?\s*ID\s*\))?\s*[:：]?\s*([A-Za-z]\d{7,12}|\d{7,12})/i);
  const name=studentInfoText.match(/姓名\s*(?:\(\s*Name\s*\))?\s*[:：]?\s*([\u3400-\u9fff○〇]{2,10})/i);
  const classInfo=studentInfoText.match(/班級\s*[:：]?\s*((?:四技|二技|五專|二專|進修(?:部)?|碩士|碩研|博士)[\u3400-\u9fffA-Za-z0-9()（）／/、_-]*?[甲乙丙丁戊己])/);
  const tables=[...xml.getElementsByTagNameNS(WORD_NS,"tbl")];
  if(!tables.length)throw new Error("找不到課表表格");
  const rows=[...tables[0].getElementsByTagNameNS(WORD_NS,"tr")];
  const courses=[];
  const seen=new Set();
  rows.slice(1).forEach(row=>{
    const cells=[...row.childNodes].filter(node=>node.localName==="tc");
    cells.slice(1).forEach(cell=>{
      const course=parseReceiptCourseCell(cell);
      if(!course)return;
      const key=`${course.courseName}|${course.className}|${course.teacher}`;
      if(!seen.has(key)){seen.add(key);courses.push(course);}
    });
  });
  if(!courses.length)throw new Error("沒有辨識到課程資料");
  const courseClasses=[...new Set(courses.map(course=>course.className).filter(Boolean))];
  const explicitClass=(classInfo?.[1]||"").trim();
  const inferredClass=!explicitClass&&courseClasses.length===1?courseClasses[0]:"";
  return {
    key:id?.[1]||`${name?.[1]||file.name}-${file.size}`,
    fileName:file.name,
    academicYear:academic?.[1]||"",
    semester:academic?.[2]||"",
    studentId:id?.[1]||"",
    studentName:(name?.[1]||"").replace(/[｜|].*$/,"").trim(),
    studentClass:explicitClass||inferredClass,
    classSource:explicitClass?"document":inferredClass?"inferred":"missing",
    courses
  };
}

function receiptStudentStatus(student){
  if(!student.studentName)return {type:"error",text:"學生姓名未辨識"};
  if(student.courses.some(course=>!course.teacher))return {type:"error",text:"任課老師未辨識"};
  if(!student.studentClass)return {type:"warning",text:"班級待確認"};
  if(student.classSource==="inferred")return {type:"warning",text:"班級為推測值"};
  return {type:"ok",text:"辨識完成"};
}

function renderReceiptReview(){
  const body=$("receiptReviewBody");body.innerHTML="";
  receiptStudents.forEach(student=>{
    const teachers=new Set(student.courses.map(course=>course.teacher).filter(Boolean));
    const status=receiptStudentStatus(student);
    const row=document.createElement("tr");
    row.innerHTML=`<td>${gradeEscape(student.fileName)}</td><td>${gradeEscape(maskReceiptStudentName(student.studentName)||"未辨識")}</td><td><input class="receipt-class-input" value="${gradeEscape(student.studentClass)}" aria-label="${gradeEscape(student.studentName)}的班級"></td><td>${student.courses.length}</td><td>${teachers.size}</td><td><span class="receipt-state ${status.type}">${status.text}</span></td><td><button type="button" class="delete-doc receipt-remove">移除</button></td>`;
    row.querySelector(".receipt-class-input").addEventListener("change",event=>{student.studentClass=event.target.value.trim();student.classSource="manual";renderReceiptReview();});
    row.querySelector(".receipt-remove").onclick=()=>{receiptStudents=receiptStudents.filter(item=>item!==student);renderReceiptReview();};
    body.appendChild(row);
  });
  const years=[...new Set(receiptStudents.map(item=>item.academicYear).filter(Boolean))];
  const semesters=[...new Set(receiptStudents.map(item=>item.semester).filter(Boolean))];
  if(!$('receiptAcademicYear').value&&years.length)$('receiptAcademicYear').value=years[0];
  if(semesters.length===1)$('receiptSemester').value=semesters[0];
  const issues=[];
  if(years.length>1)issues.push(`包含不同學年度：${years.join("、")}`);
  if(semesters.length>1)issues.push(`包含不同學期：${semesters.join("、")}`);
  const pending=receiptStudents.filter(item=>receiptStudentStatus(item).type!=="ok").length;
  if(pending)issues.push(`有 ${pending} 位學生需要確認`);
  $("receiptWarning").textContent=issues.join("；");
  $("receiptWarning").classList.toggle("hidden",!issues.length);
  $("receiptReview").classList.toggle("hidden",!receiptStudents.length);
}

async function readReceiptFiles(){
  const files=[...$("receiptFiles").files];
  const status=$("receiptStatus");status.classList.remove("error");
  if(!files.length){status.textContent="請先選取整理後的 Word 課表。";status.classList.add("error");return;}
  const parsed=[];const errors=[];
  for(const file of files){
    status.textContent=`正在讀取 ${file.name}…`;
    try{parsed.push(await parseReceiptTimetableFile(file));}
    catch(error){errors.push(`${file.name}：${error.message}`);}
  }
  const unique=new Map(receiptStudents.map(item=>[item.key,item]));
  parsed.forEach(item=>unique.set(item.key,item));
  receiptStudents=[...unique.values()];
  renderReceiptReview();
  status.textContent=`完成讀取 ${parsed.length} 份課表，目前共有 ${receiptStudents.length} 位學生。${errors.length?` ${errors.length} 份失敗：${errors.join("；")}`:""}`;
  status.classList.toggle("error",Boolean(errors.length));
}

function receiptExportData(){
  const academicYear=$("receiptAcademicYear").value.trim();
  const semester=$("receiptSemester").value;
  if(!receiptStudents.length)throw new Error("請先匯入課表");
  if(!academicYear)throw new Error("請填寫學年度");
  const missingClass=receiptStudents.filter(item=>!item.studentClass);
  if(missingClass.length)throw new Error(`仍有 ${missingClass.length} 位學生缺少班級`);
  const missingTeacher=receiptStudents.flatMap(item=>item.courses.filter(course=>!course.teacher));
  if(missingTeacher.length)throw new Error("仍有課程缺少任課老師，請重新確認課表");
  return {academicYear,semester,students:receiptStudents};
}

const receiptThinBorder={top:{style:"thin",color:{argb:"FF000000"}},left:{style:"thin",color:{argb:"FF000000"}},bottom:{style:"thin",color:{argb:"FF000000"}},right:{style:"thin",color:{argb:"FF000000"}}};
function styleReceiptRange(sheet,fromRow,toRow,fromCol,toCol,{fill=null,bold=false,size=12}={}){
  for(let row=fromRow;row<=toRow;row++)for(let col=fromCol;col<=toCol;col++){
    const cell=sheet.getCell(row,col);
    cell.font={name:"標楷體",size,bold};
    cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
    cell.border=receiptThinBorder;
    if(fill)cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:fill}};
  }
}
function setupReceiptSheet(sheet){
  sheet.pageSetup={paperSize:9,orientation:"portrait",fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.35,right:0.35,top:0.45,bottom:0.45,header:0.2,footer:0.2}};
  sheet.properties.defaultRowHeight=24;
  sheet.views=[{showGridLines:false}];
}
function uniqueReceiptSheetName(name,used){
  const base=(name||"未命名").replace(/[\\/?*\[\]:]/g,"_").slice(0,31)||"未命名";
  let result=base,index=2;
  while(used.has(result)){const suffix=`_${index++}`;result=`${base.slice(0,31-suffix.length)}${suffix}`;}
  used.add(result);return result;
}

async function buildTeacherReceiptWorkbook(data){
  const workbook=new window.ExcelJS.Workbook();
  workbook.creator="明新科技大學資源教室";
  const byTeacher=new Map();
  data.students.forEach(student=>student.courses.forEach(course=>{
    if(!byTeacher.has(course.teacher))byTeacher.set(course.teacher,[]);
    const rows=byTeacher.get(course.teacher);
    const key=`${course.courseName}|${student.studentClass}|${student.key}`;
    if(!rows.some(item=>item.key===key))rows.push({key,courseName:course.courseName,studentClass:student.studentClass,studentName:maskReceiptStudentName(student.studentName)});
  }));
  const used=new Set();
  [...byTeacher.entries()].sort(([a],[b])=>a.localeCompare(b,"zh-Hant")).forEach(([teacher,records])=>{
    const sheet=workbook.addWorksheet(uniqueReceiptSheetName(teacher,used));setupReceiptSheet(sheet);
    sheet.columns=[{width:18},{width:18},{width:18},{width:18},{width:20}];
    sheet.mergeCells("A1:A2");sheet.mergeCells("B1:B2");sheet.mergeCells("C1:E2");
    sheet.getCell("A1").value=`${data.academicYear}學年度`;sheet.getCell("B1").value=data.semester==="3"?"暑期":`第${data.semester}學期`;sheet.getCell("C1").value="個別化支持計畫（ISP）簽收單";
    styleReceiptRange(sheet,1,2,1,5,{bold:true,size:14});sheet.getRow(1).height=30;sheet.getRow(2).height=30;
    sheet.getCell("A7").value="致：";sheet.getCell("B7").value=teacher;sheet.getCell("C7").value="老師";
    ["A7","B7","C7"].forEach(address=>{const cell=sheet.getCell(address);cell.font={name:"標楷體",size:12,bold:true};cell.alignment={horizontal:"center",vertical:"middle"};});
    sheet.mergeCells("A10:C11");sheet.mergeCells("D10:D11");sheet.mergeCells("E10:E11");
    sheet.getCell("A10").value="課程";sheet.getCell("D10").value="班級";sheet.getCell("E10").value="學生";styleReceiptRange(sheet,10,11,1,5,{fill:"FFD9EAF7",bold:true});
    const sorted=[...records].sort((a,b)=>`${a.courseName}|${a.studentClass}|${a.studentName}`.localeCompare(`${b.courseName}|${b.studentClass}|${b.studentName}`,"zh-Hant"));
    let row=12;
    sorted.forEach(record=>{sheet.getCell(row,1).value=record.courseName;sheet.getCell(row,4).value=record.studentClass;sheet.getCell(row,5).value=record.studentName;styleReceiptRange(sheet,row,row,1,5);sheet.getRow(row).height=30;row++;});
    let groupStart=12;
    for(let index=1;index<=sorted.length;index++){
      const previous=sorted[index-1],current=sorted[index];
      if(index===sorted.length||current.courseName!==previous.courseName||current.studentClass!==previous.studentClass){
        const groupEnd=11+index;
        sheet.mergeCells(groupStart,1,groupEnd,3);
        if(groupEnd>groupStart)sheet.mergeCells(groupStart,4,groupEnd,4);
        groupStart=groupEnd+1;
      }
    }
    sheet.getCell(row+2,3).value="老師簽名：";sheet.mergeCells(row+2,4,row+2,5);styleReceiptRange(sheet,row+2,row+2,3,5,{bold:true});sheet.getRow(row+2).height=36;
    sheet.pageSetup.printArea=`A1:E${row+2}`;
  });
  return workbook;
}

async function buildStudentReceiptWorkbook(data){
  const workbook=new window.ExcelJS.Workbook();
  workbook.creator="明新科技大學資源教室";
  const used=new Set();
  [...data.students].sort((a,b)=>a.studentName.localeCompare(b.studentName,"zh-Hant")).forEach(student=>{
    const masked=maskReceiptStudentName(student.studentName);
    const sheet=workbook.addWorksheet(uniqueReceiptSheetName(masked,used));setupReceiptSheet(sheet);
    sheet.columns=[{width:8},{width:18},{width:18},{width:18},{width:18},{width:18}];
    sheet.mergeCells("A1:B2");sheet.mergeCells("C1:C2");sheet.mergeCells("D1:F2");
    sheet.getCell("A1").value=`${data.academicYear}學年度`;sheet.getCell("C1").value=data.semester==="3"?"暑期":`第${data.semester}學期`;sheet.getCell("D1").value="個別化支持計畫（ISP）簽收單";
    styleReceiptRange(sheet,1,2,1,6,{bold:true,size:14});sheet.getRow(1).height=30;sheet.getRow(2).height=30;
    sheet.getCell("A4").value="班級：";sheet.getCell("B4").value=student.studentClass;sheet.getCell("C4").value="學生：";sheet.getCell("D4").value=masked;
    for(let col=1;col<=4;col++){const cell=sheet.getCell(4,col);cell.font={name:"標楷體",size:12,bold:true};cell.alignment={horizontal:"center",vertical:"middle"};}
    sheet.mergeCells("A7:A8");sheet.mergeCells("B7:D8");sheet.mergeCells("E7:E8");sheet.mergeCells("F7:F8");
    sheet.getCell("A7").value="序號";sheet.getCell("B7").value="課程";sheet.getCell("E7").value="授課教師";sheet.getCell("F7").value="簽收";styleReceiptRange(sheet,7,8,1,6,{fill:"FFD9EAF7",bold:true});
    const byTeacher=new Map();
    student.courses.forEach(course=>{if(!byTeacher.has(course.teacher))byTeacher.set(course.teacher,[]);const list=byTeacher.get(course.teacher);if(!list.includes(course.courseName))list.push(course.courseName);});
    let row=9,index=1;
    [...byTeacher.entries()].sort(([a],[b])=>a.localeCompare(b,"zh-Hant")).forEach(([teacher,courses])=>{
      sheet.getCell(row,1).value=index++;sheet.mergeCells(row,2,row,4);sheet.getCell(row,2).value=courses.join("\n");sheet.getCell(row,5).value=teacher;sheet.getCell(row,6).value="";styleReceiptRange(sheet,row,row,1,6);sheet.getRow(row).height=Math.max(30,courses.length*22);row++;
    });
    sheet.pageSetup.printArea=`A1:F${Math.max(row-1,9)}`;
  });
  return workbook;
}

async function saveReceiptWorkbook(workbook,fileName){
  if(!window.ExcelJS)throw new Error("Excel 元件載入失敗，請重新整理頁面後再試");
  const buffer=await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),fileName);
}

$("openIspReceiptBtn").onclick=()=>showPage("ispReceipt");
$("parseReceiptFilesBtn").onclick=readReceiptFiles;
$("clearReceiptFilesBtn").onclick=()=>{receiptStudents=[];$("receiptFiles").value="";$("receiptStatus").textContent="";$("receiptAcademicYear").value="";$("receiptReview").classList.add("hidden");};
$("downloadTeacherReceiptBtn").onclick=async()=>{try{const data=receiptExportData();await saveReceiptWorkbook(await buildTeacherReceiptWorkbook(data),`${data.academicYear}-${data.semester}_ISP簽收單_以老師為主.xlsx`);}catch(error){alert(error.message);}};
$("downloadStudentReceiptBtn").onclick=async()=>{try{const data=receiptExportData();await saveReceiptWorkbook(await buildStudentReceiptWorkbook(data),`${data.academicYear}-${data.semester}_ISP簽收單_以學生為主.xlsx`);}catch(error){alert(error.message);}};
