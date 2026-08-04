import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, query, where, orderBy, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const $ = (id)=>document.getElementById(id);
let currentUser = null;

function rocSemester(d=new Date()){
  const y=d.getFullYear()-1911, m=d.getMonth()+1, day=d.getDate();
  if(m>8 || (m===8 && day>=1)) return {academicYear:y, semester:"1"};
  if(m>=3) return {academicYear:y-1, semester:"2"};
  return {academicYear:y-1, semester:"1"};
}
function showPage(id){ document.querySelectorAll('.page').forEach(x=>x.classList.add('hidden')); $(id).classList.remove('hidden'); }
function esc(v){return String(v??"").replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[s]));}

$("loginBtn").onclick=()=>signInWithPopup(auth,provider);
$("logoutBtn").onclick=()=>signOut(auth);
$("newIspBtn").onclick=()=>{
  const s=rocSemester(); $("docId").value=""; $("academicYear").value=s.academicYear; $("semester").value=s.semester;
  $("studentName").value=$("studentId").value=$("department").value=$("abilitySummary").value=""; $("gender").value=""; showPage("ispEditor");
};
$("backBtn").onclick=()=>showPage("home");

document.querySelectorAll('.nav[data-view]').forEach(btn=>btn.onclick=async()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.remove('active'));btn.classList.add('active');showPage(btn.dataset.view);if(btn.dataset.view==='mine')await loadDocs();});

$("ispForm").onsubmit=async(e)=>{
  e.preventDefault(); if(!currentUser)return;
  const payload={ownerUid:currentUser.uid,ownerEmail:currentUser.email||"",type:"ISP",academicYear:Number($("academicYear").value),semester:$("semester").value,studentName:$("studentName").value.trim(),studentId:$("studentId").value.trim(),department:$("department").value.trim(),gender:$("gender").value,abilitySummary:$("abilitySummary").value.trim(),updatedAt:serverTimestamp()};
  const id=$("docId").value;
  if(id){await updateDoc(doc(db,"adminDocuments",id),payload);}else{payload.createdAt=serverTimestamp();const ref=await addDoc(collection(db,"adminDocuments"),payload);$("docId").value=ref.id;}
  alert("草稿已儲存");
};

async function loadDocs(){
  if(!currentUser)return;
  const q=query(collection(db,"adminDocuments"),where("ownerUid","==",currentUser.uid),orderBy("updatedAt","desc"));
  const snap=await getDocs(q); const list=$("docList"); list.innerHTML="";
  if(snap.empty){list.innerHTML='<div class="doc-item">目前尚無行政文書。</div>';return;}
  snap.forEach(s=>{const d=s.data(), div=document.createElement('div');div.className='doc-item';div.innerHTML=`<div><strong>${esc(d.studentName||'未命名')}｜${esc(d.type)}</strong><div class="doc-meta">${esc(d.academicYear)}-${esc(d.semester)}　${esc(d.studentId||'')}</div></div><button class="secondary">開啟</button>`;div.querySelector('button').onclick=()=>{ $("docId").value=s.id; $("academicYear").value=d.academicYear||""; $("semester").value=d.semester||"1"; $("studentName").value=d.studentName||""; $("studentId").value=d.studentId||""; $("department").value=d.department||""; $("gender").value=d.gender||""; $("abilitySummary").value=d.abilitySummary||""; showPage("ispEditor");};list.appendChild(div);});
}

onAuthStateChanged(auth,user=>{currentUser=user;if(user){$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("userEmail").textContent=user.email||"";}else{$("appView").classList.add("hidden");$("loginView").classList.remove("hidden");}});
