const MENU_DATA = {"File": ["New document", "Open dashboard", "Rename document", "Make a copy", "Email this file", "Download PDF", "Download DOCX", "Version history", "Document details", "Page setup", "Print"], "Edit": ["Undo", "Redo", "Cut", "Copy", "Paste", "Paste without formatting", "Select all"], "View": ["Mode", "Show ruler", "Show document outline", "Full screen", "Show word count"], "Insert": ["Image", "Table", "Drawing", "Chart", "Horizontal line", "Date", "Footnote", "Page break", "Table of contents"], "Format": ["Text", "Paragraph styles", "Align & indent", "Line & paragraph spacing", "Columns", "Bullets & numbering", "Headers & footers", "Page numbers", "Drop cap", "Borders and shading"], "Tools": ["Spelling and grammar", "Word count", "Review suggested edits", "Compare documents", "Dictionary", "Translate document", "Citations", "Voice typing", "Preferences"], "Help": ["Terms of Service", "Keyboard shortcuts", "Privacy Policy", "Feedback"]};
const STORAGE_KEY = 'scribbledoodle_v914_docs';
const TEMPLATE_KEY = 'scribbledoodle_v914_templates';
const SETTINGS_KEY = 'scribbledoodle_v914_settings';
let docs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let templates = JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '[]');
let settings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
let currentFilter = 'recent';
let currentDocId = null;
let saveTimer = null;
const dashboardView = document.getElementById('dashboardView');
const editorView = document.getElementById('editorView');
const dashboardContent = document.getElementById('dashboardContent');
const paper = document.getElementById('paper');
const docTitle = document.getElementById('docTitle');
const tabbar = document.getElementById('tabbar');
const toast = document.getElementById('toast');

function saveAll() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
function showToast(text) { toast.textContent = text; toast.classList.add('show'); clearTimeout(window.toastTimer); window.toastTimer=setTimeout(()=>toast.classList.remove('show'),1800); }
function uid(prefix='id') { return prefix + '_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function escapeHtml(s) { return String(s||'').replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
function nowText() { return new Date().toLocaleString(); }
function countWords(text) { const m = text.trim().match(/\S+/g); return m ? m.length : 0; }
function stripHtml(html) { const div=document.createElement('div'); div.innerHTML=html||''; return div.innerText || div.textContent || ''; }
function currentDoc() { return docs.find(d=>d.id===currentDocId); }
function persistCurrentDoc(pushVersion=true) {
  const doc = currentDoc(); if(!doc) return;
  doc.title = docTitle.value.trim() || 'Untitled document';
  doc.content = paper.innerHTML;
  doc.language = document.getElementById('languageSelect').value;
  doc.updatedAt = new Date().toISOString();
  if(pushVersion) {
    const snapshot = { id:uid('ver'), title:doc.title, content:doc.content, createdAt:doc.updatedAt };
    doc.versions = doc.versions || [];
    if (!doc.versions.length || doc.versions[0].content !== snapshot.content) doc.versions.unshift(snapshot);
    doc.versions = doc.versions.slice(0,20);
  }
  saveAll(); renderDashboard(); renderTabs(); updateCounts();
}
function scheduleSave() { clearTimeout(saveTimer); saveTimer=setTimeout(()=>{ persistCurrentDoc(false); },400); }
function makeDoc(title='Untitled document', content='<p><br></p>') { return { id:uid('doc'), title, content, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), favorite:false, shared:false, language:'English (US)', versions:[{id:uid('ver'), title, content, createdAt:new Date().toISOString()}] }; }
if (!docs.length) { docs = []; saveAll(); }
function renderDashboard() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  let list = [...docs];
  if (currentFilter === 'recent') list.sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt));
  if (currentFilter === 'mine') list = list.filter(d=>!d.shared || true);
  if (currentFilter === 'shared') list = list.filter(d=>d.shared);
  if (currentFilter === 'favorites') list = list.filter(d=>d.favorite);
  if (q) list = list.filter(d=>d.title.toLowerCase().includes(q) || stripHtml(d.content).toLowerCase().includes(q));
  const isTemplateSection = currentFilter==='docTemplates' || currentFilter==='publicTemplates';
  let html = `<div class="dash-grid"><div class="dash-card"><h3>${isTemplateSection ? 'Templates' : 'Documents'}</h3><div class="small">${isTemplateSection ? 'Manage reusable layouts.' : 'Open, edit, and organize your work.'}</div><div class="card-actions"><button class="primary" id="mainActionBtn">${isTemplateSection ? 'Create template' : 'Create document'}</button></div></div></div>`;
  if (isTemplateSection) {
    const tplList = templates.filter(t=>currentFilter==='publicTemplates'?t.public:true);
    if (!tplList.length) html += `<div class="empty-state"><h3>No templates right now</h3><div>Create a template to get started.</div><div class="card-actions" style="justify-content:center;"><button class="primary" id="emptyActionBtn">Create template</button></div></div>`;
    else html += tplList.map(t=>`<div class="doc-list-item"><h4>${escapeHtml(t.title)}</h4><div class="small">${t.public?'Public template':'Document template'} · ${new Date(t.updatedAt).toLocaleString()}</div><div class="card-actions"><button onclick="createFromTemplate('${t.id}')">Use template</button></div></div>`).join('');
  } else {
    if (!list.length) html += `<div class="empty-state"><h3>No documents found</h3><div>Create a document to get started.</div><div class="card-actions" style="justify-content:center;"><button class="primary" id="emptyActionBtn">Create document</button></div></div>`;
    else html += list.map(d=>`<div class="doc-list-item"><h4>${escapeHtml(d.title)}</h4><div class="small">Updated ${new Date(d.updatedAt).toLocaleString()}</div><div class="card-actions"><button onclick="openDoc('${d.id}')">Open</button><button onclick="toggleFavorite('${d.id}')">${d.favorite?'Unfavorite':'Favorite'}</button><button onclick="duplicateDoc('${d.id}')">Make a copy</button><button onclick="deleteDoc('${d.id}')">Delete</button></div></div>`).join('');
  }
  dashboardContent.innerHTML = html;
  const mainActionBtn = document.getElementById('mainActionBtn'); if(mainActionBtn) mainActionBtn.onclick = ()=> isTemplateSection ? createTemplate() : createDocument();
  const emptyActionBtn = document.getElementById('emptyActionBtn'); if(emptyActionBtn) emptyActionBtn.onclick = ()=> isTemplateSection ? createTemplate() : createDocument();
}
function setFilter(filter) { currentFilter = filter; document.querySelectorAll('.sub-btn').forEach(b=>b.classList.toggle('active', b.dataset.filter===filter)); renderDashboard(); }
function createDocument(title='Untitled document', content='<p><br></p>') { const d = makeDoc(title, content); docs.unshift(d); saveAll(); renderDashboard(); openDoc(d.id); }
function createTemplate() {
  const title = prompt('Template name:', 'New template'); if(!title) return;
  const publicChoice = confirm('Make this a public template? Click Cancel to save as a document template.');
  templates.unshift({id:uid('tpl'), title:title.trim(), content:'<p><br></p>', public:publicChoice, updatedAt:new Date().toISOString()}); saveAll(); renderDashboard(); showToast('Template created');
}
function createFromTemplate(id) { const t=templates.find(x=>x.id===id); if(!t) return; createDocument(t.title + ' copy', t.content); }
function openDoc(id) { currentDocId = id; const d = currentDoc(); if(!d) return; docTitle.value = d.title; paper.innerHTML = d.content || '<p><br></p>'; document.getElementById('languageSelect').value = d.language || 'English (US)'; dashboardView.classList.add('hidden'); editorView.classList.remove('hidden'); document.getElementById('advancedPanel').classList.add('hidden'); paper.classList.remove('hidden'); renderTabs(); updateCounts(); applyEditorLanguage(); applyPageView(); closeAllMenus(); window.scrollTo({top:0, behavior:'smooth'}); }
function backToDashboard() { persistCurrentDoc(false); editorView.classList.add('hidden'); dashboardView.classList.remove('hidden'); document.getElementById('advancedPanel').classList.add('hidden'); renderDashboard(); }
function deleteDoc(id) { if(!confirm('Delete this document?')) return; docs = docs.filter(d=>d.id!==id); if(currentDocId===id) currentDocId = null; saveAll(); renderDashboard(); showToast('Document deleted'); }
function duplicateDoc(id) { const d=docs.find(x=>x.id===id); if(!d) return; const copy = JSON.parse(JSON.stringify(d)); copy.id=uid('doc'); copy.title += ' copy'; copy.createdAt = copy.updatedAt = new Date().toISOString(); docs.unshift(copy); saveAll(); renderDashboard(); showToast('Document copied'); }
function toggleFavorite(id) { const d=docs.find(x=>x.id===id); if(!d) return; d.favorite=!d.favorite; saveAll(); renderDashboard(); }
function renderTabs() { tabbar.innerHTML = docs.slice(0,6).map(d=>`<button class="doc-tab ${d.id===currentDocId?'active':''}" onclick="openDoc('${d.id}')">${escapeHtml(d.title)}</button>`).join(''); }
function updateCounts() { const text = stripHtml(paper.innerHTML); document.getElementById('wordCount').textContent = 'Words: ' + countWords(text); document.getElementById('charCount').textContent = 'Characters: ' + text.length; const pages = Math.max(1, Math.ceil((paper.scrollHeight || 1) / 950)); document.getElementById('pageCount').textContent = 'Pages: ' + pages; }

function applyPageView() {
  const v = document.getElementById('pagesAtOnceSelect')?.value || '1';
  const wrap = document.querySelector('.paper-wrap');
  if(!wrap) return;
  if(v==='1') wrap.style.maxWidth = '1100px';
  else if(v==='2') wrap.style.maxWidth = '1400px';
  else wrap.style.maxWidth = '1700px';
}
const EDITOR_I18N = {
  'English (US)': {words:'Words', chars:'Characters', pages:'Pages', language:'Language', share:'Share', versions:'Version history'},
  'English (UK)': {words:'Words', chars:'Characters', pages:'Pages', language:'Language', share:'Share', versions:'Version history'},
  'Spanish': {words:'Palabras', chars:'Caracteres', pages:'Páginas', language:'Idioma', share:'Compartir', versions:'Historial de versiones'}
};
function applyEditorLanguage() {
  const lang = document.getElementById('languageSelect').value;
  const t = EDITOR_I18N[lang] || EDITOR_I18N['English (US)'];
  document.getElementById('wordCount').textContent = `${t.words}: ` + countWords(stripHtml(paper.innerHTML));
  document.getElementById('charCount').textContent = `${t.chars}: ` + stripHtml(paper.innerHTML).length;
  const pages = Math.max(1, Math.ceil((paper.scrollHeight || 1) / 950));
  document.getElementById('pageCount').textContent = `${t.pages}: ` + pages;
  const badge = document.getElementById('languageBadgeLabel'); if (badge) badge.textContent = t.language;
  document.getElementById('shareBtn').textContent = t.share;
  document.getElementById('versionBtn').textContent = t.versions;
}
function exec(cmd, val=null) { paper.focus(); document.execCommand(cmd, false, val); updateCounts(); scheduleSave(); }
function insertNormalTable() { const rows = Math.max(1, parseInt(prompt('Rows:', '2')||'2',10)); const cols = Math.max(1, parseInt(prompt('Columns:', '2')||'2',10)); let html='<table><tbody>'; for(let r=0;r<rows;r++){ html+='<tr>'; for(let c=0;c<cols;c++) html+='<td>Cell</td>'; html+='</tr>'; } html+='</tbody></table><p><br></p>'; exec('insertHTML', html); }
function closeAllMenus() { document.querySelectorAll('.dropdown,.menu-dropdown').forEach(d=>d.classList.remove('open')); }
function toggleMenu(el) { const was = el.classList.contains('open'); closeAllMenus(); if(!was) el.classList.add('open'); }
function buildMenus() { const row = document.getElementById('menuRow'); row.innerHTML=''; Object.entries(MENU_DATA).forEach(([name,items])=>{ const wrap=document.createElement('div'); wrap.className='menu-dropdown'; wrap.innerHTML=`<button class="menu-trigger">${name}</button><div class="menu-list dropdown-menu"></div>`; const trigger=wrap.querySelector('.menu-trigger'); const list=wrap.querySelector('.menu-list'); items.forEach(item=>{ const b=document.createElement('button'); b.textContent=item; b.onclick=()=>handleMenuAction(name,item); list.appendChild(b); }); trigger.onclick=(e)=>{ e.stopPropagation(); toggleMenu(wrap); }; row.appendChild(wrap); }); }
function handleMenuAction(menu,item) { closeAllMenus(); const key = menu + ':' + item;
  const map = {
    'File:New document': ()=>createDocument(),
    'File:Open dashboard': ()=>backToDashboard(),
    'File:Rename document': ()=>{ const n=prompt('Document name:', docTitle.value); if(n){ docTitle.value=n; persistCurrentDoc(true); } },
    'File:Make a copy': ()=>duplicateDoc(currentDocId),
    'File:Download PDF': ()=>downloadAs('pdf'),
    'File:Download DOCX': ()=>downloadAs('docx'),
    'File:Version history': ()=>openVersionHistory(),
    'File:Document details': ()=>showPolicy('Document details', `<p><b>Title:</b> ${escapeHtml(docTitle.value)}</p><p><b>Last updated:</b> ${nowText()}</p>`),
    'File:Page setup': ()=>showToast('Page setup opened'),
    'File:Print': ()=>window.print(),
    'Edit:Undo': ()=>exec('undo'), 'Edit:Redo': ()=>exec('redo'), 'Edit:Cut': ()=>exec('cut'), 'Edit:Copy': ()=>exec('copy'), 'Edit:Paste': ()=>exec('paste'), 'Edit:Paste without formatting': ()=>showToast('Use Ctrl+Shift+V to paste without formatting'), 'Edit:Select all': ()=>exec('selectAll'),
    'View:Show word count': ()=>updateCounts(), 'View:Full screen': ()=>document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(), 'View:Mode': ()=>showToast('Editing mode active'), 'View:Show ruler': ()=>showToast('Ruler view placeholder'), 'View:Show document outline': ()=>showToast('Outline view placeholder'),
    'Insert:Table': ()=>insertNormalTable(), 'Insert:Image': ()=>showToast('Use the Upload button on the dashboard for file imports'), 'Insert:Emoji': ()=>insertEmoji(), 'Insert:Date': ()=>exec('insertText', new Date().toLocaleDateString()), 'Insert:Horizontal line': ()=>exec('insertHTML','<hr>'), 'Insert:Page break': ()=>exec('insertHTML','<div style="page-break-after:always;"></div>'),
    'Format:Text': ()=>showToast('Use the toolbar for text formatting'), 'Format:Paragraph styles': ()=>showToast('Paragraph styles placeholder'), 'Format:Align & indent': ()=>showToast('Use the alignment buttons in the toolbar'), 'Format:Line & paragraph spacing': ()=>showToast('Line spacing placeholder'), 'Format:Columns': ()=>showToast('Columns placeholder'), 'Format:Bullets & numbering': ()=>exec('insertUnorderedList'), 'Format:Headers & footers': ()=>showToast('Headers & footers placeholder'), 'Format:Page numbers': ()=>showToast('Page numbers placeholder'), 'Format:Drop cap': ()=>showToast('Drop cap placeholder'), 'Format:Borders and shading': ()=>showToast('Borders and shading placeholder'),
    'Tools:Word count': ()=>updateCounts(), 'Tools:Translate document': ()=>showToast('Translate document placeholder'), 'Tools:Dictionary': ()=>showToast('Dictionary placeholder'), 'Tools:Voice typing': ()=>showToast('Voice typing placeholder'), 'Tools:Preferences': ()=>showToast('Preferences placeholder'), 'Tools:Spelling and grammar': ()=>showToast('Spelling and grammar placeholder'), 'Tools:Review suggested edits': ()=>showToast('Suggested edits placeholder'), 'Tools:Compare documents': ()=>showToast('Compare documents placeholder'), 'Tools:Citations': ()=>showToast('Citations placeholder'),
    'Help:Terms of Service': ()=>showTerms(), 'Help:Privacy Policy': ()=>showPrivacy(), 'Help:Keyboard shortcuts': ()=>showShortcuts(), 'Help:Feedback': ()=>document.getElementById('feedbackModal').classList.add('show')
  };
  (map[key] || (()=>showToast(item + ' opened')))();
}
function downloadAs(kind) { persistCurrentDoc(false); const doc = currentDoc(); if(!doc) return; const blob = new Blob([kind==='docx' ? stripHtml(doc.content) : '<html><body>'+doc.content+'</body></html>'], {type:'text/plain'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(doc.title||'document') + (kind==='pdf'?'.html':'.docx'); a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1000); showToast('Download started'); }
function openVersionHistory() { const doc=currentDoc(); if(!doc) return; const list=document.getElementById('versionList'); list.innerHTML=(doc.versions||[]).map(v=>`<div class="doc-list-item"><h4>${escapeHtml(v.title||doc.title)}</h4><div class="small">${new Date(v.createdAt).toLocaleString()}</div><div class="card-actions"><button onclick="restoreVersion('${v.id}')">Restore this version</button></div></div>`).join('') || '<div class="small">No versions yet.</div>'; document.getElementById('versionModal').classList.add('show'); }
function restoreVersion(id) { const doc=currentDoc(); if(!doc) return; const v=(doc.versions||[]).find(x=>x.id===id); if(!v) return; if(!confirm('Restore this version?')) return; paper.innerHTML=v.content; docTitle.value=v.title||doc.title; persistCurrentDoc(false); updateCounts(); document.getElementById('versionModal').classList.remove('show'); showToast('Version restored'); }
function showPolicy(title, body) { document.getElementById('policyTitle').textContent = title; document.getElementById('policyBody').innerHTML = body; document.getElementById('policyModal').classList.add('show'); }
function longLegal(kind) {
  const title = kind==='tos' ? 'Terms of Service' : 'Privacy Policy';
  let html='';
  for(let i=1;i<=10;i++) { html += `<p><b>${i}. ${title} section</b><br>${title} content for ScribbleDoodle covering use of the editor, saved browser data, document sharing controls, templates, feedback, acceptable use, intellectual property, service limitations, account-free local storage behavior, and update notices. This is a professional placeholder section designed to read like a long-form policy document for the app.</p>`; }
  return html;
}
function showTerms() { showPolicy('Terms of Service', longLegal('tos')); }
function showPrivacy() { showPolicy('Privacy Policy', longLegal('privacy')); }
function showShortcuts() { showPolicy('Keyboard shortcuts', '<p><b>Ctrl/Cmd + B</b> Bold</p><p><b>Ctrl/Cmd + I</b> Italic</p><p><b>Ctrl/Cmd + U</b> Underline</p><p><b>Ctrl/Cmd + Z</b> Undo</p><p><b>Ctrl/Cmd + Shift + Z</b> Redo</p><p><b>Alt + F/E/V/I/O/T/H</b> Open the File, Edit, View, Insert, Format, Tools, and Help menus on desktop.</p>'); }

// Dashboard wiring
Array.from(document.querySelectorAll('.sub-btn')).forEach(btn=>btn.addEventListener('click',()=>setFilter(btn.dataset.filter)));
document.getElementById('searchInput').addEventListener('input', renderDashboard);
document.getElementById('createDocBtn').addEventListener('click', ()=>createDocument());
document.getElementById('uploadBtn').addEventListener('click', e=>{ e.stopPropagation(); toggleMenu(document.getElementById('uploadDropdown')); });
document.getElementById('uploadDocumentBtn').addEventListener('click', ()=>{ document.getElementById('uploadInput').click(); closeAllMenus(); });
document.getElementById('uploadInput').addEventListener('change', async (e)=>{ const file=e.target.files[0]; if(!file) return; const name=file.name.toLowerCase(); const allowed=['.pdf','.doc','.docx','.txt','.rtf','.md']; if(!allowed.some(ext=>name.endsWith(ext))) { alert('Only document files are allowed: PDF, DOC, DOCX, TXT, RTF, and MD.'); e.target.value=''; return; } let content='<p><br></p>'; if(name.endsWith('.txt')||name.endsWith('.md')||name.endsWith('.rtf')) { const text = await file.text(); content = '<pre style="white-space:pre-wrap; font-family:inherit;">'+escapeHtml(text)+'</pre>'; } else { content = `<p><b>${escapeHtml(file.name)}</b></p><p>This document was uploaded successfully. Basic inline preview is available for text-based files. PDF and Word files are stored as document entries for now.</p>`; } createDocument(file.name.replace(/\.[^.]+$/,''), content); e.target.value=''; });
document.getElementById('themeSwitch').addEventListener('click', ()=>{ document.body.classList.toggle('dark'); settings.dark = document.body.classList.contains('dark'); saveAll(); document.getElementById('themeSwitch').textContent = 'Dark Mode: ' + (settings.dark ? 'On' : 'Off'); });

// Editor wiring
buildMenus();
document.getElementById('logoHomeBtn').addEventListener('click', backToDashboard);
document.getElementById('shareBtn').addEventListener('click', ()=>document.getElementById('shareModal').classList.add('show'));
document.getElementById('versionBtn').addEventListener('click', openVersionHistory);
document.getElementById('closeShareBtn').addEventListener('click', ()=>document.getElementById('shareModal').classList.remove('show'));
document.getElementById('copyLinkBtn').addEventListener('click', async ()=>{ try { await navigator.clipboard.writeText(document.getElementById('shareLink').value); showToast('Link copied'); } catch { showToast('Copy failed'); } });
document.getElementById('closeVersionBtn').addEventListener('click', ()=>document.getElementById('versionModal').classList.remove('show'));
document.querySelectorAll('.closePolicyBtn').forEach(btn=>btn.addEventListener('click', ()=>document.getElementById('policyModal').classList.remove('show')));
document.querySelectorAll('.closeFeedbackBtn').forEach(btn=>btn.addEventListener('click', ()=>document.getElementById('feedbackModal').classList.remove('show')));
document.getElementById('sendFeedbackBtn').addEventListener('click', ()=>{ const txt=document.getElementById('feedbackText').value.trim(); if(!txt) return; const arr=JSON.parse(localStorage.getItem('scribbledoodle_feedback')||'[]'); arr.unshift({text:txt, at:new Date().toISOString()}); localStorage.setItem('scribbledoodle_feedback', JSON.stringify(arr)); document.getElementById('feedbackText').value=''; document.getElementById('feedbackModal').classList.remove('show'); showToast('Feedback sent'); });
paper.addEventListener('input', ()=>{ updateCounts(); scheduleSave(); });
docTitle.addEventListener('input', ()=>scheduleSave());
document.getElementById('languageSelect').addEventListener('change', ()=>{ applyEditorLanguage(); scheduleSave(); });
document.getElementById('fontSelect').addEventListener('change', e=>{ paper.style.fontFamily = e.target.value; scheduleSave(); });
document.getElementById('fontSizeSelect').value = '18';
document.getElementById('fontSizeSelect').addEventListener('change', e=>{ paper.style.fontSize = e.target.value + 'px'; scheduleSave(); });
document.getElementById('boldBtn').addEventListener('click', ()=>exec('bold'));
document.getElementById('italicBtn').addEventListener('click', ()=>exec('italic'));
document.getElementById('underlineBtn').addEventListener('click', ()=>exec('underline'));
document.getElementById('alignLeftBtn').addEventListener('click', ()=>exec('justifyLeft'));
document.getElementById('alignCenterBtn').addEventListener('click', ()=>exec('justifyCenter'));
document.getElementById('alignRightBtn').addEventListener('click', ()=>exec('justifyRight'));
document.getElementById('textColorBtn').addEventListener('click', ()=>document.getElementById('textColorInput').click());
document.getElementById('highlightBtn').addEventListener('click', ()=>document.getElementById('highlightInput').click());
document.getElementById('textColorInput').addEventListener('input', e=>exec('foreColor', e.target.value));
document.getElementById('highlightInput').addEventListener('input', e=>exec('hiliteColor', e.target.value));
document.getElementById('advancedTableBtn').addEventListener('click', ()=>{ const panel=document.getElementById('advancedPanel'); panel.classList.remove('hidden'); paper.classList.add('hidden'); panel.scrollIntoView({behavior:'smooth', block:'start'}); });
document.getElementById('normalTableBtn').addEventListener('click', ()=>{ document.getElementById('advancedPanel').classList.add('hidden'); paper.classList.remove('hidden'); insertNormalTable(); });
document.getElementById('pagesAtOnceSelect').addEventListener('change', applyPageView);
document.getElementById('customFontBtn').addEventListener('click', ()=>document.getElementById('fontUpload').click());
document.getElementById('fontUpload').addEventListener('change', e=>loadUploadedFont(e.target.files[0], false));

document.addEventListener('click', (e)=>{ if(!e.target.closest('.dropdown') && !e.target.closest('.menu-dropdown')) closeAllMenus(); });
window.openDoc=openDoc; window.deleteDoc=deleteDoc; window.duplicateDoc=duplicateDoc; window.toggleFavorite=toggleFavorite; window.createFromTemplate=createFromTemplate; window.restoreVersion=restoreVersion;

async function loadUploadedFont(file, adv) { if(!file) return; const clean=(file.name||'CustomFont').replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]/g,''); const family='UploadedFont_'+clean+Date.now(); const dataUrl=await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); const font = new FontFace(family, `url(${dataUrl})`); await font.load(); document.fonts.add(font); const css=`'${family}', Arial, sans-serif`; if(adv) { document.getElementById('advFontName').textContent='Current: '+clean; advState.fontCss=css; applyAdvStyles(); } else { const opt=document.createElement('option'); opt.value=css; opt.textContent='Uploaded: '+clean; document.getElementById('fontSelect').prepend(opt); document.getElementById('fontSelect').value=css; paper.style.fontFamily=css; scheduleSave(); } showToast('Custom font loaded'); }

// Advanced table mode
const advTbody = document.getElementById('advTbody');
const advState = { border:'#222222', showSideLines:true, lineThickness:2, lineSpacing:56, textSpacing:0, fontSize:18, textOffset:10, fontCss:'Arial, Helvetica, sans-serif' };
function advCreateRow(value='') { const tr=document.createElement('tr'); tr.innerHTML=`<td><input class="adv-input" value="${escapeHtml(value)}"></td>`; advTbody.appendChild(tr); advAttach(tr.querySelector('.adv-input')); return tr; }
function advClearRows() { advTbody.innerHTML=''; for(let i=0;i<12;i++) advCreateRow(); }
function advMeasure(text,input) { const temp=document.createElement('span'); temp.style.position='fixed'; temp.style.left='-9999px'; temp.style.visibility='hidden'; temp.style.whiteSpace='nowrap'; temp.style.fontFamily=getComputedStyle(input).fontFamily; temp.style.fontSize=getComputedStyle(input).fontSize; temp.style.letterSpacing=getComputedStyle(input).letterSpacing; temp.textContent=text; document.body.appendChild(temp); const w=temp.getBoundingClientRect().width; temp.remove(); return w; }
function advAvailable(input) { const s=getComputedStyle(input); return Math.max(20, input.clientWidth - (parseFloat(s.paddingLeft)||0) - (parseFloat(s.paddingRight)||0) - 2); }
function advFits(text,input) { return advMeasure(text||'', input) <= advAvailable(input); }
function advSplit(text,input) { const clean=text.replace(/\s+/g,' ').trim(); if(!clean) return ['','']; if(advFits(clean,input)) return [clean,'']; const words=clean.split(' '); let current=''; let i=0; while(i<words.length){ const test=current?current+' '+words[i]:words[i]; if(advFits(test,input)) { current=test; i++; } else { if(!current) return [words[i].slice(0,1), words[i].slice(1)+' '+words.slice(i+1).join(' ')]; break; } } return [current, words.slice(i).join(' ').trim()]; }
function advEnsureNext(row) { let next=row.nextElementSibling; if(!next) next=advCreateRow(); return next; }
function advFlow(startInput,text) { let input=startInput; let pending=text; while(input) { const [fit,overflow]=advSplit(pending,input); input.value=fit; if(!overflow) break; input=advEnsureNext(input.closest('tr')).querySelector('.adv-input'); pending=overflow; } }
function advAttach(input) { input.addEventListener('input', ()=>{ const clean=input.value.replace(/\n+/g,' ').replace(/\s+/g,' ').trim(); const [fit,overflow]=advSplit(clean,input); input.value=fit; if(overflow) { const next=advEnsureNext(input.closest('tr')).querySelector('.adv-input'); advFlow(next, [overflow,next.value].filter(Boolean).join(' ')); } }); input.addEventListener('paste', e=>{ e.preventDefault(); const pasted=(e.clipboardData||window.clipboardData).getData('text'); advFlow(input, [input.value.trim(), pasted].filter(Boolean).join(' ')); }); }
function applyAdvStyles() { document.documentElement.style.setProperty('--advBorder', advState.border); document.documentElement.style.setProperty('--advLineThickness', advState.lineThickness + 'px'); document.documentElement.style.setProperty('--advCellH', advState.lineSpacing + 'px'); document.documentElement.style.setProperty('--advTextSpacing', advState.textSpacing + 'px'); document.documentElement.style.setProperty('--advFontSize', advState.fontSize + 'px'); document.documentElement.style.setProperty('--advTextOffset', advState.textOffset + 'px'); document.querySelectorAll('.adv-input').forEach(i=>{ i.style.fontFamily=advState.fontCss; }); document.querySelectorAll('#advTable tbody tr td').forEach((td,idx)=>{ td.style.borderColor=advState.border; td.style.borderLeftWidth = advState.showSideLines ? advState.lineThickness+'px' : '0px'; td.style.borderRightWidth = advState.showSideLines ? advState.lineThickness+'px' : '0px'; }); }
advClearRows(); applyAdvStyles();
document.getElementById('advFillRowsBtn').addEventListener('click', ()=>{ const text=document.getElementById('advBulkText').value.replace(/\n+/g,' ').replace(/\s+/g,' ').trim(); if(!text) return; advClearRows(); advFlow(advTbody.querySelector('.adv-input'), text); });
document.getElementById('advClearTextBtn').addEventListener('click', ()=>document.getElementById('advBulkText').value='');
document.getElementById('advAdd10Btn').addEventListener('click', ()=>{ for(let i=0;i<10;i++) advCreateRow(); applyAdvStyles(); });
document.getElementById('advClearRowsBtn').addEventListener('click', ()=>{ advClearRows(); applyAdvStyles(); });
document.querySelectorAll('.adv-color').forEach(b=>b.addEventListener('click', ()=>{ advState.border=b.dataset.color; document.getElementById('advHexInput').value=b.dataset.color; applyAdvStyles(); }));
document.getElementById('advApplyHexBtn').addEventListener('click', ()=>{ let v=document.getElementById('advHexInput').value.trim(); if(v && !v.startsWith('#')) v='#'+v; if(/^#[0-9a-fA-F]{6}$/.test(v)) { advState.border=v; applyAdvStyles(); } else alert('Use a valid hex color like #2563eb'); });
document.getElementById('advSideLinesToggle').addEventListener('change', e=>{ advState.showSideLines=e.target.checked; applyAdvStyles(); });
document.getElementById('advLineThicknessInput').addEventListener('input', e=>{ advState.lineThickness=parseInt(e.target.value,10); applyAdvStyles(); });
document.getElementById('advLineSpacingInput').addEventListener('input', e=>{ advState.lineSpacing=parseInt(e.target.value,10); applyAdvStyles(); });
document.getElementById('advTextSpacingInput').addEventListener('input', e=>{ advState.textSpacing=parseInt(e.target.value,10); applyAdvStyles(); });
document.getElementById('advFontSizeInput').addEventListener('input', e=>{ advState.fontSize=parseInt(e.target.value,10); applyAdvStyles(); });
document.getElementById('advTextOffsetInput').addEventListener('input', e=>{ advState.textOffset=parseInt(e.target.value,10); applyAdvStyles(); });
document.getElementById('advFontSelect').addEventListener('change', e=>{ advState.fontCss=e.target.value; document.getElementById('advFontName').textContent='Current: '+e.target.options[e.target.selectedIndex].text; applyAdvStyles(); });
document.getElementById('advFontUploadBtn').addEventListener('click', ()=>document.getElementById('advFontUpload').click());
document.getElementById('advFontUpload').addEventListener('change', e=>loadUploadedFont(e.target.files[0], true));
document.getElementById('advResetFontBtn').addEventListener('click', ()=>{ advState.fontCss='Arial, Helvetica, sans-serif'; document.getElementById('advFontSelect').value='Arial, Helvetica, sans-serif'; document.getElementById('advFontName').textContent='Current: Arial'; applyAdvStyles(); });

// Initial state
if (settings.dark) document.body.classList.add('dark');
document.getElementById('themeSwitch').textContent = 'Dark Mode: ' + (settings.dark ? 'On' : 'Off');
renderDashboard();
paper.innerHTML = '<p><br></p>';
updateCounts();