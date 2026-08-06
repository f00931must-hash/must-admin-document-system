import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),provider=new GoogleAuthProvider();
const $=id=>document.getElementById(id);let currentUser=null;
function showPage(id){document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden'));$(id).classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});}function esc(v){return String(v??'').replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]));}
function formData(){const f=$("ispForm"),data={};for(const el of f.elements){if(!el.name||el.type==='submit'||el.type==='button')continue;if(el.type==='checkbox'){if(!data[el.name])data[el.name]=[];if(el.checked)data[el.name].push(el.value);}else if(el.type==='radio'){if(el.checked)data[el.name]=el.value;else if(!(el.name in data))data[el.name]='';}else data[el.name]=el.value;}return data;}
function clearForm(){$("ispForm").reset();$("docId").value='';}
function fillForm(data){clearForm();$("docId").value=data.id||'';for(const el of $("ispForm").elements){if(!el.name)continue;const v=data.form?.[el.name];if(el.type==='checkbox')el.checked=Array.isArray(v)&&v.includes(el.value);else if(el.type==='radio')el.checked=v===el.value;else if(v!==undefined)el.value=v??'';}}
$("loginBtn").onclick=()=>signInWithPopup(auth,provider);$("logoutBtn").onclick=()=>signOut(auth);$("newIspBtn").onclick=()=>{clearForm();showPage('ispEditor')};$("backBtn").onclick=()=>showPage('home');
document.querySelectorAll('.nav[data-view]').forEach(btn=>btn.onclick=async()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showPage(btn.dataset.view);if(btn.dataset.view==='mine')await loadDocs();});
$("ispForm").onsubmit=async e=>{e.preventDefault();if(!currentUser)return;const form=formData();const payload={ownerUid:currentUser.uid,ownerEmail:currentUser.email||'',type:'ISP',studentName:(form.studentName||'').trim(),studentId:(form.studentId||'').trim(),form,updatedAt:serverTimestamp()};const id=$("docId").value;if(id)await updateDoc(doc(db,'adminDocuments',id),payload);else{payload.createdAt=serverTimestamp();const ref=await addDoc(collection(db,'adminDocuments'),payload);$("docId").value=ref.id;}alert('草稿已儲存');};
async function loadDocs(){if(!currentUser)return;const q=query(collection(db,'adminDocuments'),where('ownerUid','==',currentUser.uid));const snap=await getDocs(q),items=[];snap.forEach(s=>items.push({id:s.id,...s.data()}));items.sort((a,b)=>(b.updatedAt?.seconds||0)-(a.updatedAt?.seconds||0));const list=$("docList");list.innerHTML='';if(!items.length){list.innerHTML='<div class="doc-item">目前尚無行政文書。</div>';return;}for(const d of items){const div=document.createElement('div');div.className='doc-item';div.innerHTML=`<div><strong>${esc(d.studentName||'未命名')}｜ISP</strong><div class="doc-meta">${esc(d.studentId||'尚未填學號')}　第一階段資料</div></div><button class="secondary">開啟</button>`;div.querySelector('button').onclick=()=>{fillForm(d);showPage('ispEditor')};list.appendChild(div);}}
onAuthStateChanged(auth,user=>{currentUser=user;if(user){$("loginView").classList.add('hidden');$("appView").classList.remove('hidden');$("userEmail").textContent=user.email||'';}else{$("appView").classList.add('hidden');$("loginView").classList.remove('hidden');}});


function markOne(value, option){ return value===option ? "■" : "□"; }
function markMany(values, option){ return Array.isArray(values) && values.includes(option) ? "■" : "□"; }
function dateText(v){ if(!v) return ""; const p=v.split("-"); const y=Number(p[0])-1911; return `${y}年${Number(p[1])}月${Number(p[2])}日`; }
function exportData(f){
  const sys=f.schoolSystem||"";
  const adm=f.admissionMethod||"";
  return {
    ...f,
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
    strengthChecks:["舉","扔","推","拉","抓","握"].map(x=>`${markMany(f.strength,x)}${x}`).join(""),
    postureChecks:["彎腰","跪蹲","匍匐","平衡"].map(x=>`${markMany(f.posture,x)}${x}`).join(""),
    mobilityChecks:["行走","坐","立","攀登","爬行","手指運轉"].map(x=>`${markMany(f.mobility,x)}${x}`).join(""),
    communicationChecks:["口語","國語","台語","客語","手語","讀唇","筆談","其他"].map(x=>`${markMany(f.communication,x)}${x}`).join(""),
    orientationChecks:["能迅速正確辨別方位","方位辨別遲緩","不能辨別方位"].map(x=>`${markOne(f.orientation,x)}${x}`).join(""),
    motorChecks:["粗大動作","精細動作","協調動作"].map(x=>`${markMany(f.motorAbility,x)}${x}`).join(""),
    reactionChecks:["反應靈敏","反應尚可","反應遲緩"].map(x=>`${markOne(f.reaction,x)}${x}`).join("\n"),
    assistiveBlock:`${markOne(f.needAssistiveDevice,"否")}否\n${markOne(f.needAssistiveDevice,"是")}是 何種輔具：${f.assistiveDeviceType||""}`,
    emergencyPhoneBlock:`公司：${f.emergencyCompanyPhone||""}\n住家：${f.emergencyHomePhone||""}\n手機：${f.emergencyMobile||""}\nE-mail：${f.emergencyEmail||""}`,
    emergencyAddressBlock:`（${markOne(f.emergencyAddressType,"同戶籍")}同戶籍 ${markOne(f.emergencyAddressType,"公司")}公司 ${markOne(f.emergencyAddressType,"其他")}其他） ${f.emergencyAddress||""}`
  };
}
$("downloadBtn").onclick=async()=>{
  try{
    if (typeof window.PizZip === "undefined") throw new Error("Word 元件 PizZip 載入失敗，請重新整理頁面後再試");
    if (typeof window.docxtemplater === "undefined") throw new Error("Word 元件 Docxtemplater 載入失敗，請重新整理頁面後再試");
    if (typeof window.saveAs === "undefined") throw new Error("下載元件 FileSaver 載入失敗，請重新整理頁面後再試");
    const f=formData();
    const res=await fetch("./templates/ISP-template-v0.4.2.docx",{cache:"no-store"});
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
