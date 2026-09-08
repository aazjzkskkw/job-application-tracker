const STORAGE_KEY = "job-applications-v1";
const STATUSES = ["准备投递", "已投递", "笔试", "面试", "Offer", "已拒绝", "已撤回"];
const ACTIVE_STATUSES = new Set(["已投递", "笔试", "面试"]);
const $ = (selector) => document.querySelector(selector);
const applicationsElement = $("#applications");
const emptyState = $("#empty-state");
const dialog = $("#application-dialog");
const form = $("#application-form");
let applications = loadApplications();
let autoCompany = "";

function isHttpUrl(value) {
  if (!value) return true;
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}
function isValidApplication(item) {
  return item && typeof item.id === "string" && item.company?.trim() && item.role?.trim() && STATUSES.includes(item.status) && /^\d{4}-\d{2}-\d{2}$/.test(item.appliedAt) && isHttpUrl(item.companyUrl) && isHttpUrl(item.link);
}
function normalizeApplication(item) {
  const now = new Date().toISOString();
  return { ...item, companyUrl: typeof item.companyUrl === "string" ? item.companyUrl : "", link: typeof item.link === "string" ? item.link : "", contact: typeof item.contact === "string" ? item.contact : "", notes: typeof item.notes === "string" ? item.notes : "", nextActionAt: typeof item.nextActionAt === "string" ? item.nextActionAt : "", createdAt: item.createdAt || item.updatedAt || now, updatedAt: item.updatedAt || item.createdAt || now };
}
function loadApplications() {
  try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); return Array.isArray(value) ? value.filter(isValidApplication).map(normalizeApplication) : []; } catch { return []; }
}
function saveApplications() { localStorage.setItem(STORAGE_KEY, JSON.stringify(applications)); }
function formatDate(value) { if (!value) return "—"; const [year, month, day] = value.split("-"); return `${year}/${month}/${day}`; }
function localDate() { const date = new Date(); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-"); }
function inferCompanyName(value) {
  try {
    const labels = new URL(value).hostname.toLowerCase().replace(/^www\./, "").split(".");
    while (["careers", "career", "jobs", "job", "recruit", "recruiting"].includes(labels[0]) && labels.length > 2) labels.shift();
    const genericHosts = new Set(["greenhouse", "lever", "workday", "myworkdayjobs", "smartrecruiters"]);
    const name = genericHosts.has(labels[0]) && labels.length > 2 ? labels[labels.length - 3] : labels[0];
    return name ? name.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "";
  } catch { return ""; }
}
function filteredApplications() {
  const query = $("#search").value.trim().toLocaleLowerCase("zh-CN"); const status = $("#status-filter").value;
  const result = applications.filter((item) => (!query || `${item.company} ${item.role} ${item.contact}`.toLocaleLowerCase("zh-CN").includes(query)) && (!status || item.status === status));
  const compare = {"updated-desc":(a,b)=>b.updatedAt.localeCompare(a.updatedAt),"applied-desc":(a,b)=>b.appliedAt.localeCompare(a.appliedAt),"applied-asc":(a,b)=>a.appliedAt.localeCompare(b.appliedAt),"company-asc":(a,b)=>a.company.localeCompare(b.company,"zh-CN")}[$("#sort").value];
  return result.sort(compare);
}
function render() {
  applicationsElement.replaceChildren(); const items = filteredApplications();
  for (const item of items) {
    const card = $("#card-template").content.cloneNode(true);
    card.querySelector(".status-badge").textContent=item.status; card.querySelector(".company").textContent=item.company; card.querySelector(".role").textContent=item.role; card.querySelector(".applied-date").textContent=formatDate(item.appliedAt); card.querySelector(".next-date").textContent=formatDate(item.nextActionAt); card.querySelector(".contact").textContent=item.contact||"—";
    const notes=card.querySelector(".notes"); notes.textContent=item.notes; notes.hidden=!item.notes;
    for (const [selector,url] of [[".company-link",item.companyUrl],[".job-link",item.link]]) { const link=card.querySelector(selector); link.hidden=!url; if(url) link.href=url; }
    card.querySelector(".edit-button").addEventListener("click",()=>openDialog(item)); card.querySelector(".delete-button").addEventListener("click",()=>removeApplication(item)); applicationsElement.append(card);
  }
  emptyState.hidden=applications.length!==0; applicationsElement.hidden=applications.length===0; $("#result-count").textContent=applications.length?`显示 ${items.length} / ${applications.length} 条记录`:"";
  $("#total-stat").textContent=applications.length; $("#active-stat").textContent=applications.filter((item)=>ACTIVE_STATUSES.has(item.status)).length; $("#interview-stat").textContent=applications.filter((item)=>item.status==="面试").length; $("#offer-stat").textContent=applications.filter((item)=>item.status==="Offer").length;
}
function selectedStatus() { return form.querySelector('input[name="status"]:checked')?.value || ""; }
function openDialog(item=null) {
  form.reset(); autoCompany=""; $("#form-error").textContent=""; $("#dialog-title").textContent=item?"编辑投递":"新增投递"; $("#record-id").value=item?.id||""; $("#company-url").value=item?.companyUrl||""; $("#company").value=item?.company||""; $("#role").value=item?.role||""; form.querySelector(`input[name="status"][value="${item?.status||"已投递"}"]`).checked=true; $("#applied-at").value=item?.appliedAt||localDate(); $("#next-action-at").value=item?.nextActionAt||""; $("#contact").value=item?.contact||""; $("#link").value=item?.link||""; $("#notes").value=item?.notes||""; dialog.showModal(); $("#company-url").focus();
}
function removeApplication(item) { if(!confirm(`确定删除 ${item.company} 的 ${item.role} 记录吗？`))return; applications=applications.filter((candidate)=>candidate.id!==item.id); saveApplications(); render(); }
const formValue=(id)=>$(id).value.trim();
function saveFromForm(event) {
  event.preventDefault(); if(!form.reportValidity())return; const id=formValue("#record-id"); const now=new Date().toISOString(); const existing=applications.find((item)=>item.id===id);
  const item={id:id||crypto.randomUUID(),companyUrl:formValue("#company-url"),company:formValue("#company"),role:formValue("#role"),status:selectedStatus(),appliedAt:formValue("#applied-at"),nextActionAt:formValue("#next-action-at"),contact:formValue("#contact"),link:formValue("#link"),notes:formValue("#notes"),createdAt:existing?.createdAt||now,updatedAt:now};
  if(!isValidApplication(item)){ $("#form-error").textContent="请检查必填字段和网址。"; return; } applications=existing?applications.map((candidate)=>candidate.id===id?item:candidate):[...applications,item]; saveApplications(); dialog.close(); render();
}
function exportBackup(){const blob=new Blob([JSON.stringify(applications,null,2)],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=`job-applications-${localDate()}.json`;link.click();URL.revokeObjectURL(link.href);}
async function importBackup(file){if(!file)return;try{const value=JSON.parse(await file.text());if(!Array.isArray(value)||!value.every(isValidApplication))throw new Error("invalid");if(!confirm(`导入将替换现有 ${applications.length} 条记录，继续吗？`))return;applications=value.map(normalizeApplication);saveApplications();render();}catch{alert("无法导入：请选择由本站导出的有效 JSON 备份。");}finally{$("#import-file").value="";}}
for(const status of STATUSES){const label=document.createElement("label");label.className="status-option";const input=document.createElement("input");input.type="radio";input.name="status";input.value=status;input.required=true;label.append(input,document.createTextNode(status));$("#status-options").append(label);$("#status-filter").add(new Option(status,status));}
$("#company-url").addEventListener("input",()=>{const field=$("#company");const inferred=inferCompanyName(formValue("#company-url"));if(!field.value||field.value===autoCompany){field.value=inferred;autoCompany=inferred;}});
$("#company").addEventListener("input",()=>{if($("#company").value!==autoCompany)autoCompany="";});
$("#add-button").addEventListener("click",()=>openDialog());$(".add-trigger").addEventListener("click",()=>openDialog());$("#close-dialog").addEventListener("click",()=>dialog.close());$("#cancel-dialog").addEventListener("click",()=>dialog.close());form.addEventListener("submit",saveFromForm);for(const id of ["#search","#status-filter","#sort"])$(id).addEventListener("input",render);$("#export-button").addEventListener("click",exportBackup);$("#import-button").addEventListener("click",()=>$("#import-file").click());$("#import-file").addEventListener("change",(event)=>importBackup(event.target.files[0]));dialog.addEventListener("click",(event)=>{if(event.target===dialog)dialog.close();});render();
