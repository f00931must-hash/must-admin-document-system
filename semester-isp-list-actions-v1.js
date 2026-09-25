import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, getDoc, getDocs, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app=getApp(),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
const norm=v=>String(v??"").trim();
const normName=v=>norm(v).replace(/[\s　]+/g,"");
let ownerEmail="",role="",records=[],baseIspRecords=[];

function rocToday(){
  const d=new Date();
  return `${d.getFullYear()-1911}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}`;
}
async function resolveAccess(){
  const user=auth.currentUser;if(!user?.email)return;
  const email=norm(user.email).toLowerCase();
  try{
    const s=await getDoc(doc(db,"settings","adminAccess"));
    const a=s.data()?.users?.[email];
    if(a?.enabled!==false&&a){
      role=a.role||"teacher";
      ownerEmail=role==="assistant"&&a.ownerEmail?norm(a.ownerEmail).toLowerCase():email;
      return;
    }
  }catch{}
  try{
    const s=await getDoc(doc(db,"administrativeAssistants",email));
    if(s.exists()&&s.data()?.enabled===true&&s.data()?.ownerEmail){
      role="assistant";ownerEmail=norm(s.data().ownerEmail).toLowerCase();return;
    }
  }catch{}
  role="teacher";ownerEmail=email;
}
async function refreshRecords(){
  if(!ownerEmail)await resolveAccess();
  if(!ownerEmail)return;
  const all=await window.__adminDocumentsCache.getOwnerDocs(ownerEmail);
  records=all.filter(x=>x.type==="SEMESTER_ISP");
  baseIspRecords=all.filter(x=>!x.type||x.type==="ISP");
}
function recordForNode(node){
  const strong=node.querySelector("strong")?.textContent||"";
  const name=strong.split("｜")[0].trim();
  const m=strong.match(/｜(.+?)學年度第(.+?)學期/);
  const year=m?.[1]||"",sem=m?.[2]||"";
  return records.find(r=>normName(r.studentName)===normName(name)&&String(r.form?.academicYear||"")===year&&String(r.form?.semester||"")===sem);
}
function nextTerm(record){
  const year=Number(record?.form?.academicYear)||0,sem=String(record?.form?.semester||"1");
  if(sem==="1")return {year:String(year||record?.form?.academicYear||""),semester:"2"};
  if(sem==="2"&&year)return {year:String(year+1),semester:"1"};
  return {year:String(year||record?.form?.academicYear||""),semester:"1"};
}
async function copyRecord(record,button){
  if(!record)return;
  button.disabled=true;
  try{
    if(window.__semesterTermNav?.copyRecord){
      const created=await window.__semesterTermNav.copyRecord(record);
      if(created){
        await refreshRecords();
        alert("已建立學期 ISP 副本；原本資料沒有修改。");
        document.querySelector('.nav[data-view="semesterIsp"]')?.click();
      }
      return;
    }
    alert("學期選擇器尚未完成載入，請重新整理頁面後再試。");
  }catch(error){
    console.error(error);
    alert("複製失敗，請確認網路或權限。");
  }finally{button.disabled=false;}
}
async function deleteRecord(record,button){
  if(!record||role==="assistant")return;
  const f=record.form||{},title=`${record.studentName||"未命名"}｜${f.academicYear||"未填"}學年度第${f.semester||"未填"}學期`;
  if(!confirm(`確定要從目前列表移除「${title}」嗎？\n\n系統會先保留安全備份，再從列表移除。`))return;
  if(!confirm(`請再次確認：要移除「${title}」這一份學期 ISP 嗎？`))return;
  button.disabled=true;
  try{
    const user=auth.currentUser;
    const {id:__removedId,...__originalData}=record;
    await addDoc(collection(db,"adminDocuments"),{
      ownerEmail,
      ownerUid:user?.uid||record.ownerUid||"",
      type:"DELETED_BACKUP",
      sourceType:"SEMESTER_ISP",
      sourceDocumentId:record.id,
      studentName:record.studentName||"",
      backupData:__originalData,
      deletedAt:serverTimestamp(),
      createdAt:serverTimestamp(),
      createdByUid:user?.uid||"",
      createdByEmail:norm(user?.email).toLowerCase()
    });
    await deleteDoc(doc(db,"adminDocuments",record.id));
    records=records.filter(x=>x.id!==record.id);
    button.closest(".doc-item")?.remove();
    alert("已從目前列表刪除；系統已先保留一份安全備份。其他學期與新生 ISP 總表沒有變動。");
  }catch(error){
    console.error(error);button.disabled=false;alert("刪除失敗，請確認帳號權限或稍後再試。");
  }
}
function enhanceList(){
  const list=$("semesterIspList");if(!list)return;
  list.querySelectorAll(".doc-item").forEach(node=>{
    if(node.classList.contains("semester-student-group"))return;
    const actions=node.querySelector(".doc-actions");if(!actions||actions.dataset.semesterActions==="1")return;
    const record=recordForNode(node);if(!record)return;
    actions.dataset.semesterActions="1";
    const copy=document.createElement("button");copy.type="button";copy.className="secondary copy-semester-doc";copy.textContent="複製";
    copy.onclick=()=>copyRecord(record,copy);
    actions.appendChild(copy);
    if(role!=="assistant"){
      const del=document.createElement("button");del.type="button";del.className="delete-doc delete-semester-doc";del.textContent="刪除";
      del.onclick=()=>deleteRecord(record,del);
      actions.appendChild(del);
    }
  });
}
function setLabelText(input,text){
  const label=input?.closest("label");if(!label)return;
  const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
  if(node)node.textContent=text;
}
function addHint(input,text,key){
  const label=input?.closest("label");if(!label||label.querySelector(`[data-semester-hint="${key}"]`))return;
  const small=document.createElement("small");small.dataset.semesterHint=key;small.className="field-hint";small.textContent=text;
  small.style.cssText="display:block;margin-top:6px;color:#8a94a6;font-size:12px;font-weight:400";
  label.appendChild(small);
}
function enhanceEditor(){
  const form=$("semesterIspForm");if(!form)return;
  const year=form.elements.academicYear,dept=form.elements.department,studentClass=form.elements.studentClass;
  setLabelText(year,"學年度");
  setLabelText(dept,"科系");
  setLabelText(studentClass,"班級");
  addHint(dept,"不用輸入「系」字，例如：旅廚","department");
  addHint(studentClass,"只填班級，不要輸入系別，例如：一甲","studentClass");
  const oldExample=form.querySelector(".student-class-example");if(oldExample)oldExample.remove();
  addHint(year,"ISP學年度（非入學）","academicYear");
}
async function apply(){
  await resolveAccess();await refreshRecords();enhanceEditor();enhanceList();
}
const observer=new MutationObserver(()=>{enhanceEditor();enhanceList();});
if($("semesterIspList"))observer.observe($("semesterIspList"),{childList:true,subtree:true});
if($("semesterIspForm"))observer.observe($("semesterIspForm"),{childList:true,subtree:true});
auth.onAuthStateChanged?.(()=>{});
setTimeout(apply,0);
document.addEventListener("click",event=>{
  if(event.target.closest?.('.nav[data-view="semesterIsp"],#newSemesterIspBtn,#newSemesterIspListBtn,.open-semester-doc'))setTimeout(()=>{refreshRecords().then(()=>{enhanceEditor();enhanceList();});},150);
},true);
console.log("Semester ISP list actions/copy v1.2.0 loaded");
