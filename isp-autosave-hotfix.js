import { getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, doc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const AUTOSAVE_DELAY_MS = 1800;
let dirty = false;
let saving = false;
let manualSaving = false;
let manualSnapshotVersion = 0;
let changeVersion = 0;
let autosaveTimer = null;
let cachedAccess = null;
let cachedAccessEmail = "";

const normalizedEmail = value => String(value || "").trim().toLowerCase();

function collectFormData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.type === "submit" || el.type === "button") continue;
    if (el.type === "checkbox") {
      if (!data[el.name]) data[el.name] = [];
      if (el.checked) data[el.name].push(el.value);
    } else if (el.type === "radio") {
      if (el.checked) data[el.name] = el.value;
      else if (!(el.name in data)) data[el.name] = "";
    } else {
      data[el.name] = el.value;
    }
  }
  return data;
}

function ensureStatusElement() {
  let el = document.getElementById("ispAutosaveStatus");
  if (el) return el;
  const head = document.querySelector("#ispEditor .sticky-head");
  if (!head) return null;
  el = document.createElement("div");
  el.id = "ispAutosaveStatus";
  el.setAttribute("aria-live", "polite");
  el.style.cssText = "margin-left:auto;margin-right:12px;padding:7px 11px;border-radius:999px;font-size:13px;font-weight:700;background:#eef2f7;color:#475569;white-space:nowrap";
  const back = document.getElementById("backBtn");
  head.insertBefore(el, back || null);
  return el;
}

function setStatus(text, state = "idle") {
  const el = ensureStatusElement();
  if (!el) return;
  const styles = {
    idle: ["#eef2f7", "#475569"],
    dirty: ["#fff7ed", "#9a3412"],
    saving: ["#eff6ff", "#1d4ed8"],
    saved: ["#ecfdf5", "#047857"],
    error: ["#fef2f2", "#b91c1c"]
  };
  const [background, color] = styles[state] || styles.idle;
  el.style.background = background;
  el.style.color = color;
  el.textContent = text;
}

async function resolveAccess(db, user) {
  const email = normalizedEmail(user?.email);
  if (!email) return null;
  if (cachedAccess && cachedAccessEmail === email) return cachedAccess;

  const baseSnap = await getDoc(doc(db, "settings", "adminAccess"));
  const baseAccess = baseSnap.data()?.users?.[email];
  if (baseAccess && baseAccess.enabled !== false) {
    cachedAccessEmail = email;
    cachedAccess = { ...baseAccess, email, ownerEmail: email };
    return cachedAccess;
  }

  const assistantSnap = await getDoc(doc(db, "administrativeAssistants", email));
  const assistantData = assistantSnap.exists() ? assistantSnap.data() : null;
  if (assistantData?.enabled === true && assistantData.ownerEmail) {
    cachedAccessEmail = email;
    cachedAccess = { ...assistantData, email, role: "assistant", ownerEmail: normalizedEmail(assistantData.ownerEmail) };
    return cachedAccess;
  }
  return null;
}

function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  if (manualSaving) return;
  autosaveTimer = setTimeout(() => saveNow("auto"), AUTOSAVE_DELAY_MS);
}

async function flush(reason = "navigation") {
  clearTimeout(autosaveTimer);
  if (manualSaving) {
    setStatus("☁️ 等待手動儲存完成…", "saving");
    return false;
  }
  if (!dirty) return true;
  const ok = await saveNow(reason);
  if (!ok && dirty) {
    setStatus("⚠️ 尚未成功儲存，已取消切換頁面", "error");
    return false;
  }
  return true;
}

function resetState() {
  clearTimeout(autosaveTimer);
  dirty = false;
  saving = false;
  manualSaving = false;
  manualSnapshotVersion = changeVersion;
  setStatus("☁️ 自動儲存已啟用", "idle");
}

window.__ispAutosave = { flush, reset: resetState };

async function saveNow(reason = "auto") {
  const form = document.getElementById("ispForm");
  const docIdEl = document.getElementById("docId");
  if (!form || !docIdEl || saving || manualSaving || !dirty) return false;
  if (!getApps().length) return false;

  const app = getApp();
  const auth = getAuth(app);
  const db = getFirestore(app);
  const user = auth.currentUser;
  if (!user) return false;

  const snapshotVersion = changeVersion;
  const data = collectFormData(form);
  if (!String(data.studentName || "").trim() && !docIdEl.value) {
    setStatus("🟡 尚未儲存（請先填姓名）", "dirty");
    return false;
  }

  saving = true;
  setStatus(reason === "auto" ? "☁️ 自動儲存中…" : "☁️ 儲存中…", "saving");
  try {
    const access = await resolveAccess(db, user);
    if (!access) throw new Error("尚未取得行政文書權限");
    const ownerEmail = access.role === "assistant" ? normalizedEmail(access.ownerEmail) : normalizedEmail(access.ownerEmail || access.email || user.email);
    const common = {
      ownerEmail,
      type: "ISP",
      studentName: String(data.studentName || "").trim(),
      studentId: String(data.studentId || "").trim(),
      form: data,
      updatedAt: serverTimestamp(),
      lastEditorUid: user.uid,
      lastEditorEmail: normalizedEmail(user.email)
    };

    if (docIdEl.value) {
      await updateDoc(doc(db, "adminDocuments", docIdEl.value), common);
    } else {
      const payload = {
        ...common,
        ownerUid: user.uid,
        createdByUid: user.uid,
        createdByEmail: normalizedEmail(user.email),
        createdAt: serverTimestamp()
      };
      const ref = await addDoc(collection(db, "adminDocuments"), payload);
      docIdEl.value = ref.id;
    }

    if (changeVersion === snapshotVersion) {
      dirty = false;
      clearTimeout(autosaveTimer);
      const t = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      setStatus(`✅ 已自動儲存 ${t}`, "saved");
    } else {
      setStatus("🟡 有新修改，等待自動儲存", "dirty");
      scheduleAutosave();
    }
    return true;
  } catch (error) {
    console.error("ISP autosave failed", error);
    setStatus("⚠️ 自動儲存失敗，請按『儲存草稿』", "error");
    return false;
  } finally {
    saving = false;
  }
}

function markDirty() {
  dirty = true;
  changeVersion += 1;
  setStatus("🟡 尚未儲存", "dirty");
  scheduleAutosave();
}

function initAutosave() {
  const form = document.getElementById("ispForm");
  if (!form) return;
  ensureStatusElement();
  setStatus("☁️ 自動儲存已啟用", "idle");

  form.addEventListener("input", markDirty, true);
  form.addEventListener("change", markDirty, true);

  document.addEventListener("isp:manual-save-start", () => {
    clearTimeout(autosaveTimer);
    manualSaving = true;
    manualSnapshotVersion = changeVersion;
    setStatus("☁️ 手動儲存中…", "saving");
  });

  document.addEventListener("isp:manual-save-success", () => {
    manualSaving = false;
    if (changeVersion === manualSnapshotVersion) {
      dirty = false;
      const t = new Date().toLocaleTimeString("zh-TW", { hour12: false });
      setStatus(`✅ 已儲存 ${t}`, "saved");
    } else {
      dirty = true;
      setStatus("🟡 儲存期間有新修改，等待再次自動儲存", "dirty");
      scheduleAutosave();
    }
  });

  document.addEventListener("isp:manual-save-error", () => {
    manualSaving = false;
    dirty = true;
    setStatus("⚠️ 手動儲存失敗，內容仍保留在畫面", "error");
    scheduleAutosave();
  });

  window.addEventListener("beforeunload", event => {
    if (!dirty && !saving && !manualSaving) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAutosave, { once: true });
else queueMicrotask(initAutosave);
