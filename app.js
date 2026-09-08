const STORAGE_KEY = "job-applications-v1";
const STATUSES = ["准备投递", "已投递", "笔试", "面试", "Offer", "已拒绝", "已撤回"];
const ACTIVE_STATUSES = new Set(["已投递", "笔试", "面试"]);
const $ = (selector) => document.querySelector(selector);
const applicationsElement = $("#applications");
const emptyState = $("#empty-state");
const dialog = $("#application-dialog");
const form = $("#application-form");
let applications = loadApplications();

function isValidApplication(item) {
  return item && typeof item.id === "string" && typeof item.company === "string" && typeof item.role === "string" && STATUSES.includes(item.status) && /^\d{4}-\d{2}-\d{2}$/.test(item.appliedAt);
}
function loadApplications() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value.filter(isValidApplication) : []; } catch { return []; }
}
function saveApplications() { localStorage.setItem(STORAGE_KEY, JSON.stringify(applications)); }
function formatDate(value) { if (!value) return "—"; const [year, month, day] = value.split("-"); return `${year}/${month}/${day}`; }
function filteredApplications() {
  const query = $("#search").value.trim().toLocaleLowerCase("zh-CN");
  const status = $("#status-filter").value;
  const result = applications.filter((item) => (!query || `${item.company} ${item.role} ${item.contact || ""}`.toLocaleLowerCase("zh-CN").includes(query)) && (!status || item.status === status));
  const compare = {"updated-desc":(a,b)=>b.updatedAt.localeCompare(a.updatedAt),"applied-desc":(a,b)=>b.appliedAt.localeCompare(a.appliedAt),"applied-asc":(a,b)=>a.appliedAt.localeCompare(b.appliedAt),"company-asc":(a,b)=>a.company.localeCompare(b.company,"zh-CN")}[$("#sort").value];
  return result.sort(compare);
}
function render() {
  applicationsElement.replaceChildren();
  const items = filteredApplications();
  for (const item of items) {
    const card = $("#card-template").content.cloneNode(true);
    card.querySelector(".status-badge").textContent = item.status; card.querySelector(".company").textContent = item.company; card.querySelector(".role").textContent = item.role;
    card.querySelector(".applied-date").textContent = formatDate(item.appliedAt); card.querySelector(".next-date").textContent = formatDate(item.nextActionAt); card.querySelector(".contact").textContent = item.contact || "—";
    const notes = card.querySelector(".notes"); notes.textContent = item.notes || ""; notes.hidden = !item.notes;
    const link = card.querySelector(".job-link"); link.hidden = !item.link; if (item.link) link.href = item.link;
    card.querySelector(".edit-button").addEventListener("click", () => openDialog(item)); card.querySelector(".delete-button").addEventListener("click", () => removeApplication(item)); applicationsElement.append(card);
  }
  emptyState.hidden = applications.length !== 0; applicationsElement.hidden = applications.length === 0;
  $("#result-count").textContent = applications.length ? `显示 ${items.length} / ${applications.length} 条记录` : "";
  $("#total-stat").textContent = applications.length; $("#active-stat").textContent = applications.filter((item)=>ACTIVE_STATUSES.has(item.status)).length; $("#interview-stat").textContent = applications.filter((item)=>item.status === "面试").length; $("#offer-stat").textContent = applications.filter((item)=>item.status === "Offer").length;
}
function openDialog(item = null) {
  form.reset(); $("#form-error").textContent = ""; $("#dialog-title").textContent = item ? "编辑投递" : "新增投递"; $("#record-id").value = item?.id || "";
  $("#company").value=item?.company||""; $("#role").value=item?.role||""; $("#status").value=item?.status||"已投递"; $("#applied-at").value=item?.appliedAt||new Date().toISOString().slice(0,10);
  $("#next-action-at").value=item?.nextActionAt||""; $("#contact").value=item?.contact||""; $("#link").value=item?.link||""; $("#notes").value=item?.notes||""; dialog.showModal(); $("#company").focus();
}
function removeApplication(item) { if (!confirm(`确定删除 ${item.company} 的 ${item.role} 记录吗？`)) return; applications=applications.filter((candidate)=>candidate.id!==item.id); saveApplications(); render(); }
const formValue = (id) => $(id).value.trim();
function saveFromForm(event) {
  event.preventDefault(); if (!form.reportValidity()) return; const id=formValue("#record-id"); const now=new Date().toISOString(); const existing=applications.find((item)=>item.id===id);
  const item={id:id||crypto.randomUUID(),company:formValue("#company"),role:formValue("#role"),status:formValue("#status"),appliedAt:formValue("#applied-at"),nextActionAt:formValue("#next-action-at"),contact:formValue("#contact"),link:formValue("#link"),notes:formValue("#notes"),createdAt:existing?.createdAt||now,updatedAt:now};
  if (!isValidApplication(item)) { $("#form-error").textContent="请检查必填字段。"; return; }
  applications=existing?applications.map((candidate)=>candidate.id===id?item:candidate):[...applications,item]; saveApplications(); dialog.close(); render();
}
function exportBackup() { const blob=new Blob([JSON.stringify(applications,null,2)],{type:"application/json"}); const link=document.createElement("a"); link.href=URL.createObjectURL(blob); link.download=`job-applications-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(link.href); }
async function importBackup(file) {
  if (!file) return; try { const value=JSON.parse(await file.text()); if (!Array.isArray(value)||!value.every(isValidApplication)) throw new Error("invalid"); if (!confirm(`导入将替换现有 ${applications.length} 条记录，继续吗？`)) return; applications=value; saveApplications(); render(); } catch { alert("无法导入：请选择由本站导出的有效 JSON 备份。文件不能包含无效记录。"); } finally { $("#import-file").value=""; }
}
for (const status of STATUSES) { $("#status").add(new Option(status,status)); $("#status-filter").add(new Option(status,status)); }
$("#add-button").addEventListener("click",()=>openDialog()); $(".add-trigger").addEventListener("click",()=>openDialog()); $("#close-dialog").addEventListener("click",()=>dialog.close()); $("#cancel-dialog").addEventListener("click",()=>dialog.close()); form.addEventListener("submit",saveFromForm);
for (const id of ["#search","#status-filter","#sort"]) $(id).addEventListener("input",render);
$("#export-button").addEventListener("click",exportBackup); $("#import-button").addEventListener("click",()=>$("#import-file").click()); $("#import-file").addEventListener("change",(event)=>importBackup(event.target.files[0])); dialog.addEventListener("click",(event)=>{if(event.target===dialog)dialog.close();}); render();
