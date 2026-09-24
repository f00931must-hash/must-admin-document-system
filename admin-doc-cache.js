import { getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const db=getFirestore(getApp());
const TTL_MS=1500;
const cache=new Map();
const inflight=new Map();
const norm=v=>String(v??"").trim().toLowerCase();

async function getOwnerDocs(ownerEmail,{force=false}={}){
  const owner=norm(ownerEmail);
  if(!owner)return [];
  const now=Date.now();
  const hit=cache.get(owner);
  if(!force&&hit&&now-hit.time<TTL_MS)return hit.docs.map(x=>({...x}));
  if(!force&&inflight.has(owner))return (await inflight.get(owner)).map(x=>({...x}));

  const task=(async()=>{
    const snap=await getDocs(query(collection(db,"adminDocuments"),where("ownerEmail","==",owner)));
    const docs=snap.docs.map(d=>({id:d.id,...d.data()}));
    cache.set(owner,{time:Date.now(),docs});
    return docs;
  })().finally(()=>inflight.delete(owner));

  inflight.set(owner,task);
  return (await task).map(x=>({...x}));
}

function invalidate(ownerEmail){
  const owner=norm(ownerEmail);
  if(owner)cache.delete(owner);
  else cache.clear();
}

window.__adminDocumentsCache={getOwnerDocs,invalidate,ttl:TTL_MS};
console.log("Admin documents shared read cache v1.0.0 loaded");
