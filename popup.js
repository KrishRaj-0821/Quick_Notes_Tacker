// popup.js - v3: ensures page title is captured and displayed with each saved note.
const DRAFT_KEY = 'qnt_draft';
const NOTES_KEY = 'qnt_notes'; // array of note objects {id, text, url, title, ts}
const MAX_NOTES = 500;

const noteEl = document.getElementById('note');
const saveBtn = document.getElementById('saveBtn');
const copyDraftBtn = document.getElementById('copyDraftBtn');
const clearDraftBtn = document.getElementById('clearDraftBtn');
const statusEl = document.getElementById('status');
const notesListEl = document.getElementById('notesList');
const clearAllBtn = document.getElementById('clearAllBtn');

let draftTimer = null;
const DRAFT_DEBOUNCE = 300;

function formatTs(iso) {
  try { return new Date(iso).toLocaleString(); } catch(e) { return iso; }
}
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get([DRAFT_KEY, NOTES_KEY], (res) => {
    const draft = res[DRAFT_KEY] || '';
    const notes = res[NOTES_KEY] || [];
    noteEl.value = draft;
    statusEl.textContent = draft ? 'Draft loaded' : 'Draft empty';
    renderNotes(notes);
  });
});

noteEl.addEventListener('input', () => {
  statusEl.textContent = 'Saving draft...';
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const txt = noteEl.value;
    chrome.storage.local.set({ [DRAFT_KEY]: txt }, () => {
      statusEl.textContent = txt ? 'Draft saved' : 'Draft empty';
    });
  }, DRAFT_DEBOUNCE);
});

// Save note capturing current tab title & url
saveBtn.addEventListener('click', () => {
  const text = noteEl.value.trim();
  if (!text) {
    flashStatus('Nothing to save', 1200); return;
  }
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = (tabs && tabs[0]) || {};
    const url = tab.url || '';
    const title = tab.title || extractDomain(url) || 'Unknown';
    const note = {
      id: genId(),
      text,
      url,
      title,
      ts: new Date().toISOString()
    };
    chrome.storage.local.get([NOTES_KEY], (res) => {
      const notes = res[NOTES_KEY] || [];
      notes.unshift(note);
      if (notes.length > MAX_NOTES) notes.splice(MAX_NOTES);
      chrome.storage.local.set({ [NOTES_KEY]: notes, [DRAFT_KEY]: '' }, () => {
        noteEl.value = '';
        statusEl.textContent = 'Saved';
        renderNotes(notes);
      });
    });
  });
});

copyDraftBtn.addEventListener('click', async () => {
  const txt = noteEl.value || '';
  if (!txt) { flashStatus('Draft empty', 1200); return; }
  try { await navigator.clipboard.writeText(txt); flashStatus('Copied draft ✅', 1200); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); flashStatus('Copied draft ✅', 1200);
  }
});

clearDraftBtn.addEventListener('click', () => {
  if (!confirm('Clear draft? This will remove the current text.')) return;
  noteEl.value = '';
  chrome.storage.local.remove(DRAFT_KEY, () => { statusEl.textContent = 'Draft cleared'; });
});

function renderNotes(notes) {
  notesListEl.innerHTML = '';
  if (!notes || notes.length === 0) {
    notesListEl.innerHTML = '<div style="color:var(--muted)">No notes yet.</div>';
    return;
  }
  notes.forEach((n) => {
    const card = document.createElement('div'); card.className = 'note-card';
    const textDiv = document.createElement('div'); textDiv.className = 'note-text'; textDiv.textContent = n.text;
    const metaDiv = document.createElement('div'); metaDiv.className = 'note-meta';
    const left = document.createElement('div'); left.style.flex = '1';
    // Display title (page title) and formatted timestamp
    const titleSpan = document.createElement('div'); titleSpan.textContent = (n.title ? n.title : extractDomain(n.url));
    titleSpan.style.fontWeight = '600';
    const timeSpan = document.createElement('div'); timeSpan.textContent = formatTs(n.ts);
    left.appendChild(titleSpan); left.appendChild(timeSpan);
    const actions = document.createElement('div'); actions.className = 'note-actions';
    const copyBtn = document.createElement('button'); copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => copyNote(n.text));
    const openBtn = document.createElement('button'); openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => { if (n.url) chrome.tabs.create({ url: n.url }); });
    const delBtn = document.createElement('button'); delBtn.textContent = 'Delete'; delBtn.className = 'secondary';
    delBtn.addEventListener('click', () => deleteNote(n.id));
    actions.appendChild(copyBtn); actions.appendChild(openBtn); actions.appendChild(delBtn);
    metaDiv.appendChild(left); metaDiv.appendChild(actions);
    card.appendChild(textDiv); card.appendChild(metaDiv);
    notesListEl.appendChild(card);
  });
}

function extractDomain(url) {
  try { const u = new URL(url); return u.host.replace('www.',''); } catch(e) { return url || ''; }
}

async function copyNote(text) {
  if (!text) return;
  try { await navigator.clipboard.writeText(text); flashStatus('Note copied ✅', 1200); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta); flashStatus('Note copied ✅', 1200);
  }
}

function deleteNote(id) {
  if (!confirm('Delete this note?')) return;
  chrome.storage.local.get([NOTES_KEY], (res) => {
    let notes = res[NOTES_KEY] || []; notes = notes.filter(n => n.id !== id);
    chrome.storage.local.set({ [NOTES_KEY]: notes }, () => { renderNotes(notes); flashStatus('Deleted', 1000); });
  });
}

clearAllBtn.addEventListener('click', () => {
  if (!confirm('Clear all saved notes? This cannot be undone.')) return;
  chrome.storage.local.set({ [NOTES_KEY]: [] }, () => { renderNotes([]); flashStatus('All cleared', 1200); });
});

function flashStatus(msg, ms=1000) {
  statusEl.textContent = msg;
  setTimeout(() => {
    chrome.storage.local.get([DRAFT_KEY], (r) => {
      const draft = r[DRAFT_KEY] || '';
      statusEl.textContent = draft ? 'Draft saved' : 'Draft empty';
    });
  }, ms);
}
