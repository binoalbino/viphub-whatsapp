'use strict';
/* =====================================================================
   VIP Hub | painel de grupos e disparos de WhatsApp
   Front-end puro (HTML + CSS + JS), sem dependências.

   Modo demonstração: tudo roda no navegador (localStorage), sem enviar nada.
   Modo n8n: cada ação chama um webhook do n8n (veja Configurações > Contrato da API).
   Toda a comunicação com o backend passa pelo objeto API (seção "API").
   ===================================================================== */

const GROUP_LIMIT = 800;
const STORAGE_KEY = 'viphub.v1';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const fmtDate = (ts) => (ts ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts)) : '');
const fmtTime = (ts) => new Intl.DateTimeFormat('pt-BR', { timeStyle: 'medium' }).format(new Date(ts));
const fmtSize = (b) => (!b ? '' : b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
const fmtInt = (n) => Number(n || 0).toLocaleString('pt-BR');
const randomCode = () => Array.from({ length: 22 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[rand(0, 61)]).join('');
const hueOf = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const toLocalInput = (d) => { const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const scrollTop = () => { try { window.scrollTo(0, 0); } catch (e) { /* ambiente sem scroll */ } };

function fmtPhone(n) {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length >= 12 && d.startsWith('55')) {
    const rest = d.slice(4);
    return `+55 (${d.slice(2, 4)}) ${rest.length === 9 ? rest.slice(0, 5) + '-' + rest.slice(5) : rest.slice(0, 4) + '-' + rest.slice(4)}`;
  }
  return d ? '+' + d : '';
}
function parseNumbers(text) {
  const valid = []; const invalid = [];
  const add = (raw) => {
    let d = raw.replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    if ((d.length === 12 || d.length === 13) && d.startsWith('55')) { if (!valid.includes(d)) valid.push(d); } else invalid.push(raw);
  };
  /* cada linha (ou item separado por vírgula/ponto e vírgula) é um número, mesmo com espaços e parênteses.
     Se a linha tiver dígitos demais, tenta separar por espaço (vários números na mesma linha). */
  String(text || '').split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean).forEach((chunk) => {
    if (chunk.replace(/\D/g, '').length <= 13) add(chunk);
    else chunk.split(/\s+/).filter(Boolean).forEach(add);
  });
  return { valid, invalid };
}
function formatDuration(sec) {
  if (sec < 60) return 'menos de 1 minuto';
  const m = Math.round(sec / 60);
  if (m < 60) return `cerca de ${m} min`;
  const h = Math.floor(m / 60); const r = m % 60;
  return `cerca de ${h} h${r ? ' ' + r + ' min' : ''}`;
}
function setPath(obj, path, val) {
  const keys = path.split('.'); let o = obj;
  for (let i = 0; i < keys.length - 1; i++) { o = o[keys[i]]; if (o == null) return; }
  o[keys[keys.length - 1]] = val;
}
function setBusy(btn, on) { if (!btn) return; btn.classList.toggle('busy', !!on); btn.disabled = !!on; }

/* ---------- icons ---------- */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M3 21v-5h5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 8-6 4 6 4z"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3"/>',
  paperclip: '<path d="m21 11-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/>',
  chart: '<path d="M18 20V10M12 20V4M6 20v-6"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  userPlus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/>',
  userMinus: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M23 11h-6"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  pin: '<path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  alert: '<path d="M12 3 2 21h20zM12 10v5M12 18h.01"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const icon = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- state ---------- */
const defaultState = () => ({
  accounts: [], campaigns: [], actions: [],
  settings: { mode: 'demo', baseUrl: '', token: '', mediaUrl: '', theme: 'light', client: null },
});
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw); const d = defaultState();
      return Object.assign(d, s, { settings: Object.assign(d.settings, s.settings || {}) });
    }
  } catch (e) { /* estado corrompido: começa limpo */ }
  return defaultState();
}
let state = loadState();
function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* sem espaço */ }
  scheduleRemoteSave();
}
/* No modo n8n os dados ficam guardados no servidor, separados por cliente. O navegador mantém só uma cópia. */
const remote = { ready: false, timer: null, failed: false };
function remotePayload() { return { accounts: state.accounts, campaigns: state.campaigns, actions: state.actions }; }
function scheduleRemoteSave() {
  if (state.settings.mode !== 'n8n' || !remote.ready) return;
  clearTimeout(remote.timer);
  remote.timer = setTimeout(pushRemoteState, 1500);
}
async function pushRemoteState() {
  if (state.settings.mode !== 'n8n' || !remote.ready) return;
  try { await API.call('state/save', { state: remotePayload() }); remote.failed = false; }
  catch (e) { if (!remote.failed) toast('Não consegui salvar seus dados no servidor: ' + e.message, 'error'); remote.failed = true; }
}
/* Descobre quem é o cliente (ping) e traz os dados dele. Servidor manda; se ele estiver vazio, sobe o que há neste navegador. */
async function connectRemote({ quiet = false } = {}) {
  remote.ready = false;
  if (state.settings.mode !== 'n8n') return false;
  const ping = await API.call('ping', {});
  state.settings.client = ping.client || null;
  const r = await API.call('state/load', {});
  if (r.state && typeof r.state === 'object') {
    state.accounts = r.state.accounts || []; state.campaigns = r.state.campaigns || []; state.actions = r.state.actions || [];
  }
  remote.ready = true; remote.failed = false;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ok */ }
  if (!r.state && (state.accounts.length || state.campaigns.length || state.actions.length)) await pushRemoteState();
  updateModeBadge();
  if (!quiet) route();
  return true;
}
const instancePrefix = () => (state.settings.mode === 'n8n' && state.settings.client && state.settings.client.prefix) || '';
const withPrefix = (inst) => { const pf = instancePrefix(); return pf && inst && !inst.startsWith(pf) ? pf + inst : inst; };
const getAccount = (id) => state.accounts.find((a) => a.id === id);
const getCampaign = (id) => state.campaigns.find((c) => c.id === id);
const getAction = (id) => state.actions.find((a) => a.id === id);

/* arquivos escolhidos ficam só em memória (não vão para o localStorage) */
const fileStore = new Map();
const urlCache = new Map();
function fileUrl(key) {
  const f = fileStore.get(key); if (!f) return '';
  if (!urlCache.has(key)) { try { urlCache.set(key, URL.createObjectURL(f)); } catch (e) { return ''; } }
  return urlCache.get(key);
}
function dropFile(key) {
  fileStore.delete(key);
  if (urlCache.has(key)) { try { URL.revokeObjectURL(urlCache.get(key)); } catch (e) { /* ok */ } urlCache.delete(key); }
}

/* ---------- toast e modal ---------- */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.classList.add('hide'), 3400);
  setTimeout(() => el.remove(), 3800);
}
let currentModal = null;
function openModal({ title, body, footer = '', size = '', onMount, onClose }) {
  closeModal();
  $('#modal-root').innerHTML = `<div class="backdrop" data-act="modal-backdrop"><div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" type="button" data-act="modal-close" aria-label="Fechar">${icon('x')}</button></div>
    <div class="modal-body">${body}</div>${footer ? `<div class="modal-foot">${footer}</div>` : ''}</div></div>`;
  currentModal = { onClose };
  if (onMount) onMount($('#modal-root .modal'));
}
function closeModal() {
  if (!currentModal) return;
  const m = currentModal; currentModal = null;
  $('#modal-root').innerHTML = '';
  if (m.onClose) m.onClose();
}
let pendingConfirm = null;
function confirmDialog(message, { okLabel = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    pendingConfirm = resolve;
    openModal({
      title: 'Confirmar', size: 'sm', body: `<p>${esc(message)}</p>`,
      footer: `<button class="btn" type="button" data-act="modal-close">Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" type="button" data-act="confirm-ok">${esc(okLabel)}</button>`,
      onClose: () => { if (pendingConfirm) { pendingConfirm(false); pendingConfirm = null; } },
    });
  });
}
function emptyState(ic, title, text, cta = '') {
  return `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3><p>${esc(text)}</p>${cta}</div>`;
}

/* =====================================================================
   API  (modo demonstração x n8n)
   ===================================================================== */
const demoScans = {};
const Mock = {
  async ping() { await sleep(250); return { ok: true }; },
  async 'accounts/connect'({ instance, number }) { await sleep(700); return number ? { pairingCode: 'DEMO1234', code: null, qr: null } : { code: uid('qr') + instance, qr: null }; },
  async 'accounts/status'({ instance }) {
    await sleep(150);
    if (demoScans[instance]) return { state: 'open', number: demoScans[instance] };
    const acc = state.accounts.find((a) => a.instance === instance);
    return { state: acc && acc.status === 'connected' ? 'open' : 'connecting', number: acc && acc.number };
  },
  async 'accounts/logout'({ instance }) { await sleep(400); delete demoScans[instance]; return { ok: true }; },
  async 'accounts/delete'({ instance }) { await sleep(300); delete demoScans[instance]; return { ok: true }; },
  async 'groups/create'(p) {
    await sleep(900);
    const groups = [];
    for (let i = 0; i < p.quantity; i++) {
      const n = p.startAt + i;
      groups.push({ id: uid('g') + '@g.us', n, name: `${p.base} #${n}`, inviteLink: 'https://chat.whatsapp.com/' + randomCode() });
    }
    return { groups };
  },
  async 'groups/sync'() { await sleep(300); return { groups: [] }; },
  async 'groups/list'() {
    await sleep(700);
    const mk = (i, name, size, ad) => ({ id: '1203630000000000' + i + '@g.us', name, size, description: 'Grupo antigo da conta', adminsOnly: ad, createdAt: Date.now() - 864e5 * (60 - i * 3) });
    return { groups: [mk(1, 'Promoções 1', 800, true), mk(2, 'Promoções 2', 798, true), mk(3, 'Promoções 3', 311, true), mk(4, 'Promoções 10', 42, false), mk(5, 'Equipe interna', 8, false), mk(6, 'Clientes VIP', 150, true)] };
  },
  async 'groups/import'({ groupIds }) { await sleep(600); return { links: (groupIds || []).map((id, i) => ({ id, inviteLink: i % 4 === 3 ? '' : 'https://chat.whatsapp.com/' + randomCode() })) }; },
  async 'state/load'() { return { state: null }; },
  async 'state/save'() { return { ok: true }; },
  async 'campaigns/sync'() { return { ok: true, groups: [] }; },
  async 'campaigns/delete'() { return { ok: true }; },
  async 'actions/run'({ action }) { await sleep(600); return { id: action.id, status: action.scheduledAt ? 'agendada' : 'em andamento' }; },
  async 'actions/status'() { return { actions: [] }; },
  async 'actions/cancel'() { await sleep(300); return { ok: true }; },
  async 'messages/info'({ id }) {
    await sleep(400);
    const a = state.actions.find((x) => x.id === id); const sent = []; const data = {};
    const people = [['5547999990001', 'Ana'], ['5547988880002', 'Bia'], ['5547977770003', 'Carla'], ['5511966660004', 'Dani'], ['5521955550005', 'Elisa']];
    if (a && a.type === 'send_message') {
      (a.groups || []).forEach((g, gi) => (a.content.items || []).forEach((it, ii) => {
        const mid = 'DEMO' + gi + '_' + ii; sent.push({ id: mid, g: g.id, i: it.id });
        const rs = people.slice(0, 2 + ((gi + ii) % 3)).map((p, k) => ({ jid: p[0] + '@s.whatsapp.net', emoji: ['👍', '❤️', '🔥'][k % 3], name: p[1], t: Date.now() - k * 60000 }));
        data[mid] = { reactions: rs, poll: it.kind === 'poll' ? (it.options || []).filter(Boolean).map((o, k) => ({ name: o, voters: people.slice(0, (k + gi) % 3 + 1).map((p) => p[0] + '@s.whatsapp.net') })) : null, read: [], readCount: 40 + gi * 3, deliveredCount: 90 + gi * 5 };
      }));
    }
    return { sent, data, stats: { received: sent.length * 3, since: Date.now() - 3600000, last: Date.now() } };
  },
};
async function http(endpoint, payload) {
  const base = String(state.settings.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Informe a URL base do n8n em Configurações.');
  const headers = { 'Content-Type': 'application/json' };
  if (state.settings.token) headers.Authorization = state.settings.token;
  let res;
  try { res = await fetch(`${base}/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(payload || {}) }); }
  catch (e) { throw new Error('Não foi possível falar com o n8n. Confira a URL e o CORS do webhook.'); }
  if (!res.ok) {
    let t = ''; try { t = await res.text(); } catch (e) { /* ok */ }
    throw new Error(`Erro ${res.status} em ${endpoint}${t ? ': ' + t.slice(0, 140) : ''}`);
  }
  return (res.headers.get('content-type') || '').includes('json') ? res.json() : { ok: true };
}
const API = {
  call(endpoint, payload) {
    return state.settings.mode === 'n8n' ? http(endpoint, payload) : Mock[endpoint](payload || {});
  },
};
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = reject; r.readAsDataURL(file);
  });
}
/* servidor de arquivos próprio (vídeos grandes): o arquivo vai direto para ele, sem passar pelo n8n */
function mediaBase() { return String(state.settings.mediaUrl || '').trim().replace(/\/+$/, ''); }
function uploadMedia(file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', mediaBase() + '/upload');
    x.setRequestHeader('Authorization', state.settings.token);
    x.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    x.setRequestHeader('X-File-Type', file.type || 'application/octet-stream');
    x.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => {
      let r = {}; try { r = JSON.parse(x.responseText); } catch (e) { /* ok */ }
      if (x.status >= 200 && x.status < 300 && r.id) resolve({ name: file.name, type: file.type, size: file.size, mediaId: r.id, url: mediaBase() + r.path });
      else reject(new Error('Falha ao enviar o arquivo para o servidor (' + x.status + '): ' + (r.error || x.responseText || '').slice(0, 120)));
    };
    x.onerror = () => reject(new Error('Não consegui falar com o servidor de arquivos. Confira o endereço em Configurações.'));
    x.send(file);
  });
}
async function collectFiles(action, onProgress) {
  const files = {};
  for (const it of (action.content.items || [])) {
    const f = fileStore.get(it.id);
    if (!f) {
      const kept = wiz && wiz.keptMedia && wiz.keptMedia[it.id];
      if (it.kept && kept) files[it.id] = kept;
      continue;
    }
    if (mediaBase()) files[it.id] = await uploadMedia(f, (p) => onProgress && onProgress(it.fileName || f.name, p));
    else files[it.id] = { name: f.name, type: f.type, base64: await fileToBase64(f) };
  }
  const gi = fileStore.get('groupImage');
  if (action.type === 'image' && gi) files.groupImage = { name: gi.name, type: gi.type, base64: await fileToBase64(gi) };
  return files;
}

/* =====================================================================
   Tipos de ação e conteúdo
   ===================================================================== */
const ACTION_TYPES = {
  send_message: { label: 'Enviar mensagem', icon: 'send', desc: 'Texto, imagem, enquete, áudio, vídeo e anexos nos grupos.' },
  rename: { label: 'Trocar nome', icon: 'edit', desc: 'Renomeia os grupos mantendo a numeração (#1, #2...).' },
  description: { label: 'Trocar descrição', icon: 'type', desc: 'Atualiza o texto de descrição dos grupos.' },
  image: { label: 'Trocar imagem', icon: 'image', desc: 'Define uma nova foto para os grupos.' },
  settings: { label: 'Trocar configuração', icon: 'settings', desc: 'Quem pode enviar mensagens e editar os dados do grupo.' },
  add_admin: { label: 'Adicionar ADM', icon: 'userPlus', desc: 'Adiciona os números ao grupo (se ainda não estiverem) e promove a administradores.' },
  remove_admin: { label: 'Remover ADM', icon: 'userMinus', desc: 'Rebaixa administradores para participantes.' },
  remove_participants: { label: 'Remover participantes', icon: 'users', desc: 'Tira números específicos dos grupos.' },
  update_links: { label: 'Atualizar links dos grupos', icon: 'link', desc: 'Gera novos links de convite e invalida os antigos.' },
};
const KINDS = {
  text: { label: 'Texto', icon: 'type' },
  image: { label: 'Imagem', icon: 'image' },
  button: { label: 'Texto com botão', icon: 'link' },
  poll: { label: 'Enquete', icon: 'chart' },
  audio: { label: 'Áudio (.ogg)', icon: 'mic' },
  file: { label: 'Anexo', icon: 'paperclip' },
  video: { label: 'Vídeo', icon: 'video' },
};
const SPEEDS = {
  slow: { label: 'Lenta', min: 30, max: 60, hint: 'A opção mais segura para o número.' },
  normal: { label: 'Normal', min: 15, max: 30, hint: 'Bom equilíbrio entre velocidade e segurança.' },
  fast: { label: 'Rápida', min: 5, max: 10, hint: 'Mais rápida, mas aumenta o risco de bloqueio do número.' },
  custom: { label: 'Personalizada', hint: 'Defina o intervalo mínimo e máximo em segundos.' },
};
const speedRange = (sp) => (sp.mode === 'custom' ? { min: Number(sp.min) || 5, max: Number(sp.max) || 10 } : { min: SPEEDS[sp.mode].min, max: SPEEDS[sp.mode].max });
const STATUS_PILL = { 'agendada': 'info', 'em andamento': 'warn', 'concluída': 'ok', 'cancelada': 'off', 'falhou': 'bad' };

/* =====================================================================
   Router
   ===================================================================== */
let currentRoute = null;
const routes = [
  { re: /^#\/contas$/, nav: 'contas', title: 'Contas', render: viewContas },
  { re: /^#\/campanhas$/, nav: 'campanhas', title: 'Campanhas', render: viewCampanhas },
  { re: /^#\/campanhas\/([\w-]+)$/, nav: 'campanhas', title: 'Campanha', render: viewCampanha },
  { re: /^#\/acoes$/, nav: 'acoes', title: 'Ações', render: viewAcoes },
  { re: /^#\/acoes\/nova$/, nav: 'acoes', title: 'Nova ação', render: viewWizard, noRefresh: true },
  { re: /^#\/config$/, nav: 'config', title: 'Configurações', render: viewConfig, noRefresh: true },
];
function route() {
  const hash = location.hash || '#/contas';
  for (const r of routes) {
    const m = hash.match(r.re);
    if (m) {
      currentRoute = r;
      $$('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === r.nav));
      document.body.classList.remove('nav-open');
      $('#page-title').textContent = r.title;
      $('#page-actions').innerHTML = '';
      r.render(...m.slice(1));
      return;
    }
  }
  location.hash = '#/contas';
}
function refreshIfRoute(nav) { if (currentRoute && currentRoute.nav === nav && !currentRoute.noRefresh) route(); }
function updateModeBadge() {
  const live = state.settings.mode === 'n8n';
  const b = $('#mode-badge');
  b.className = 'mode-badge' + (live ? ' live' : '');
  const who = live && state.settings.client ? ' · ' + esc(state.settings.client.name) : '';
  b.innerHTML = `<i></i><span>${live ? 'Modo n8n' + who : 'Modo demonstração'}</span>`;
}

/* =====================================================================
   Contas
   ===================================================================== */
function statusPill(s) {
  const map = { connected: ['ok', 'Conectado'], disconnected: ['off', 'Desconectado'], connecting: ['warn', 'Aguardando QR Code'] };
  const [c, t] = map[s] || map.disconnected;
  return `<span class="pill ${c}">${t}</span>`;
}
function viewContas() {
  $('#page-actions').innerHTML = `<button class="btn primary" type="button" data-act="account-connect">${icon('plus')} Conectar número</button>`;
  const v = $('#view');
  if (!state.accounts.length) {
    v.innerHTML = emptyState('smartphone', 'Nenhum número conectado', 'Conecte um WhatsApp lendo o QR Code, do mesmo jeito que no WhatsApp Web.',
      `<button class="btn primary" type="button" data-act="account-connect">Conectar número</button>`);
    return;
  }
  v.innerHTML = `<div class="list"><div class="list-head row-accounts"><span></span><span>Conta</span><span>Instância</span><span>Situação</span><span></span></div>
    ${state.accounts.map((a) => `<div class="list-row row-accounts">
      <div class="avatar" style="--h:${hueOf(a.name)}">${esc((a.name || '?').charAt(0).toUpperCase())}</div>
      <div class="cell-main"><b>${esc(a.name)}</b><span>${a.number ? esc(fmtPhone(a.number)) : 'Número ainda não vinculado'}</span></div>
      <div class="cell-main"><b class="trunc">${esc(a.instance)}</b><span>Criada em ${fmtDate(a.createdAt)}</span></div>
      <div>${statusPill(a.status)}</div>
      <div class="row-end">
        <button class="btn sm" type="button" data-act="account-refresh" data-id="${a.id}">${icon('refresh')} Atualizar</button>
        ${a.status === 'connected'
          ? `<button class="btn sm" type="button" data-act="account-logout" data-id="${a.id}">Desconectar</button>`
          : `<button class="btn sm primary" type="button" data-act="account-reconnect" data-id="${a.id}">Ler QR Code</button>`}
        <button class="icon-btn danger" type="button" data-act="account-delete" data-id="${a.id}" aria-label="Remover conta">${icon('trash')}</button>
      </div></div>`).join('')}</div>`;
}

let qrState = null;
/* número usado para conectar por código (vazio = QR Code) */
let connNumber = '';
const connectPayload = (acc) => Object.assign({ instance: acc.instance, name: acc.name }, connNumber ? { number: connNumber } : {});
function stopQr() { if (qrState) { clearInterval(qrState.poll); clearInterval(qrState.countdown); qrState = null; } }
function drawFakeQR(canvas, seedStr) {
  const ctx = canvas && canvas.getContext && canvas.getContext('2d'); if (!ctx) return;
  const N = 29; const S = 8; const size = N * S; canvas.width = size; canvas.height = size;
  let h = 2166136261;
  for (const ch of String(seedStr)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  if (!h) h = 1;
  const next = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#111';
  const inFinder = (x, y) => (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && next() > 0.52) ctx.fillRect(x * S, y * S, S, S);
  const finder = (ox, oy) => {
    ctx.fillStyle = '#111'; ctx.fillRect(ox * S, oy * S, 7 * S, 7 * S);
    ctx.fillStyle = '#fff'; ctx.fillRect((ox + 1) * S, (oy + 1) * S, 5 * S, 5 * S);
    ctx.fillStyle = '#111'; ctx.fillRect((ox + 2) * S, (oy + 2) * S, 3 * S, 3 * S);
  };
  finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
}
function openConnectModal(accountId) {
  const acc = accountId ? getAccount(accountId) : null;
  openModal({
    title: acc ? 'Reconectar número' : 'Conectar número', size: '',
    body: `<div id="conn-form">
        <p class="lead">Dê um nome para identificar este número no painel. Em seguida, leia o QR Code como no WhatsApp Web.</p>
        <label class="field"><span>Nome da conta</span><input id="conn-name" type="text" placeholder="Ex.: Atendimento Clush" value="${esc(acc ? acc.name : '')}" ${acc ? 'readonly' : ''}></label>
        <label class="field"><span>Como conectar</span><select id="conn-method"><option value="qr">QR Code</option><option value="code">Código de 8 caracteres (sem câmera)</option></select></label>
        <label class="field" id="conn-phone-wrap" hidden><span>Número do WhatsApp (com DDD)</span><input id="conn-phone" type="text" inputmode="tel" placeholder="(47) 99999-0000"><small>O número que vai ser conectado. O WhatsApp mostra um código no painel, que você digita no celular.</small></label>
        <label class="field"><span>Instância</span><input id="conn-instance" type="text" placeholder="clush-atendimento" value="${esc(acc ? acc.instance : '')}" ${acc ? 'readonly' : ''}><small>Identificador único, sem espaços. É o nome da instância na Evolution API.${instancePrefix() ? ` Começa sempre com <b>${esc(instancePrefix())}</b> (identifica a sua conta).` : ''}</small></label>
      </div>
      <div id="conn-qr" hidden>
        <div class="qr-wrap">
          <div class="qr-box" id="qr-box"></div>
          <div>
            <ol class="qr-steps" id="steps-qr">
              <li>Abra o WhatsApp no celular.</li>
              <li>Toque em <b>Aparelhos conectados</b> e depois em <b>Conectar um aparelho</b>.</li>
              <li>Aponte a câmera para este QR Code.</li>
            </ol>
            <ol class="qr-steps" id="steps-code" hidden>
              <li>Abra o WhatsApp no celular.</li>
              <li>Toque em <b>Aparelhos conectados</b>, depois em <b>Conectar um aparelho</b>.</li>
              <li>Escolha <b>Conectar com número de telefone</b> e digite o código mostrado ao lado.</li>
            </ol>
            <p class="muted" style="margin-top:12px">O código é renovado em <b id="qr-timer">60</b> segundos.</p>
            <button class="btn sm" type="button" data-act="conn-simulate" id="conn-sim" hidden style="margin-top:12px">Simular leitura do QR Code</button>
          </div>
        </div>
      </div>`,
    footer: `<button class="btn" type="button" data-act="modal-close">Cancelar</button><button class="btn primary" type="button" id="conn-go" data-act="conn-generate" data-id="${acc ? acc.id : ''}">Gerar QR Code</button>`,
    onMount: () => {
      const meth = $('#conn-method'); const go = $('#conn-go');
      meth.addEventListener('change', () => { const code = meth.value === 'code'; $('#conn-phone-wrap').hidden = !code; go.textContent = code ? 'Gerar código' : 'Gerar QR Code'; });
      if (acc) return;
      const n = $('#conn-name'); const i = $('#conn-instance'); let touched = false;
      i.addEventListener('input', () => { touched = true; });
      n.addEventListener('input', () => { if (!touched) i.value = withPrefix(slug(n.value)); });
    },
    onClose: stopQr,
  });
}
async function showQr(acc) {
  const res = await API.call('accounts/connect', connectPayload(acc));
  $('#conn-form').hidden = true; $('#conn-qr').hidden = false; $('#conn-go').hidden = true;
  $('#steps-qr').hidden = !!connNumber; $('#steps-code').hidden = !connNumber;
  paintQr(res, acc);
  if (state.settings.mode === 'demo') $('#conn-sim').hidden = false;
  startQrLoop(acc);
}
function paintQr(res, acc, tries = 0) {
  const box = $('#qr-box'); if (!box) return;
  if (connNumber && res.pairingCode) {
    const c = String(res.pairingCode).replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    box.innerHTML = `<div class="pair-code" aria-label="Código de conexão">${esc(c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c)}</div>`; return;
  }
  const img = connNumber ? null : (res.qr || res.base64);
  if (img) { box.innerHTML = `<img src="${esc(img)}" alt="QR Code para conectar o WhatsApp">`; return; }
  if (state.settings.mode === 'n8n') {
    /* a Evolution API leva alguns segundos para gerar o QR: tenta de novo em vez de mostrar um código falso */
    box.innerHTML = `<p class="muted" style="text-align:center;padding:12px">${connNumber ? 'Gerando o código' : 'Gerando o QR Code'}, aguarde alguns segundos...</p>`;
    if (tries < 8) {
      setTimeout(async () => {
        if (!qrState || qrState.acc !== acc || !$('#qr-box')) return;
        try { paintQr(await API.call('accounts/connect', connectPayload(acc)), acc, tries + 1); } catch (e) { /* tenta de novo */ }
      }, 3000);
    } else box.innerHTML = `<p class="muted" style="text-align:center;padding:12px">Não veio ${connNumber ? 'o código' : 'o QR Code'}. Feche e tente de novo.</p>`;
    return;
  }
  box.innerHTML = '<canvas id="qr-canvas" aria-label="QR Code de demonstração"></canvas>'; drawFakeQR($('#qr-canvas'), res.code || acc.instance);
}
function startQrLoop(acc) {
  stopQr(); const period = connNumber ? 120 : 60; let left = period; qrState = { acc };
  const tm = $('#qr-timer'); if (tm) tm.textContent = left;
  qrState.countdown = setInterval(async () => {
    left--; const t = $('#qr-timer'); if (t) t.textContent = left;
    if (left <= 0) {
      left = period;
      try { const res = await API.call('accounts/connect', connectPayload(acc)); paintQr(res, acc); } catch (e) { /* tenta no próximo ciclo */ }
    }
  }, 1000);
  qrState.poll = setInterval(() => pollAccount(acc), 3000);
}
async function pollAccount(acc) {
  try {
    const r = await API.call('accounts/status', { instance: acc.instance });
    if (r.state === 'open' || r.state === 'connected') {
      acc.status = 'connected';
      if (r.number) acc.number = String(r.number).replace(/\D/g, '');
      saveState(); stopQr(); closeModal();
      toast('Número conectado', 'success'); refreshIfRoute('contas');
    }
  } catch (e) { /* tenta de novo */ }
}

/* =====================================================================
   Campanhas e grupos
   ===================================================================== */
function groupInfo(c) {
  const gs = [...c.groups].sort((a, b) => a.n - b.n); let active = null;
  const rows = gs.map((g) => {
    let st;
    if (g.members >= GROUP_LIMIT) st = 'lotado';
    else if (!active) { active = g; st = 'ativo'; } else st = 'reserva';
    return { g, st };
  });
  return { rows, active, reserves: rows.filter((r) => r.st === 'reserva').length };
}
function queueHtml(c, compact) {
  const gi = groupInfo(c);
  if (!gi.rows.length) return '<p class="muted">Nenhum grupo criado ainda.</p>';
  return `<div class="queue ${compact ? 'compact' : ''}">${gi.rows.map(({ g, st }) => `<div class="qg ${st}" title="${esc(g.name)}: ${g.members}/${GROUP_LIMIT}">
    <div class="qg-top"><span>#${g.n}</span><span>${fmtInt(g.members)}/${GROUP_LIMIT}</span></div>
    <div class="qg-bar"><i style="width:${Math.min(100, (g.members / GROUP_LIMIT) * 100)}%"></i></div></div>`).join('')}</div>`;
}
function campaignHealth(c) {
  const gi = groupInfo(c);
  if (!c.groups.length) return '<span class="pill off">Sem grupos</span>';
  if (!gi.active) return '<span class="pill bad">Todos lotados</span>';
  if (gi.reserves < 1) return '<span class="pill warn">Sem grupo reserva</span>';
  return '<span class="pill ok">Fila saudável</span>';
}
function viewCampanhas() {
  $('#page-actions').innerHTML = `<button class="btn primary" type="button" data-act="campaign-new">${icon('plus')} Nova campanha</button>`;
  const v = $('#view');
  if (!state.campaigns.length) {
    v.innerHTML = emptyState('layers', 'Nenhuma campanha ainda', 'Uma campanha reúne os grupos de uma lista, como "Bruno VIP". Crie a primeira e depois gere os grupos.',
      `<button class="btn primary" type="button" data-act="campaign-new">Nova campanha</button>`);
    return;
  }
  v.innerHTML = `<div class="list"><div class="list-head row-campaigns"><span>Campanha</span><span>Fila de grupos</span><span>Situação</span></div>
    ${state.campaigns.map((c) => {
      const total = c.groups.reduce((s, g) => s + g.members, 0);
      return `<a class="list-row row-campaigns" href="#/campanhas/${esc(c.id)}">
        <div class="cell-main"><b>${esc(c.name)}</b><span>${c.groups.length} grupos e ${fmtInt(total)} participantes</span></div>
        <div class="queue-wrap">${queueHtml(c, true)}</div><div>${campaignHealth(c)}</div></a>`;
    }).join('')}</div>`;
}
function openCampaignModal() {
  const accs = state.accounts;
  openModal({
    title: 'Nova campanha',
    body: `<label class="field"><span>Nome da campanha</span><input id="c-name" type="text" placeholder="Ex.: Bruno VIP"></label>
      <label class="field"><span>Descrição interna</span><input id="c-desc" type="text" placeholder="Para lembrar do que se trata"></label>
      <label class="field"><span>Conta padrão</span><select id="c-account">${accs.length ? accs.map((a) => `<option value="${a.id}">${esc(a.name)}${a.status === 'connected' ? '' : ' (desconectada)'}</option>`).join('') : '<option value="">Nenhuma conta conectada</option>'}</select></label>`,
    footer: `<button class="btn" type="button" data-act="modal-close">Cancelar</button><button class="btn primary" type="button" data-act="campaign-create">Criar campanha</button>`,
  });
}
function viewCampanha(id) {
  const c = getCampaign(id); const v = $('#view');
  if (!c) { v.innerHTML = emptyState('layers', 'Campanha não encontrada', 'Ela pode ter sido excluída.', '<a class="btn primary" href="#/campanhas">Voltar para campanhas</a>'); return; }
  $('#page-title').textContent = c.name;
  $('#page-actions').innerHTML = `<button class="btn" type="button" data-act="campaign-action" data-id="${c.id}">${icon('zap')} Nova ação</button>
    <button class="btn" type="button" data-act="import-open" data-id="${c.id}">${icon('layers')} Importar grupos</button>
    <button class="btn primary" type="button" data-act="groups-open" data-id="${c.id}">${icon('plus')} Criar grupos</button>`;
  const gi = groupInfo(c); const total = c.groups.reduce((s, g) => s + g.members, 0);
  const base = (state.settings.baseUrl || 'https://seu-n8n.com/webhook').replace(/\/+$/, '');
  const link = `${base}/go?c=${c.slug}`;
  let alert = '';
  if (c.groups.length && !gi.active) alert = `<div class="callout bad">${icon('alert')}<p>Todos os grupos estão lotados. Crie mais grupos para continuar recebendo gente.</p><button class="btn sm" type="button" data-act="groups-open" data-id="${c.id}">Criar grupos</button></div>`;
  else if (c.groups.length && gi.reserves < 1) alert = `<div class="callout">${icon('alert')}<p>A campanha está sem grupo reserva. Crie o próximo grupo antes que o grupo ativo lote.</p><button class="btn sm" type="button" data-act="groups-open" data-id="${c.id}">Criar reserva</button></div>`;
  const cfg = c.groupCfg || {};
  v.innerHTML = `${alert}
    <div class="panel"><div class="stats">
      <div><b>${c.groups.length}</b><span>grupos</span></div>
      <div><b>${fmtInt(total)}</b><span>participantes</span></div>
      <div><b>${gi.active ? esc(gi.active.name) : '-'}</b><span>recebendo agora</span></div>
      <div><b>${gi.reserves}</b><span>${gi.reserves === 1 ? 'grupo reserva' : 'grupos reserva'}</span></div></div></div>
    <div class="panel"><h4>Fila de grupos ${c.groups.length ? (state.settings.mode === 'demo'
        ? `<button class="btn sm" style="margin-left:auto" type="button" data-act="sim-joins" data-id="${c.id}">Simular 150 entradas</button>`
        : `<button class="btn sm" style="margin-left:auto" type="button" data-act="groups-sync" data-id="${c.id}">${icon('refresh')} Atualizar participantes</button>`) : ''}</h4>
      <p class="muted" style="margin-bottom:6px">Quem entra pelo link vai para o primeiro grupo que ainda tem vaga (limite de ${GROUP_LIMIT}). Os próximos ficam de reserva.</p>
      <div class="queue-wrap">${queueHtml(c, false)}</div></div>
    ${c.groups.length ? `<div class="list" style="margin-bottom:18px"><div class="list-head row-groups"><span>Grupo</span><span>Capacidade</span><span>Situação</span><span>Mensagens</span><span></span></div>
      ${gi.rows.map(({ g, st }, i) => `<div class="list-row row-groups">
        <div class="cell-main"><b>${esc(g.name)}</b><span class="trunc">${g.inviteLink ? '' : '<b style="color:var(--danger)">Sem link de convite.</b> '}${esc(g.description || 'Sem descrição')}</span></div>
        <div><span>${fmtInt(g.members)} de ${GROUP_LIMIT}</span><div class="progress"><i style="width:${Math.min(100, (g.members / GROUP_LIMIT) * 100)}%"></i></div></div>
        <div><span class="pill ${st === 'ativo' ? 'ok' : st === 'reserva' ? 'info' : 'dark'}">${st === 'ativo' ? 'Recebendo' : st === 'reserva' ? 'Reserva' : 'Lotado'}</span></div>
        <div><span class="pill ${g.adminsOnly ? 'warn' : 'off'}">${g.adminsOnly ? 'Só admins' : 'Todos'}</span></div>
        <div class="row-end"><button class="btn sm" type="button" title="Entra antes na fila" data-act="group-move" data-id="${c.id}" data-gid="${esc(g.id)}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>&uarr;</button><button class="btn sm" type="button" title="Entra depois na fila" data-act="group-move" data-id="${c.id}" data-gid="${esc(g.id)}" data-dir="1" ${i === gi.rows.length - 1 ? 'disabled' : ''}>&darr;</button><button class="btn sm" type="button" data-act="copy" data-copy="${esc(g.inviteLink)}">${icon('copy')} Copiar link</button></div></div>`).join('')}</div>` : ''}
    <div class="panel"><h4>Link de entrada</h4>
      <p class="muted" style="margin-bottom:10px">${state.settings.mode === 'n8n'
        ? 'Link inteligente: leva cada pessoa para o primeiro grupo com vaga e passa para o próximo quando lota. Divulgue este link (pode encurtar no TinyURL).'
        : 'Link inteligente: leva cada pessoa para o grupo que está recebendo. Em modo demonstração ele é só um exemplo; no modo n8n ele passa a funcionar.'}</p>
      <div class="copy-line"><code>${esc(link)}</code><button class="btn sm" type="button" data-act="copy" data-copy="${esc(link)}">${icon('copy')} Copiar</button></div></div>
    <div class="panel"><h4>Padrão dos grupos</h4>
      <dl class="summary" style="margin:0 0 14px">
        <dt>Nome base</dt><dd>${esc(cfg.base || c.name)} #número</dd>
        <dt>Mensagens</dt><dd>${cfg.adminsOnly === false ? 'Todos podem enviar' : 'Só admins podem enviar'}</dd>
        <dt>Limite</dt><dd>${GROUP_LIMIT} participantes</dd>
        <dt>Descrição</dt><dd>${esc(cfg.description || 'Sem descrição')}</dd></dl>
      <button class="btn danger sm" type="button" data-act="campaign-delete" data-id="${c.id}">${icon('trash')} Excluir campanha</button></div>`;
  if (state.settings.mode === 'n8n' && c.groups.length) {
    /* puxa do n8n a contagem mais recente (ele conta os participantes a cada minuto) */
    syncCampaign(c).then((changed) => { if (changed && location.hash === '#/campanhas/' + c.id) route(); }).catch(() => { /* painel segue com os números locais */ });
  }
}
function openGroupsModal(campId) {
  const c = getCampaign(campId); if (!c) return;
  const accs = state.accounts.filter((a) => a.status === 'connected');
  if (!accs.length) { toast('Conecte um número na aba Contas antes de criar grupos', 'error'); return; }
  const nextN = c.groups.length ? Math.max(...c.groups.map((g) => g.n)) + 1 : 1;
  const minQty = c.groups.length ? 1 : 2; const cfg = c.groupCfg || {};
  openModal({
    title: 'Criar grupos',
    body: `<p class="lead">${c.groups.length ? `Os novos grupos continuam a numeração a partir do #${nextN}.` : 'A numeração começa no #1. Crie ao menos 2 grupos para já ter um reserva.'}</p>
      <label class="field"><span>Conta que vai criar</span><select id="g-account">${accs.map((a) => `<option value="${a.id}" ${a.id === c.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <div class="row">
        <label class="field"><span>Nome base</span><input id="g-base" type="text" value="${esc(cfg.base || c.name)}"></label>
        <label class="field"><span>Quantidade de grupos</span><input id="g-qty" type="number" min="${minQty}" max="50" value="${Math.max(minQty, c.groups.length ? 1 : 2)}"></label>
      </div>
      <p class="muted" id="g-preview" style="margin:-4px 0 14px"></p>
      <label class="field"><span>Descrição dos grupos</span><textarea id="g-desc" placeholder="Texto que aparece na descrição do grupo">${esc(cfg.description || '')}</textarea></label>
      <label class="field"><span>Seu número (entra em todos os grupos)</span><input id="g-participants" type="text" inputmode="tel" value="${esc(cfg.participants || ((state.campaigns.find((x) => x.groupCfg && x.groupCfg.participants) || { groupCfg: {} }).groupCfg.participants) || '')}" placeholder="(47) 99999-0000"><small>O WhatsApp não cria grupo sem outra pessoa. Use um número seu, diferente do que está conectado. Mais de um: um por linha, separados por vírgula.</small></label>
      <div class="switch-row"><div><b>Apenas admins podem enviar mensagens</b><small>Mantém o grupo como canal de avisos.</small></div>
        <label class="switch"><input id="g-admins" type="checkbox" ${cfg.adminsOnly === false ? '' : 'checked'}><span class="slider"></span></label></div>
      <div class="row" style="margin-top:10px">
        <label class="field"><span>Limite de participantes</span><input type="number" value="${GROUP_LIMIT}" disabled><small>Fixo em ${GROUP_LIMIT}.</small></label>
        <label class="field"><span>Imagem do grupo (opcional)</span><input id="g-image" type="file" accept="image/*"></label>
      </div>`,
    footer: `<button class="btn" type="button" data-act="modal-close">Cancelar</button><button class="btn primary" type="button" data-act="groups-submit" data-id="${c.id}">Criar grupos</button>`,
    onMount: () => {
      const upd = () => {
        const base = $('#g-base').value.trim() || 'Grupo'; const q = Math.max(0, Math.min(50, Number($('#g-qty').value) || 0));
        const names = Array.from({ length: q }, (_, i) => `${base} #${nextN + i}`);
        $('#g-preview').textContent = q ? `Serão criados: ${names.slice(0, 4).join(', ')}${q > 4 ? ` e mais ${q - 4}` : ''}.` : '';
      };
      $('#g-base').addEventListener('input', upd); $('#g-qty').addEventListener('input', upd); upd();
    },
  });
}
/* importar grupos que já existem na conta */
let imp = null;
const naturalCmp = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
const groupsInCampaigns = () => { const m = {}; state.campaigns.forEach((c) => c.groups.forEach((g) => { m[g.id] = c.name; })); return m; };
function importSorted() {
  const list = (imp.groups || []).slice();
  if (imp.order === 'created') list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  else if (imp.order === 'size') list.sort((a, b) => b.size - a.size);
  else list.sort((a, b) => naturalCmp(a.name, b.name));
  return list;
}
function importVisible() {
  const q = imp.filter.trim().toLowerCase();
  return importSorted().filter((g) => !q || g.name.toLowerCase().includes(q));
}
function renderImportList() {
  const box = $('#imp-body'); if (!box || !imp) return;
  if (!imp.groups) { box.innerHTML = '<p class="muted">Escolha a conta e clique em Buscar grupos.</p>'; $('#imp-submit').disabled = true; return; }
  const used = groupsInCampaigns(); const vis = importVisible();
  const free = vis.filter((g) => !used[g.id]);
  const nSel = Array.from(imp.sel).filter((id) => !used[id]).length;
  box.innerHTML = `<div class="imp-tools">
      <input id="imp-filter" type="search" placeholder="Filtrar por nome" value="${esc(imp.filter)}">
      <select id="imp-order"><option value="name" ${imp.order === 'name' ? 'selected' : ''}>Ordem: nome (1, 2, 10)</option><option value="created" ${imp.order === 'created' ? 'selected' : ''}>Ordem: mais antigos primeiro</option><option value="size" ${imp.order === 'size' ? 'selected' : ''}>Ordem: mais cheios primeiro</option></select>
      <button class="btn sm" type="button" data-act="import-all">${free.length && free.every((g) => imp.sel.has(g.id)) ? 'Desmarcar visíveis' : 'Marcar visíveis'}</button></div>
    <p class="muted" style="margin:0 0 8px">${imp.groups.length} grupo(s) na conta${vis.length !== imp.groups.length ? `, ${vis.length} no filtro` : ''}. Eles entram na campanha na ordem mostrada abaixo, numerados a partir do próximo número da fila.</p>
    <div class="imp-list">${vis.length ? vis.map((g) => `<label class="imp-row ${used[g.id] ? 'off' : ''}">
        <input type="checkbox" data-id="${esc(g.id)}" ${imp.sel.has(g.id) && !used[g.id] ? 'checked' : ''} ${used[g.id] ? 'disabled' : ''}>
        <span class="imp-name"><b>${esc(g.name)}</b><small>${used[g.id] ? 'Já está na campanha ' + esc(used[g.id]) : esc(g.description || 'Sem descrição')}</small></span>
        <span class="imp-size ${g.size >= GROUP_LIMIT ? 'full' : ''}">${fmtInt(g.size)}/${GROUP_LIMIT}</span>
        <span class="imp-tag">${g.adminsOnly ? 'só admins' : 'todos enviam'}</span></label>`).join('') : '<p class="muted" style="padding:14px">Nenhum grupo encontrado.</p>'}</div>`;
  const sub = $('#imp-submit'); sub.disabled = !nSel; sub.textContent = nSel ? `Importar ${nSel} grupo${nSel > 1 ? 's' : ''}` : 'Importar grupos';
  $('#imp-filter').addEventListener('input', (e) => { imp.filter = e.target.value; const pos = e.target.selectionStart; renderImportList(); const f = $('#imp-filter'); f.focus(); try { f.setSelectionRange(pos, pos); } catch (er) { /* ok */ } });
  $('#imp-order').addEventListener('change', (e) => { imp.order = e.target.value; renderImportList(); });
  $$('#imp-body .imp-row input').forEach((cb) => cb.addEventListener('change', () => { if (cb.checked) imp.sel.add(cb.dataset.id); else imp.sel.delete(cb.dataset.id); renderImportList(); }));
}
function openImportModal(campId) {
  const c = getCampaign(campId); if (!c) return;
  const accs = state.accounts.filter((a) => a.status === 'connected');
  if (!accs.length) return toast('Conecte uma conta primeiro, em Contas.', 'error');
  imp = { campId, accountId: c.accountId && accs.some((a) => a.id === c.accountId) ? c.accountId : accs[0].id, groups: null, sel: new Set(), filter: '', order: 'name' };
  openModal({
    title: 'Importar grupos existentes', size: 'lg',
    body: `<p class="lead">Busca os grupos que a conta já tem no WhatsApp e adiciona os escolhidos à campanha <b>${esc(c.name)}</b>.</p>
      <div class="row" style="align-items:end"><label class="field"><span>Conta</span><select id="imp-account">${accs.map((a) => `<option value="${a.id}" ${a.id === imp.accountId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
      <div class="field"><button class="btn primary" type="button" data-act="import-search">${icon('refresh')} Buscar grupos</button></div></div>
      <div id="imp-body"></div>
      <p class="muted" style="margin-top:10px">O link de convite só pode ser lido nos grupos em que a conta é administradora. Nos demais, o grupo entra sem link e o link inteligente não o usa.</p>`,
    footer: `<button class="btn" type="button" data-act="modal-close">Cancelar</button><button class="btn primary" type="button" id="imp-submit" data-act="import-submit" disabled>Importar grupos</button>`,
    onMount: () => { renderImportList(); },
    onClose: () => { imp = null; },
  });
}
/* envia a campanha ao n8n (link inteligente) e traz de volta a contagem de participantes */
function campaignPayload(c) {
  return {
    slug: c.slug, name: c.name, limit: GROUP_LIMIT,
    groups: c.groups.map((g) => ({ id: g.id, n: g.n, name: g.name, members: g.members, inviteLink: g.inviteLink, instance: (getAccount(g.accountId) || {}).instance || '' })),
  };
}
async function syncCampaign(c, { force = false } = {}) {
  if (state.settings.mode !== 'n8n' || !c.groups.length) return false;
  const r = await API.call('campaigns/sync', Object.assign(campaignPayload(c), { force }));
  let changed = false;
  (r.groups || []).forEach((u) => {
    const g = c.groups.find((x) => x.id === u.id);
    if (g && typeof u.members === 'number' && g.members !== u.members) { g.members = u.members; changed = true; }
  });
  if (changed) saveState();
  return changed;
}
function fillGroups(c, count) {
  let remaining = count; const gs = [...c.groups].sort((a, b) => a.n - b.n);
  for (const g of gs) {
    if (remaining <= 0) break;
    const free = GROUP_LIMIT - g.members; if (free <= 0) continue;
    const add = Math.min(free, remaining); g.members += add; remaining -= add;
  }
  return count - remaining;
}

/* =====================================================================
   Ações (lista, execução simulada, detalhes)
   ===================================================================== */
let actionsFilter = 'todas';
const FILTERS = { todas: 'Todas', agendada: 'Agendadas', 'em andamento': 'Em andamento', 'concluída': 'Concluídas', outras: 'Outras' };
function viewAcoes() {
  $('#page-actions').innerHTML = `<button class="btn primary" type="button" data-act="new-action">${icon('plus')} Adicionar ação</button>`;
  const v = $('#view');
  if (!state.actions.length) {
    v.innerHTML = emptyState('zap', 'Nenhuma ação feita ainda', 'Envie mensagens, troque nomes e imagens ou gerencie admins dos grupos de uma campanha.',
      `<button class="btn primary" type="button" data-act="new-action">Adicionar ação</button>`);
    return;
  }
  const list = state.actions.filter((a) => actionsFilter === 'todas' || (actionsFilter === 'outras' ? ['cancelada', 'falhou'].includes(a.status) : a.status === actionsFilter)).slice(0, 80);
  v.innerHTML = `<div class="tabs">${Object.entries(FILTERS).map(([k, l]) => `<button type="button" class="${actionsFilter === k ? 'on' : ''}" data-act="action-filter" data-f="${k}">${l}</button>`).join('')}</div>
    ${list.length ? `<div class="list"><div class="list-head row-actions"><span></span><span>Ação</span><span class="col-hide">Conta</span><span class="col-hide">Quando</span><span>Situação</span><span></span></div>
    ${list.map((a) => {
      const t = ACTION_TYPES[a.type] || { label: a.type, icon: 'zap' };
      const pct = a.progress && a.progress.total ? Math.round((a.progress.done / a.progress.total) * 100) : 0;
      return `<div class="list-row row-actions hover">
        <div class="type-ico">${icon(t.icon)}</div>
        <div class="cell-main"><b>${esc(t.label)}</b><span class="trunc">${esc((a.campaignNames || []).join(', '))} em ${a.groupCount} ${a.groupCount === 1 ? 'grupo' : 'grupos'}</span></div>
        <div class="cell-main col-hide"><b class="trunc">${esc(a.accountName || '-')}</b></div>
        <div class="cell-main col-hide"><span>${fmtDate(a.scheduledAt || a.createdAt)}</span></div>
        <div><span class="pill ${STATUS_PILL[a.status] || 'off'}">${esc(a.status)}</span>${a.status === 'em andamento' ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}</div>
        <div class="row-end">${a.status === 'agendada' ? `<button class="btn sm" type="button" data-act="action-edit" data-id="${a.id}">Editar</button>` : ''}<button class="btn sm" type="button" title="Criar uma nova ação a partir desta" data-act="action-duplicate" data-id="${a.id}">Duplicar</button><button class="btn sm" type="button" data-act="action-open" data-id="${a.id}">Detalhes</button></div></div>`;
    }).join('')}</div>` : '<div class="empty"><p>Nenhuma ação com esse filtro.</p></div>'}`;
}
function resolveTargets(a) {
  const out = [];
  for (const cid of a.campaignIds) {
    const c = getCampaign(cid); if (!c) continue;
    const t = a.targets[cid] || '*'; const gs = [...c.groups].sort((x, y) => x.n - y.n);
    (t === '*' ? gs : gs.filter((g) => t.includes(g.id))).forEach((g) => out.push({ c, g }));
  }
  return out;
}
const unitsPer = (type, content) => (type === 'send_message' ? Math.max(1, (content.items || []).length) : 1);
function describeUnit(a, idx) {
  if (a.type === 'send_message') { const it = a.content.items[idx]; return it ? `${KINDS[it.kind].label} enviado` : 'mensagem enviada'; }
  return { rename: 'nome alterado', description: 'descrição alterada', image: 'imagem alterada', settings: 'configuração alterada', add_admin: 'admins adicionados', remove_admin: 'admins removidos', remove_participants: 'participantes removidos', update_links: 'novo link gerado' }[a.type] || 'feito';
}
const sims = new Map();
function startSim(id) {
  if (sims.has(id)) return;
  const t = setInterval(() => {
    const a = getAction(id);
    if (!a || a.status !== 'em andamento') { clearInterval(t); sims.delete(id); return; }
    const gl = resolveTargets(a); const per = unitsPer(a.type, a.content); const k = a.progress.done;
    const tg = gl[Math.min(gl.length - 1, Math.floor(k / per))];
    a.log.push({ t: Date.now(), text: tg ? `${tg.g.name}: ${describeUnit(a, k % per)}` : 'Concluído' });
    if (a.log.length > 300) a.log.shift();
    a.progress.done++;
    if (a.progress.done >= a.progress.total) { finishAction(a); clearInterval(t); sims.delete(id); }
    saveState(); refreshIfRoute('acoes'); refreshActionModal();
  }, 750);
  sims.set(id, t);
}
/* aplica no painel o que a ação mudou nos grupos (nome, descrição, configuração, links) */
function applyEffects(a, links) {
  const c = a.content;
  resolveTargets(a).forEach(({ c: camp, g }) => {
    if (a.type === 'rename') { g.name = `${c.name} #${g.n}`; camp.groupCfg = Object.assign({}, camp.groupCfg, { base: c.name }); }
    if (a.type === 'description') g.description = c.description;
    if (a.type === 'settings' && c.msgSetting !== 'keep') g.adminsOnly = c.msgSetting === 'admins';
    if (a.type === 'update_links') {
      if (links && links[g.id]) g.inviteLink = links[g.id];
      else if (state.settings.mode === 'demo') g.inviteLink = 'https://chat.whatsapp.com/' + randomCode();
    }
  });
}
function finishAction(a) {
  applyEffects(a);
  a.status = 'concluída'; toast('Ação concluída', 'success');
}
function applyRemoteUpdate(a, u) {
  const was = a.status;
  if (u.status) a.status = u.status;
  if (u.progress) a.progress = u.progress;
  if (u.log) a.log = u.log;
  if (Array.isArray(u.notices) && u.notices.length) {
    a.noticesSeen = a.noticesSeen || 0;
    const fresh = u.notices.slice(a.noticesSeen);
    a.noticesSeen = u.notices.length;
    fresh.slice(0, 3).forEach((m) => toast(m, 'error'));
    if (fresh.length > 3) toast('Mais ' + (fresh.length - 3) + ' número(s) não puderam ser adicionados. Veja o registro da ação.', 'error');
  }
  if (was !== 'concluída' && a.status === 'concluída') {
    applyEffects(a, u.links); toast('Ação concluída', 'success');
    /* nome e links mudaram: atualiza o link inteligente */
    if (['rename', 'update_links'].includes(a.type)) a.campaignIds.forEach((id) => { const c = getCampaign(id); if (c) syncCampaign(c).catch(() => { /* tenta na próxima visita */ }); });
  }
  if (was !== 'falhou' && a.status === 'falhou') toast('A ação falhou. Veja o registro nos detalhes.', 'error');
}
function checkScheduled() {
  if (state.settings.mode !== 'demo') return;
  let changed = false;
  state.actions.forEach((a) => { if (a.status === 'agendada' && a.scheduledAt && a.scheduledAt <= Date.now()) { a.status = 'em andamento'; startSim(a.id); changed = true; } });
  if (changed) { saveState(); refreshIfRoute('acoes'); }
}
let lastSchedPoll = 0;
async function pollRemote() {
  if (state.settings.mode !== 'n8n') return;
  /* ações em andamento: a cada 5 s. Agendadas: só a cada 60 s, para não encher o histórico de execuções do n8n */
  const running = state.actions.filter((a) => a.status === 'em andamento').map((a) => a.id);
  const sched = state.actions.filter((a) => a.status === 'agendada').map((a) => a.id);
  const now = Date.now();
  const askSched = sched.length && now - lastSchedPoll >= 60000;
  if (askSched) lastSchedPoll = now;
  const ids = running.concat(askSched ? sched : []);
  if (!ids.length) return;
  try {
    const r = await API.call('actions/status', { ids });
    const seen = new Set((r.actions || []).map((u) => u.id));
    (r.actions || []).forEach((u) => { const a = getAction(u.id); if (a) { a.misses = 0; applyRemoteUpdate(a, u); } });
    /* ação que o n8n não conhece (criada em modo demonstração, ou perdida): depois de 3 consultas sem resposta, para de perguntar */
    ids.filter((id) => !seen.has(id)).forEach((id) => {
      const a = getAction(id); if (!a) return;
      a.misses = (a.misses || 0) + 1;
      if (a.misses >= 3) {
        a.status = 'falhou'; a.log = (a.log || []).concat([{ t: Date.now(), text: 'O n8n não encontrou esta ação. Ela pode ter sido criada em modo demonstração ou o envio não chegou a ser registrado.' }]);
        toast('Uma ação não foi encontrada no n8n e foi marcada como falha.', 'error');
      }
    });
    saveState(); refreshIfRoute('acoes'); refreshActionModal();
  } catch (e) { /* tenta no próximo ciclo */ }
}

let openActionId = null;
/* ---------- resultados: reações, votos de enquete e leituras ---------- */
const resultsCache = {};
const personLabel = (jid, name) => {
  const phone = /@s\.whatsapp\.net$/.test(jid || '') ? fmtPhone(jid) : '';
  if (phone && name) return name + ' (' + phone + ')';
  return phone || name || 'Contato com número oculto';
};
function resultsRows(a) {
  const rc = resultsCache[a.id]; if (!rc) return null;
  const gname = {}; (a.groups || []).forEach((g) => { gname[g.id] = g.name; });
  const items = (a.content.items || []).map((it, idx) => {
    const msgs = rc.sent.filter((x) => x.i === it.id);
    const row = { it, idx, groups: msgs.length, reactions: [], votes: [], poll: null, readCount: 0, deliveredCount: 0 };
    msgs.forEach((m) => {
      const d = rc.data[m.id] || {};
      (d.reactions || []).forEach((r) => row.reactions.push({ jid: r.jid, name: r.name, emoji: r.emoji, group: gname[m.g] || m.g }));
      row.readCount += d.readCount || 0; row.deliveredCount += d.deliveredCount || 0;
      if (d.poll) {
        row.poll = row.poll || {};
        d.poll.forEach((o) => { row.poll[o.name] = row.poll[o.name] || []; (o.voters || []).forEach((v) => { row.poll[o.name].push({ jid: v, group: gname[m.g] || m.g }); row.votes.push({ jid: v, option: o.name, group: gname[m.g] || m.g }); }); });
      }
    });
    return row;
  });
  return { items, stats: rc.stats, at: rc.at };
}
function resultsHtml(a) {
  if (a.type !== 'send_message') return '';
  const head = `<div class="preview-title" style="margin-top:18px;display:flex;align-items:center;gap:10px">Reações, votos e leituras
    <button class="btn sm" type="button" style="margin-left:auto" data-act="action-results" data-id="${a.id}">${resultsCache[a.id] ? 'Atualizar' : 'Ver resultados'}</button>
    ${resultsCache[a.id] ? `<button class="btn sm" type="button" data-act="action-results-csv" data-id="${a.id}">Baixar lista (CSV)</button>` : ''}</div>`;
  const R = resultsRows(a);
  if (!R) return head + '<p class="muted">Veja quem reagiu e quem votou em cada mensagem desta ação.</p>';
  const warn = !R.stats || !R.stats.received
    ? `<div class="callout">${icon('alert')}<p>Ainda não chegou nenhum evento da Evolution. Para guardar reações e votos, o webhook precisa estar configurado (veja o guia). Só mensagens enviadas depois disso são contadas.</p></div>` : '';
  const none = !R.items.some((r) => r.groups) ? '<p class="muted">Nenhuma mensagem desta ação foi registrada. Só ações enviadas depois da atualização guardam os dados.</p>' : '';
  const people = (list, withEmoji) => list.length ? `<details style="margin-top:6px"><summary>Ver pessoas (${list.length})</summary><div class="log" style="max-height:220px">${list.map((p) => `<div>${withEmoji ? esc(p.emoji) + ' ' : ''}${esc(personLabel(p.jid, p.name))} <span class="muted">${esc(p.group)}${p.option ? ' · ' + esc(p.option) : ''}</span></div>`).join('')}</div></details>` : '';
  const cards = R.items.filter((r) => r.groups).map((r) => {
    const k = KINDS[r.it.kind] || { label: r.it.kind };
    const title = esc(k.label) + (r.it.text || r.it.caption || r.it.question ? ': ' + esc(String(r.it.text || r.it.caption || r.it.question).slice(0, 60)) : '');
    const counts = {}; r.reactions.forEach((x) => { counts[x.emoji] = (counts[x.emoji] || 0) + 1; });
    let body = `<p style="margin:6px 0"><b>${r.reactions.length}</b> ${r.reactions.length === 1 ? 'reação' : 'reações'} ${Object.keys(counts).map((e) => `<span class="pill off" style="margin-left:4px">${esc(e)} ${counts[e]}</span>`).join('')}</p>${people(r.reactions, true)}`;
    if (r.poll) {
      const opts = Object.keys(r.poll); const total = opts.reduce((s, o) => s + r.poll[o].length, 0);
      body += `<div style="margin:10px 0 4px"><b>${total}</b> ${total === 1 ? 'voto' : 'votos'}</div>` + opts.map((o) => {
        const n = r.poll[o].length; const pct = total ? Math.round((n / total) * 100) : 0;
        return `<div style="margin:6px 0"><div style="display:flex;justify-content:space-between"><span>${esc(o)}</span><span>${n} (${pct}%)</span></div><div class="progress"><i style="width:${pct}%"></i></div>${people(r.poll[o].map((v) => ({ jid: v.jid, name: '', group: v.group })), false)}</div>`;
      }).join('');
    } else if (r.it.kind === 'poll') body += '<p class="muted" style="margin:6px 0">Nenhum voto registrado ainda.</p>';
    body += `<p class="muted" style="margin:8px 0 0">Entregue a ${fmtInt(r.deliveredCount)} e lida por ${fmtInt(r.readCount)} (${r.groups} ${r.groups === 1 ? 'grupo' : 'grupos'})</p>`;
    return `<div class="panel" style="margin:10px 0"><b>${title}</b>${body}</div>`;
  }).join('');
  return head + warn + none + cards + `<p class="muted" style="font-size:12px">A lista de quem leu só existe quando o WhatsApp informa: só vale para quem deixa a confirmação de leitura ligada e, em grupos grandes, o WhatsApp geralmente nem envia essa informação. Reações e votos são completos a partir do momento em que o webhook foi ligado. ${R.at ? 'Atualizado às ' + fmtTime(R.at) + '.' : ''}</p>`;
}
function actionDetailHtml(a) {
  const t = ACTION_TYPES[a.type] || { label: a.type };
  const pct = a.progress && a.progress.total ? Math.round((a.progress.done / a.progress.total) * 100) : 0;
  const targets = resolveTargets(a);
  return `<dl class="summary">
      <dt>Situação</dt><dd><span class="pill ${STATUS_PILL[a.status] || 'off'}">${esc(a.status)}</span>${a.status === 'em andamento' ? ` ${pct}%` : ''}</dd>
      <dt>Campanhas</dt><dd>${esc((a.campaignNames || []).join(', '))}</dd>
      <dt>Conta</dt><dd>${esc(a.accountName || '-')}</dd>
      <dt>Grupos</dt><dd>${a.groupCount}</dd>
      <dt>${a.scheduledAt ? 'Agendada para' : 'Criada em'}</dt><dd>${fmtDate(a.scheduledAt || a.createdAt)}</dd></dl>
    <div class="preview-title">${esc(t.label)}</div>${previewHtml(a.type, a.content, targets)}
    ${resultsHtml(a)}
    <div class="preview-title" style="margin-top:18px">Registro</div>
    <div class="log">${a.log && a.log.length ? a.log.slice(-40).map((l) => `<div><time>${fmtTime(l.t)}</time>${esc(l.text)}</div>`).join('') : '<div>Ainda sem registros.</div>'}</div>`;
}
function openActionModal(id) {
  const a = getAction(id); if (!a) return;
  openActionId = id;
  openModal({
    title: (ACTION_TYPES[a.type] || { label: 'Ação' }).label, size: 'lg', body: actionDetailHtml(a),
    footer: `<button class="btn danger sm" type="button" data-act="action-delete" data-id="${a.id}">${icon('trash')} Excluir</button>
      ${a.status === 'agendada' ? `<button class="btn" type="button" data-act="action-edit" data-id="${a.id}">Editar</button>` : ''}<button class="btn" type="button" data-act="action-duplicate" data-id="${a.id}">Duplicar</button>
      <button class="btn" type="button" data-act="action-cancel" data-id="${a.id}">Cancelar ação</button><button class="btn primary" type="button" data-act="modal-close">Fechar</button>`,
    onClose: () => { openActionId = null; },
  });
}
function refreshActionModal() {
  if (!openActionId) return;
  const a = getAction(openActionId); const mb = $('#modal-root .modal-body');
  if (a && mb) mb.innerHTML = actionDetailHtml(a);
}

/* =====================================================================
   Prévia (balões estilo WhatsApp e resumo de mudanças)
   ===================================================================== */
function wa(text) {
  return esc(text).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>').replace(/_([^_\n]+)_/g, '<em>$1</em>').replace(/~([^~\n]+)~/g, '<s>$1</s>').replace(/\n/g, '<br>');
}
function bubble(it, opts = {}) {
  let inner = '';
  switch (it.kind) {
    case 'text': inner = `<p>${it.text ? wa(it.text) : '<span class="ph">Sua mensagem aparece aqui</span>'}</p>`; break;
    case 'image': { const u = fileUrl(it.id); inner = (u ? `<img class="b-media" src="${u}" alt="">` : `<div class="b-media ph-media">${icon('image')}<span>${esc(it.fileName || 'Imagem')}</span></div>`) + (it.caption ? `<p>${wa(it.caption)}</p>` : ''); break; }
    case 'video': inner = `<div class="b-media ph-media">${icon('video')}<span>${esc(it.fileName || 'Vídeo')}</span></div>${it.caption ? `<p>${wa(it.caption)}</p>` : ''}`; break;
    case 'audio': inner = `<div class="b-audio">${icon('mic')}<div class="wave">${'<i></i>'.repeat(18)}</div><span>${esc(it.fileName || 'audio.ogg')}</span></div>`; break;
    case 'file': inner = `<div class="b-file">${icon('paperclip')}<span class="trunc">${esc(it.fileName || 'arquivo')}</span><small>${fmtSize(it.fileSize)}</small></div>`; break;
    case 'button': inner = `<p>${it.text ? wa(it.text) : '<span class="ph">Texto da mensagem</span>'}</p><div class="b-btn">${icon('link')} ${esc(it.label || 'Botão')}</div>`; break;
    case 'poll': inner = `<div class="b-poll"><strong>${esc(it.question || 'Pergunta da enquete')}</strong><small>${it.multiple ? 'Selecione uma ou mais opções' : 'Selecione uma opção'}</small>${(it.options || []).filter((o) => String(o).trim()).map((o) => `<div class="b-opt"><i></i>${esc(o)}</div>`).join('')}</div>`; break;
    default: inner = '';
  }
  return `<div class="bubble">${opts.mentionAll ? '<span class="b-mention">@todos</span>' : ''}${inner}<span class="b-time">${opts.pin ? icon('pin') : ''}12:00</span></div>`;
}
function previewHtml(type, c, targets) {
  if (type === 'send_message') {
    const first = targets[0];
    return `<div class="chat"><div class="chat-head"><span class="avatar" style="--h:${hueOf(first ? first.g.name : 'g')}">${esc((first ? first.g.name : 'G').charAt(0))}</span>${esc(first ? first.g.name : 'Nome do grupo')}</div>
      <div class="chat-body">${(c.items || []).length ? c.items.map((it) => bubble(it, { mentionAll: c.mentionAll, pin: c.pin })).join('') : '<div class="bubble"><p><span class="ph">Adicione conteúdos para ver a prévia</span></p></div>'}</div></div>`;
  }
  switch (type) {
    case 'rename':
      return `<ul class="changes">${targets.slice(0, 6).map((t) => `<li><s>${esc(t.g.name)}</s>${icon('arrow')}<b>${esc((c.name || '...') + ' #' + t.g.n)}</b></li>`).join('')}${targets.length > 6 ? `<li class="muted">e mais ${targets.length - 6} grupos</li>` : ''}</ul>`;
    case 'description': return `<div class="note-box">${c.description ? wa(c.description) : '<span class="muted">A nova descrição aparece aqui</span>'}</div>`;
    case 'image': { const u = fileUrl('groupImage'); return u ? `<img class="img-prev" src="${u}" alt="Nova imagem do grupo">` : `<div class="note-box">${c.imageName ? esc(c.imageName) : '<span class="muted">Escolha uma imagem</span>'}</div>`; }
    case 'settings': {
      const L = { keep: 'Manter como está', admins: 'Só admins', all: 'Todos os participantes' };
      return `<ul class="changes"><li><b>Enviar mensagens:</b> ${L[c.msgSetting] || L.keep}</li><li><b>Editar dados do grupo:</b> ${L[c.infoSetting] || L.keep}</li></ul>`;
    }
    case 'add_admin': case 'remove_admin': case 'remove_participants': {
      const p = parseNumbers(c.numbers);
      return `<ul class="changes">${p.valid.slice(0, 8).map((n) => `<li>${esc(fmtPhone(n))}</li>`).join('')}${p.valid.length > 8 ? `<li class="muted">e mais ${p.valid.length - 8} números</li>` : ''}${!p.valid.length ? '<li class="muted">Nenhum número válido ainda</li>' : ''}
        ${p.invalid.length ? `<li><span class="pill bad">${p.invalid.length} inválido${p.invalid.length > 1 ? 's' : ''}</span></li>` : ''}</ul>`;
    }
    case 'update_links': return '<div class="note-box">Os links antigos deixam de funcionar e cada grupo recebe um link novo.</div>';
    default: return '';
  }
}

/* =====================================================================
   Wizard de nova ação
   ===================================================================== */
const WIZ_STEPS = ['Campanha', 'Ação', 'Conta', 'Grupos', 'Conteúdo', 'Confirmar'];
let wiz = null;
function newWiz(pre) {
  return {
    step: 1, campaignIds: pre ? [pre] : [], type: '', accountId: '', targets: {},
    content: {
      items: [], mentionAll: false, pin: false, pinDuration: '7d', speed: { mode: 'normal', min: 15, max: 30 },
      name: '', description: '', imageName: '', imageSize: 0, msgSetting: 'keep', infoSetting: 'keep', numbers: '', revoke: true,
    },
    schedule: { mode: 'now', at: '' },
  };
}
function viewWizard() { if (!wiz) wiz = newWiz(); renderWizard(); }
function renderWizard() {
  $('#page-actions').innerHTML = '';
  const body = [step1, step2, step3, step4, step5, step6][wiz.step - 1]();
  $('#view').innerHTML = `<div class="wizard"><ol class="stepper">${WIZ_STEPS.map((s, i) => `<li class="${i + 1 === wiz.step ? 'on' : ''} ${i + 1 < wiz.step ? 'done' : ''}" ${i + 1 < wiz.step ? `data-act="wiz-goto" data-step="${i + 1}"` : ''}><span>${i + 1 < wiz.step ? icon('check') : i + 1}</span>${s}</li>`).join('')}</ol>
    <div>${wiz.editId ? `<div class="callout">${icon('alert')}<p>Você está editando uma ação agendada. Nada muda até você clicar em <b>Salvar alterações</b> no último passo.</p></div>` : ''}<div class="wiz-panel">${body}</div>${wizFooter()}</div></div>`;
  refreshPreview();
}
function wizFooter() {
  const last = wiz.step === 6;
  return `<div class="wiz-foot"><button class="btn ghost" type="button" data-act="wiz-cancel">Descartar</button><div class="grp">
    ${wiz.step > 1 ? '<button class="btn" type="button" data-act="wiz-back">Voltar</button>' : ''}
    ${last ? `<button class="btn primary" type="button" data-act="wiz-submit">${wiz.editId ? (wiz.schedule.mode === 'now' ? 'Salvar e enviar agora' : 'Salvar alterações') : wiz.schedule.mode === 'now' ? 'Enviar agora' : 'Agendar'}</button>` : '<button class="btn primary" type="button" data-act="wiz-next">Continuar</button>'}</div></div>`;
}
function step1() {
  if (!state.campaigns.length) return emptyState('layers', 'Nenhuma campanha criada', 'Crie uma campanha e seus grupos antes de montar uma ação.', '<a class="btn primary" href="#/campanhas">Ir para Campanhas</a>');
  return `<h2>Em quais campanhas?</h2><p class="lead">Escolha uma ou mais campanhas que vão receber a ação.</p>
    <div class="cards">${state.campaigns.map((c) => {
      const sel = wiz.campaignIds.includes(c.id); const total = c.groups.reduce((s, g) => s + g.members, 0);
      return `<button type="button" class="select-card ${sel ? 'on' : ''}" data-act="wiz-campaign" data-id="${c.id}"><span class="check">${sel ? icon('check') : ''}</span><b>${esc(c.name)}</b><small>${c.groups.length} grupos e ${fmtInt(total)} participantes</small></button>`;
    }).join('')}</div>`;
}
function step2() {
  return `<h2>O que você quer fazer?</h2><p class="lead">Escolha o tipo de ação.</p>
    <div class="cards">${Object.entries(ACTION_TYPES).map(([k, t]) => `<button type="button" class="select-card ${wiz.type === k ? 'on' : ''}" data-act="wiz-type" data-type="${k}"><span class="check">${wiz.type === k ? icon('check') : ''}</span><span class="t-ico">${icon(t.icon)}</span><b>${t.label}</b><small>${t.desc}</small></button>`).join('')}</div>`;
}
function step3() {
  if (!state.accounts.length) return emptyState('smartphone', 'Nenhuma conta conectada', 'Conecte um número para executar a ação.', '<a class="btn primary" href="#/contas">Ir para Contas</a>');
  return `<h2>Qual conta executa?</h2><p class="lead">O número escolhido precisa ser administrador dos grupos.</p>
    <div class="cards">${state.accounts.map((a) => {
      const ok = a.status === 'connected'; const sel = wiz.accountId === a.id;
      return `<button type="button" class="select-card ${sel ? 'on' : ''}" ${ok ? '' : 'disabled'} data-act="wiz-account" data-id="${a.id}"><span class="check">${sel ? icon('check') : ''}</span><b>${esc(a.name)}</b><small>${a.number ? esc(fmtPhone(a.number)) : esc(a.instance)}${ok ? '' : ' (desconectada)'}</small></button>`;
    }).join('')}</div>`;
}
function ensureTargets() {
  Object.keys(wiz.targets).forEach((k) => { if (!wiz.campaignIds.includes(k)) delete wiz.targets[k]; });
  wiz.campaignIds.forEach((id) => { if (!wiz.targets[id]) wiz.targets[id] = '*'; });
}
function step4() {
  ensureTargets();
  return `<h2>Em quais grupos?</h2><p class="lead">Use todos os grupos da campanha ou escolha só alguns.</p>
    ${wiz.campaignIds.map((id) => {
      const c = getCampaign(id); if (!c) return '';
      const t = wiz.targets[id]; const all = t === '*';
      const gs = [...c.groups].sort((a, b) => a.n - b.n);
      if (!gs.length) return `<div class="target-panel"><b>${esc(c.name)}</b><div class="callout bad" style="margin:10px 0 0">${icon('alert')}<p>Essa campanha ainda não tem grupos.</p></div></div>`;
      return `<div class="target-panel"><header><div><b>${esc(c.name)}</b> <small>${gs.length} grupos</small></div>
        <div class="seg"><button type="button" class="${all ? 'on' : ''}" data-act="wiz-target-all" data-c="${c.id}">Todos os grupos</button><button type="button" class="${all ? '' : 'on'}" data-act="wiz-target-some" data-c="${c.id}">Escolher grupos</button></div></header>
        ${all ? '' : `<div class="chips">${gs.map((g) => `<button type="button" class="chip ${t.includes(g.id) ? 'on' : ''}" data-act="wiz-target-group" data-c="${c.id}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}</div>`}</div>`;
    }).join('')}`;
}
function speedPanel() {
  const sp = wiz.content.speed;
  return `<div class="panel" style="margin-top:16px"><h4>${icon('clock')} Velocidade entre os ${wiz.type === 'send_message' ? 'envios' : 'grupos'}</h4>
    <div class="seg">${Object.entries(SPEEDS).map(([k, v]) => `<button type="button" class="${sp.mode === k ? 'on' : ''}" data-act="wiz-speed" data-mode="${k}">${v.label}${v.min ? `<small>${v.min} a ${v.max}s</small>` : ''}</button>`).join('')}</div>
    ${sp.mode === 'custom' ? `<div class="row" style="margin-top:14px"><label class="field"><span>Mínimo (segundos)</span><input type="number" min="3" data-model="content.speed.min" value="${esc(sp.min)}"></label><label class="field"><span>Máximo (segundos)</span><input type="number" min="3" data-model="content.speed.max" value="${esc(sp.max)}"></label></div>` : ''}
    <small class="hint ${sp.mode === 'fast' ? 'warn' : ''}">${SPEEDS[sp.mode].hint}</small></div>`;
}
function itemEditor(it, i) {
  const k = KINDS[it.kind]; const m = (f) => `content.items.${i}.${f}`;
  const filePick = (accept, label) => `<label class="file-pick ${it.fileName ? 'has' : ''}">${icon(k.icon)}<span>${it.fileName ? esc(it.fileName) + (it.fileSize ? ` (${fmtSize(it.fileSize)})` : '') : label}</span><input type="file" accept="${accept}" data-file="${it.id}" data-kind="${it.kind}"></label>`;
  let body = '';
  switch (it.kind) {
    case 'text': body = `<label class="field"><span>Mensagem</span><textarea rows="4" data-model="${m('text')}" placeholder="Escreva a mensagem. Use *negrito*, _itálico_ e ~riscado~.">${esc(it.text)}</textarea></label>`; break;
    case 'image': body = `${filePick('image/*', 'Escolher imagem')}<label class="field"><span>Legenda (opcional)</span><textarea rows="3" data-model="${m('caption')}">${esc(it.caption)}</textarea></label>`; break;
    case 'video': body = `${filePick('video/*', 'Escolher vídeo (mp4)')}<label class="field"><span>Legenda (opcional)</span><textarea rows="3" data-model="${m('caption')}">${esc(it.caption)}</textarea></label>`; break;
    case 'audio': body = `${filePick('.ogg,audio/ogg', 'Escolher áudio .ogg')}<small>Use arquivos .ogg com codec opus para o áudio aparecer como mensagem de voz.</small>`; break;
    case 'file': body = filePick('*/*', 'Escolher arquivo'); break;
    case 'button': body = `<label class="field"><span>Texto da mensagem</span><textarea rows="3" data-model="${m('text')}">${esc(it.text)}</textarea></label>
      <div class="row"><label class="field"><span>Texto do botão</span><input type="text" maxlength="25" data-model="${m('label')}" value="${esc(it.label)}" placeholder="Ver ofertas"></label>
      <label class="field"><span>Link do botão</span><input type="url" data-model="${m('url')}" value="${esc(it.url)}" placeholder="https://"></label></div>`; break;
    case 'poll': body = `<label class="field"><span>Pergunta</span><input type="text" data-model="${m('question')}" value="${esc(it.question)}"></label>
      <div class="field"><span>Opções</span>${it.options.map((o, j) => `<div class="opt-row"><input type="text" data-model="${m('options.' + j)}" value="${esc(o)}" placeholder="Opção ${j + 1}"><button type="button" class="icon-btn danger" data-act="wiz-poll-del" data-i="${i}" data-j="${j}" aria-label="Remover opção">${icon('x')}</button></div>`).join('')}
      ${it.options.length < 12 ? `<button type="button" class="btn sm" data-act="wiz-poll-add" data-i="${i}">${icon('plus')} Adicionar opção</button>` : ''}</div>
      <div class="switch-row"><b>Permitir mais de uma resposta</b><label class="switch"><input type="checkbox" data-model="${m('multiple')}" ${it.multiple ? 'checked' : ''}><span class="slider"></span></label></div>`; break;
    default: body = '';
  }
  return `<div class="item-card"><div class="item-head"><b>${icon(k.icon)} ${k.label}</b><div>
    <button type="button" class="icon-btn" data-act="wiz-item-up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Subir">${icon('up')}</button>
    <button type="button" class="icon-btn" data-act="wiz-item-down" data-i="${i}" ${i === wiz.content.items.length - 1 ? 'disabled' : ''} aria-label="Descer">${icon('down')}</button>
    <button type="button" class="icon-btn danger" data-act="wiz-item-del" data-i="${i}" aria-label="Remover conteúdo">${icon('trash')}</button></div></div><div class="item-body">${body}</div></div>`;
}
function step5() {
  const c = wiz.content; const t = ACTION_TYPES[wiz.type]; let editor = '';
  switch (wiz.type) {
    case 'send_message':
      editor = `<div class="palette">${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="btn sm" data-act="wiz-add-item" data-kind="${k}">${icon(v.icon)} ${v.label}</button>`).join('')}</div>
        ${c.items.length ? c.items.map(itemEditor).join('') : `<div class="note-box" style="margin-bottom:14px">Escolha um tipo acima para adicionar o primeiro conteúdo. Eles são enviados na ordem em que aparecem aqui.</div>`}
        <div class="panel" style="margin-top:16px"><h4>Opções de envio</h4>
          <div class="switch-row"><div><b>Marcar todos os participantes</b><small>Notifica todo mundo do grupo (@todos).</small></div><label class="switch"><input type="checkbox" data-model="content.mentionAll" ${c.mentionAll ? 'checked' : ''}><span class="slider"></span></label></div>
          <div class="switch-row"><div><b>Fixar mensagem</b><small>Mantém a mensagem no topo do grupo.</small></div><label class="switch"><input type="checkbox" data-model="content.pin" data-rerender="1" ${c.pin ? 'checked' : ''}><span class="slider"></span></label></div>
          ${c.pin ? `<label class="field" style="margin-top:8px"><span>Fixar por</span><select data-model="content.pinDuration"><option value="24h" ${c.pinDuration === '24h' ? 'selected' : ''}>24 horas</option><option value="7d" ${c.pinDuration === '7d' ? 'selected' : ''}>7 dias</option><option value="30d" ${c.pinDuration === '30d' ? 'selected' : ''}>30 dias</option></select></label>` : ''}</div>`; break;
    case 'rename': editor = `<label class="field"><span>Novo nome base</span><input type="text" data-model="content.name" value="${esc(c.name)}" placeholder="Ex.: Bruno VIP"><small>A numeração de cada grupo é mantida automaticamente (#1, #2...).</small></label>`; break;
    case 'description': editor = `<label class="field"><span>Nova descrição</span><textarea rows="6" data-model="content.description">${esc(c.description)}</textarea></label>`; break;
    case 'image': editor = `<label class="file-pick ${c.imageName ? 'has' : ''}">${icon('image')}<span>${c.imageName ? esc(c.imageName) : 'Escolher imagem do grupo'}</span><input type="file" accept="image/*" data-file="groupImage" data-kind="image"></label>`; break;
    case 'settings': editor = `<label class="field"><span>Quem pode enviar mensagens</span><select data-model="content.msgSetting"><option value="keep" ${c.msgSetting === 'keep' ? 'selected' : ''}>Manter como está</option><option value="admins" ${c.msgSetting === 'admins' ? 'selected' : ''}>Só admins</option><option value="all" ${c.msgSetting === 'all' ? 'selected' : ''}>Todos os participantes</option></select></label>
      <label class="field"><span>Quem pode editar os dados do grupo</span><select data-model="content.infoSetting"><option value="keep" ${c.infoSetting === 'keep' ? 'selected' : ''}>Manter como está</option><option value="admins" ${c.infoSetting === 'admins' ? 'selected' : ''}>Só admins</option><option value="all" ${c.infoSetting === 'all' ? 'selected' : ''}>Todos os participantes</option></select></label>`; break;
    case 'add_admin': case 'remove_admin': case 'remove_participants':
      editor = `${wiz.type === 'remove_participants' ? `<div class="callout">${icon('alert')}<p>Os participantes removidos saem dos grupos na hora. Confira os números antes de continuar.</p></div>` : ''}
        <label class="field"><span>Números (um por linha)</span><textarea rows="7" data-model="content.numbers" placeholder="47999999999&#10;47988888888">${esc(c.numbers)}</textarea><small>Com DDD. O 55 é adicionado sozinho.</small></label>`; break;
    case 'update_links': editor = `<div class="note-box">Os links de convite atuais serão revogados e novos links serão gerados para cada grupo. Quem tem o link antigo não consegue mais entrar.</div>`; break;
    default: editor = '';
  }
  return `<h2>${esc(t.label)}</h2><p class="lead">${wiz.type === 'send_message' ? 'Monte as mensagens que serão enviadas.' : 'Preencha o que será alterado.'}</p>
    <div class="wiz-split"><div>${editor}${speedPanel()}</div><div class="sticky"><div class="preview-title">Prévia</div><div id="wiz-preview"></div></div></div>`;
}
function unitsPerGroup() { return unitsPer(wiz.type, wiz.content); }
function step6() {
  const targets = resolveTargets(wiz); const acc = getAccount(wiz.accountId); const sp = speedRange(wiz.content.speed);
  const sends = targets.length * unitsPerGroup(); const est = formatDuration(sends * ((sp.min + sp.max) / 2));
  const camps = wiz.campaignIds.map((id) => (getCampaign(id) || {}).name).filter(Boolean);
  if (wiz.schedule.mode === 'later' && !wiz.schedule.at) wiz.schedule.at = toLocalInput(new Date(Date.now() + 3600000));
  return `<h2>Confira antes de enviar</h2><p class="lead">Revise tudo. Depois escolha enviar agora ou agendar.</p>
    <dl class="summary"><dt>Ação</dt><dd>${esc(ACTION_TYPES[wiz.type].label)}</dd><dt>Campanhas</dt><dd>${esc(camps.join(', '))}</dd>
      <dt>Conta</dt><dd>${esc(acc ? acc.name : '-')}</dd><dt>Grupos</dt><dd>${targets.length}</dd>
      <dt>Velocidade</dt><dd>${esc(SPEEDS[wiz.content.speed.mode].label)} (${sp.min} a ${sp.max}s)</dd>
      <dt>Duração estimada</dt><dd>${est}</dd></dl>
    <div class="preview-title">Conteúdo</div><div id="wiz-preview" style="max-width:380px"></div>
    <div class="panel" style="margin-top:20px"><h4>${icon('clock')} Quando enviar</h4>
      <div class="seg"><button type="button" class="${wiz.schedule.mode === 'now' ? 'on' : ''}" data-act="wiz-sched" data-mode="now">Enviar agora</button><button type="button" class="${wiz.schedule.mode === 'later' ? 'on' : ''}" data-act="wiz-sched" data-mode="later">Agendar</button></div>
      ${wiz.schedule.mode === 'later' ? `<label class="field" style="margin-top:14px;max-width:280px"><span>Data e hora</span><input type="datetime-local" data-model="schedule.at" min="${toLocalInput(new Date())}" value="${esc(wiz.schedule.at)}"></label>` : ''}</div>`;
}
function refreshPreview() {
  const el = $('#wiz-preview'); if (!el || !wiz) return;
  el.innerHTML = previewHtml(wiz.type, wiz.content, resolveTargets(wiz));
}
function validateContent() {
  const c = wiz.content;
  const sp = speedRange(c.speed);
  if (sp.min > sp.max) return 'O intervalo mínimo não pode ser maior que o máximo.';
  switch (wiz.type) {
    case 'send_message': {
      if (!c.items.length) return 'Adicione pelo menos um conteúdo.';
      for (let i = 0; i < c.items.length; i++) {
        const it = c.items[i]; const n = `Conteúdo ${i + 1} (${KINDS[it.kind].label})`;
        if (it.kind === 'text' && !it.text.trim()) return `${n}: escreva a mensagem.`;
        if (['image', 'video', 'audio', 'file'].includes(it.kind) && !fileStore.has(it.id) && !it.kept) return `${n}: escolha um arquivo.`;
        if (it.kind === 'button') {
          if (!it.text.trim() || !it.label.trim()) return `${n}: preencha o texto e o nome do botão.`;
          if (!/^https?:\/\/\S+$/i.test(it.url.trim())) return `${n}: informe um link válido começando com http.`;
        }
        if (it.kind === 'poll') {
          if (!it.question.trim()) return `${n}: escreva a pergunta.`;
          if (it.options.filter((o) => o.trim()).length < 2) return `${n}: informe pelo menos 2 opções.`;
        }
      }
      return '';
    }
    case 'rename': return c.name.trim() ? '' : 'Informe o novo nome base.';
    case 'description': return c.description.trim() ? '' : 'Escreva a nova descrição.';
    case 'image': return fileStore.has('groupImage') ? '' : 'Escolha uma imagem.';
    case 'settings': return c.msgSetting === 'keep' && c.infoSetting === 'keep' ? 'Altere pelo menos uma configuração.' : '';
    case 'add_admin': case 'remove_admin': case 'remove_participants': {
      const p = parseNumbers(c.numbers);
      if (!p.valid.length) return 'Informe pelo menos um número válido.';
      return p.invalid.length ? `${p.invalid.length} número(s) inválido(s). Corrija ou remova para continuar.` : '';
    }
    default: return '';
  }
}
function validateStep(step) {
  if (step === 1) return wiz.campaignIds.length ? '' : 'Escolha pelo menos uma campanha.';
  if (step === 2) return wiz.type ? '' : 'Escolha o tipo de ação.';
  if (step === 3) { const a = getAccount(wiz.accountId); return a && a.status === 'connected' ? '' : 'Escolha uma conta conectada.'; }
  if (step === 4) {
    ensureTargets();
    for (const id of wiz.campaignIds) {
      const c = getCampaign(id);
      if (!c || !c.groups.length) return `A campanha ${c ? c.name : ''} não tem grupos.`;
      if (wiz.targets[id] !== '*' && !wiz.targets[id].length) return `Escolha pelo menos um grupo em ${c.name}.`;
    }
    return '';
  }
  if (step === 5) return validateContent();
  return '';
}
function buildAction() {
  const targets = resolveTargets(wiz); const later = wiz.schedule.mode === 'later';
  const acc = getAccount(wiz.accountId);
  return {
    id: uid('act'), type: wiz.type, campaignIds: [...wiz.campaignIds], campaignNames: wiz.campaignIds.map((id) => (getCampaign(id) || {}).name),
    accountId: wiz.accountId, accountName: acc ? acc.name : '', instance: acc ? acc.instance : '',
    targets: JSON.parse(JSON.stringify(wiz.targets)),
    content: Object.assign(JSON.parse(JSON.stringify(wiz.content)), { numbersList: parseNumbers(wiz.content.numbers).valid }),
    groupIds: targets.map((t) => t.g.id),
    groups: targets.map((t) => ({ id: t.g.id, n: t.g.n, name: t.g.name })),
    status: later ? 'agendada' : 'em andamento', progress: { done: 0, total: targets.length * unitsPerGroup() }, groupCount: targets.length,
    scheduledAt: later ? new Date(wiz.schedule.at).getTime() : null, createdAt: Date.now(), log: [],
  };
}
function handleFile(input) {
  const key = input.dataset.file; const f = input.files && input.files[0]; if (!f || !wiz) return;
  const kind = input.dataset.kind;
  if (kind === 'audio' && !/\.ogg$/i.test(f.name)) { toast('O áudio precisa estar no formato .ogg', 'error'); input.value = ''; return; }
  if (kind === 'image' && !f.type.startsWith('image/')) { toast('Escolha um arquivo de imagem', 'error'); input.value = ''; return; }
  if (kind === 'video' && !f.type.startsWith('video/')) { toast('Escolha um arquivo de vídeo', 'error'); input.value = ''; return; }
  const maxMb = state.settings.mode === 'n8n' && !mediaBase() ? 12 : 100;
  if (f.size > maxMb * 1024 * 1024) {
    toast('O arquivo tem ' + (f.size / 1048576).toFixed(1) + ' MB e o limite é ' + maxMb + ' MB.' + (maxMb === 12 ? ' Para arquivos maiores, preencha o Servidor de arquivos em Configurações.' : ''), 'error');
    input.value = ''; return;
  }
  dropFile(key); fileStore.set(key, f);
  if (key === 'groupImage') { wiz.content.imageName = f.name; wiz.content.imageSize = f.size; }
  else { const it = wiz.content.items.find((x) => x.id === key); if (it) { it.fileName = f.name; it.fileSize = f.size; it.fileType = f.type; it.kept = false; } }
  renderWizard();
}

/* =====================================================================
   Configurações
   ===================================================================== */
const API_DOCS = [
  { path: 'ping', desc: 'Testa a conexão e a senha. Devolve o cliente a quem a senha pertence; as contas dele começam com o prefixo.', req: {}, res: { ok: true, client: { id: 'bruno', name: 'Bruno', prefix: 'bruno-' } } },
  { path: 'groups/list', desc: 'Lista os grupos que já existem na conta (tamanho, descrição, só admins, data de criação).', req: { instance: 'clush-atendimento' }, res: { groups: [{ id: '1203...@g.us', name: 'Promoções 1', size: 412, description: '...', adminsOnly: true, createdAt: 1700000000000 }] } },
  { path: 'groups/import', desc: 'Lê o link de convite dos grupos escolhidos. Link vazio quando a conta não é administradora.', req: { instance: 'clush-atendimento', groupIds: ['1203...@g.us'] }, res: { links: [{ id: '1203...@g.us', inviteLink: 'https://chat.whatsapp.com/...' }] } },
  { path: 'state/load', desc: 'Devolve os dados do painel (contas, campanhas, ações) guardados para o cliente.', req: {}, res: { state: { accounts: [], campaigns: [], actions: [] }, updatedAt: 1700000000000 } },
  { path: 'state/save', desc: 'Guarda os dados do painel do cliente (limite de 2 MB).', req: { state: { accounts: [], campaigns: [], actions: [] } }, res: { ok: true } },
  { path: 'accounts/connect', desc: 'Cria a instância (se não existir) e devolve o QR Code.', req: { instance: 'clush-atendimento', name: 'Atendimento Clush', number: '5547999990000 (opcional: conecta por código em vez de QR)' }, res: { qr: 'data:image/png;base64,...', pairingCode: 'ABCD1234 (só quando number foi enviado)' } },
  { path: 'accounts/status', desc: 'Consulta o estado da conexão. O painel consulta a cada 3 segundos.', req: { instance: 'clush-atendimento' }, res: { state: 'open', number: '5547999999999' } },
  { path: 'accounts/logout', desc: 'Desconecta o número (mantém a instância).', req: { instance: 'clush-atendimento' }, res: { ok: true } },
  { path: 'accounts/delete', desc: 'Remove a instância.', req: { instance: 'clush-atendimento' }, res: { ok: true } },
  { path: 'groups/create', desc: 'Cria os grupos, aplica descrição, só admins e imagem, e devolve os links.', req: { instance: 'clush-atendimento', campaignId: 'camp_x', base: 'Bruno VIP', startAt: 1, quantity: 2, participants: ['5547999990000'], adminsOnly: true, description: '...', limit: 800, image: { name: 'logo.png', type: 'image/png', base64: '...' } }, res: { groups: [{ id: '1203...@g.us', n: 1, name: 'Bruno VIP #1', inviteLink: 'https://chat.whatsapp.com/...' }] } },
  { path: 'campaigns/sync', desc: 'Envia a campanha e seus grupos para o link inteligente. Devolve a contagem atual de participantes. Com force=true o n8n aceita as contagens enviadas.', req: { slug: 'bruno-vip-123', name: 'Bruno VIP', limit: 800, force: false, groups: [{ id: '1203...@g.us', n: 1, name: 'Bruno VIP #1', members: 412, inviteLink: 'https://chat.whatsapp.com/...', instance: 'clush-atendimento' }] }, res: { ok: true, groups: [{ id: '1203...@g.us', members: 412 }] } },
  { path: 'campaigns/delete', desc: 'Remove a campanha do link inteligente.', req: { slug: 'bruno-vip-123' }, res: { ok: true } },
  { path: 'groups/sync', desc: 'Conta os participantes de cada grupo (botão "Atualizar participantes" na campanha).', req: { instance: 'clush-atendimento', groupIds: ['1203...@g.us'] }, res: { groups: [{ id: '1203...@g.us', members: 412 }] } },
  { path: 'actions/run', desc: 'Recebe a ação completa (conteúdo, grupos, velocidade, agendamento). Se scheduledAt vier preenchido, o n8n agenda.', req: { action: { id: 'act_x', type: 'send_message', instance: 'clush-atendimento', groups: [{ id: '1203...@g.us', n: 1, name: 'Bruno VIP #1' }], content: { items: [{ id: 'it_x', kind: 'image', caption: 'Olá!', fileName: 'foto.jpg' }], mentionAll: false, pin: false, speed: { mode: 'normal', min: 15, max: 30 }, numbersList: [] }, scheduledAt: null }, files: { it_x: { name: 'foto.jpg', type: 'image/jpeg', base64: '...' } } }, res: { id: 'act_x', status: 'em andamento' } },
  { path: 'actions/status', desc: 'Progresso das ações abertas. O painel consulta a cada 5 segundos. Em "links" vão os novos links de convite (ação de atualizar links).', req: { ids: ['act_x'] }, res: { actions: [{ id: 'act_x', status: 'concluída', progress: { done: 4, total: 4 }, log: [{ t: 1760000000000, text: 'Bruno VIP #1: Texto enviado' }], links: { '1203...@g.us': 'https://chat.whatsapp.com/...' } }] } },
  { path: 'messages/info', desc: 'Devolve as reações, votos de enquete e leituras das mensagens de uma ação (dados capturados pelo webhook da Evolution).', req: { id: 'act_x' }, res: { sent: [{ id: 'WAID', g: '1203...@g.us', i: 'it_x' }], data: { WAID: { reactions: [{ jid: '5547...@s.whatsapp.net', emoji: '👍', name: 'Ana' }], poll: [{ name: 'Opção A', voters: ['5547...@s.whatsapp.net'] }], readCount: 0, deliveredCount: 0 } }, stats: { received: 10 } } },
  { path: 'actions/cancel', desc: 'Cancela uma ação agendada ou em andamento e apaga os arquivos dela do servidor de arquivos. Com keepMedia: true os arquivos ficam (usado ao editar uma ação agendada).', req: { id: 'act_x', keepMedia: false }, res: { ok: true } },
];
function viewConfig() {
  const s = state.settings;
  $('#view').innerHTML = `<div class="panel"><h3>Conexão com o backend</h3><p class="lead">Em modo demonstração nada é enviado de verdade. Em modo n8n, cada ação chama um webhook seu.</p>
      <div class="row"><label class="field"><span>Modo</span><select id="cfg-mode"><option value="demo" ${s.mode === 'demo' ? 'selected' : ''}>Demonstração</option><option value="n8n" ${s.mode === 'n8n' ? 'selected' : ''}>n8n</option></select></label>
      <label class="field"><span>URL base dos webhooks</span><input id="cfg-url" type="text" value="${esc(s.baseUrl)}" placeholder="https://n8n.seudominio.com/webhook/viphub"></label></div>
      <label class="field"><span>Servidor de arquivos (opcional)</span><input id="cfg-media" type="text" value="${esc(s.mediaUrl || '')}" placeholder="https://midia.seudominio.com"><small>Para enviar vídeos e arquivos grandes (até 100 MB). O arquivo sobe para o seu servidor, é enviado aos grupos e apagado depois. Em branco, o limite é 12 MB.</small></label>
      <label class="field"><span>Senha de acesso</span><input id="cfg-token" type="password" autocomplete="off" value="${esc(s.token)}" placeholder="A senha que você recebeu"><small>Identifica o seu cliente no n8n e é enviada no cabeçalho Authorization. ${s.client ? 'Conectado como <b>' + esc(s.client.name) + '</b>.' : ''}</small></label>
      <div style="display:flex;gap:8px"><button class="btn primary" type="button" data-act="cfg-save">Salvar</button><button class="btn" type="button" data-act="cfg-test">Testar conexão</button></div></div>
    <div class="panel"><h3>Dados do painel</h3><p class="lead">${s.mode === 'n8n' ? 'No modo n8n ficam guardados no servidor, na sua conta, e aparecem em qualquer aparelho. Este navegador mantém só uma cópia.' : 'Ficam guardados neste navegador.'}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${s.mode === 'n8n' ? '<button class="btn" type="button" data-act="cfg-pull">Atualizar do servidor</button>' : ''}<button class="btn" type="button" data-act="cfg-seed">Carregar dados de exemplo</button><button class="btn" type="button" data-act="cfg-export">Exportar</button>
      <label class="btn">Importar<input id="cfg-import-file" type="file" accept="application/json" hidden></label><button class="btn danger" type="button" data-act="cfg-reset">Apagar tudo</button></div></div>
    <div class="panel"><h3>Contrato da API</h3><p class="lead">Todas as chamadas são POST com JSON para a URL base mais o caminho abaixo. É isso que cada webhook do n8n precisa responder.</p>
      ${API_DOCS.map((d) => `<div class="endpoint"><span class="method">POST</span><code>/${esc(d.path)}</code></div><p class="muted">${esc(d.desc)}</p>
        <pre class="code">${esc(JSON.stringify({ request: d.req, response: d.res }, null, 2))}</pre>`).join('')}</div>`;
}
function seedDemo() {
  const acc = { id: uid('acc'), name: 'Atendimento Bruno', instance: 'bruno-atendimento', number: '5547991234567', status: 'connected', createdAt: Date.now() - 864e5 * 3 };
  const mk = (n, members) => ({ id: uid('g') + '@g.us', n, name: `Bruno VIP #${n}`, members, adminsOnly: true, description: 'Grupo VIP com ofertas antecipadas.', inviteLink: 'https://chat.whatsapp.com/' + randomCode(), accountId: acc.id });
  const camp = { id: uid('camp'), name: 'Bruno VIP', slug: 'bruno-vip-' + rand(100, 999), description: 'Lista VIP de revendedores', accountId: acc.id, groupCfg: { base: 'Bruno VIP', adminsOnly: true, description: 'Grupo VIP com ofertas antecipadas.' }, groups: [mk(1, 798), mk(2, 120), mk(3, 0)], createdAt: Date.now() - 864e5 };
  state.accounts.push(acc); state.campaigns.push(camp); saveState();
}

/* =====================================================================
   Eventos
   ===================================================================== */
const A = {};
A['modal-close'] = () => closeModal();
A['modal-backdrop'] = () => closeModal();
A['confirm-ok'] = () => { const r = pendingConfirm; pendingConfirm = null; if (r) r(true); closeModal(); };
A['toggle-nav'] = () => document.body.classList.toggle('nav-open');
A['toggle-theme'] = () => { state.settings.theme = state.settings.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = state.settings.theme; saveState(); };
A.copy = (el) => {
  const txt = el.dataset.copy;
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast('Link copiado', 'success')).catch(() => toast('Não foi possível copiar', 'error'));
  else toast('Copie manualmente: ' + txt);
};

/* contas */
A['account-connect'] = () => openConnectModal();
A['account-reconnect'] = (el) => openConnectModal(el.dataset.id);
A['conn-generate'] = async (btn) => {
  const name = $('#conn-name').value.trim(); const instance = withPrefix(slug($('#conn-instance').value || name));
  if (!name) return toast('Informe o nome da conta', 'error');
  if (!instance) return toast('Informe a instância', 'error');
  if (!btn.dataset.id && state.accounts.some((a) => a.instance === instance)) return toast('Já existe uma conta com essa instância', 'error');
  connNumber = '';
  if ($('#conn-method').value === 'code') {
    const ph = parseNumbers($('#conn-phone').value);
    if (ph.valid.length !== 1) return toast('Informe o número do WhatsApp com DDD, por exemplo (47) 99999-0000', 'error');
    connNumber = ph.valid[0];
  }
  setBusy(btn, true);
  try {
    let acc = btn.dataset.id ? getAccount(btn.dataset.id) : null;
    if (!acc) { acc = { id: uid('acc'), name, instance, number: '', status: 'connecting', createdAt: Date.now() }; state.accounts.push(acc); } else acc.status = 'connecting';
    saveState(); refreshIfRoute('contas');
    await showQr(acc);
  } catch (e) { toast(e.message, 'error'); } finally { setBusy(btn, false); }
};
A['conn-simulate'] = () => {
  if (!qrState) return;
  demoScans[qrState.acc.instance] = '5547' + '9' + rand(10000000, 99999999);
  pollAccount(qrState.acc);
};
A['account-refresh'] = async (btn) => {
  const acc = getAccount(btn.dataset.id); if (!acc) return;
  setBusy(btn, true);
  try {
    const r = await API.call('accounts/status', { instance: acc.instance });
    acc.status = r.state === 'open' || r.state === 'connected' ? 'connected' : (acc.status === 'connecting' ? 'connecting' : 'disconnected');
    if (r.number) acc.number = String(r.number).replace(/\D/g, '');
    saveState(); toast('Situação atualizada', 'success'); route();
  } catch (e) { toast(e.message, 'error'); setBusy(btn, false); }
};
A['account-logout'] = async (btn) => {
  const acc = getAccount(btn.dataset.id); if (!acc) return;
  if (!(await confirmDialog(`Desconectar ${acc.name}? Será preciso ler o QR Code de novo para usar esse número.`, { okLabel: 'Desconectar' }))) return;
  try { await API.call('accounts/logout', { instance: acc.instance }); acc.status = 'disconnected'; saveState(); toast('Número desconectado'); route(); } catch (e) { toast(e.message, 'error'); }
};
A['account-delete'] = async (btn) => {
  const acc = getAccount(btn.dataset.id); if (!acc) return;
  if (!(await confirmDialog(`Remover a conta ${acc.name}? Os grupos já criados continuam no WhatsApp.`, { okLabel: 'Remover', danger: true }))) return;
  try {
    await API.call('accounts/delete', { instance: acc.instance });
    state.accounts = state.accounts.filter((a) => a.id !== acc.id);
    state.campaigns.forEach((c) => { if (c.accountId === acc.id) c.accountId = ''; });
    saveState(); toast('Conta removida'); route();
  } catch (e) { toast(e.message, 'error'); }
};

/* campanhas */
A['campaign-new'] = () => openCampaignModal();
A['campaign-create'] = () => {
  const name = $('#c-name').value.trim(); if (!name) return toast('Informe o nome da campanha', 'error');
  const c = { id: uid('camp'), name, slug: slug(name) + '-' + rand(100, 999), description: $('#c-desc').value.trim(), accountId: $('#c-account').value, groupCfg: { base: name, adminsOnly: true, description: '' }, groups: [], createdAt: Date.now() };
  state.campaigns.push(c); saveState(); closeModal(); toast('Campanha criada', 'success'); location.hash = '#/campanhas/' + c.id;
};
A['campaign-delete'] = async (el) => {
  const c = getCampaign(el.dataset.id); if (!c) return;
  if (!(await confirmDialog(`Excluir a campanha ${c.name}? Os grupos continuam no WhatsApp, mas saem do painel.`, { okLabel: 'Excluir', danger: true }))) return;
  if (state.settings.mode === 'n8n') API.call('campaigns/delete', { slug: c.slug }).catch(() => { /* já não existe no n8n */ });
  state.campaigns = state.campaigns.filter((x) => x.id !== c.id); saveState(); toast('Campanha excluída'); location.hash = '#/campanhas';
};
A['campaign-action'] = (el) => { wiz = newWiz(el.dataset.id); location.hash = '#/acoes/nova'; };
A['groups-open'] = (el) => openGroupsModal(el.dataset.id);
A['import-open'] = (el) => openImportModal(el.dataset.id);
A['import-search'] = async (btn) => {
  if (!imp) return;
  const acc = getAccount($('#imp-account').value); if (!acc) return toast('Escolha uma conta', 'error');
  imp.accountId = acc.id; setBusy(btn, true);
  try { const res = await API.call('groups/list', { instance: acc.instance }); imp.groups = res.groups || []; imp.sel = new Set(); renderImportList(); }
  catch (e) { toast(e.message, 'error'); } finally { setBusy(btn, false); }
};
A['import-all'] = () => {
  if (!imp) return; const used = groupsInCampaigns();
  const free = importVisible().filter((g) => !used[g.id]);
  const all = free.length && free.every((g) => imp.sel.has(g.id));
  free.forEach((g) => { if (all) imp.sel.delete(g.id); else imp.sel.add(g.id); });
  renderImportList();
};
A['import-submit'] = async (btn) => {
  if (!imp || !imp.groups) return;
  const c = getCampaign(imp.campId); const acc = getAccount(imp.accountId); if (!c || !acc) return;
  const used = groupsInCampaigns();
  const chosen = importSorted().filter((g) => imp.sel.has(g.id) && !used[g.id]);
  if (!chosen.length) return toast('Escolha pelo menos um grupo', 'error');
  setBusy(btn, true);
  try {
    const res = await API.call('groups/import', { instance: acc.instance, groupIds: chosen.map((g) => g.id) });
    const links = {}; (res.links || []).forEach((l) => { links[l.id] = l.inviteLink || ''; });
    let n = c.groups.length ? Math.max(...c.groups.map((g) => g.n)) : 0; let noLink = 0;
    chosen.forEach((g) => {
      n += 1; const link = links[g.id] || ''; if (!link) noLink += 1;
      c.groups.push({ id: g.id, n, name: g.name, members: g.size, adminsOnly: g.adminsOnly, description: g.description, inviteLink: link, accountId: acc.id, imported: true });
    });
    if (!c.accountId) c.accountId = acc.id;
    saveState(); closeModal(); route();
    toast(`${chosen.length} grupo(s) importado(s)${noLink ? `. ${noLink} sem link de convite (a conta não é admin deles)` : ''}`, noLink ? 'info' : 'success');
    syncCampaign(c).catch(() => toast('Grupos importados, mas o link inteligente não foi atualizado. Abra a campanha de novo para tentar outra vez.', 'error'));
  } catch (e) { toast(e.message, 'error'); setBusy(btn, false); }
};
A['groups-submit'] = async (btn) => {
  const c = getCampaign(btn.dataset.id); if (!c) return;
  const base = $('#g-base').value.trim(); const qty = Number($('#g-qty').value) || 0; const minQty = c.groups.length ? 1 : 2;
  if (!base) return toast('Informe o nome base', 'error');
  if (qty < minQty || qty > 50) return toast(c.groups.length ? 'Informe entre 1 e 50 grupos' : 'Crie ao menos 2 grupos para ter um reserva', 'error');
  const accountId = $('#g-account').value; const acc = getAccount(accountId);
  const adminsOnly = $('#g-admins').checked; const description = $('#g-desc').value.trim();
  const partText = $('#g-participants').value.trim(); const parts = parseNumbers(partText);
  if (state.settings.mode === 'n8n' && !parts.valid.length) return toast('Informe pelo menos um número seu com DDD para entrar nos grupos', 'error');
  if (parts.invalid.length) return toast(`${parts.invalid.length} número(s) inválido(s) em "Seu número". Use DDD + número.`, 'error');
  const startAt = c.groups.length ? Math.max(...c.groups.map((g) => g.n)) + 1 : 1;
  const imgFile = $('#g-image').files && $('#g-image').files[0];
  setBusy(btn, true);
  try {
    const payload = { instance: acc.instance, campaignId: c.id, base, startAt, quantity: qty, adminsOnly, description, participants: parts.valid, limit: GROUP_LIMIT };
    if (imgFile && state.settings.mode === 'n8n') payload.image = { name: imgFile.name, type: imgFile.type, base64: await fileToBase64(imgFile) };
    const res = await API.call('groups/create', payload);
    (res.groups || []).forEach((g) => c.groups.push({ id: g.id, n: g.n, name: g.name, members: 0, adminsOnly, description, inviteLink: g.inviteLink, accountId }));
    c.groupCfg = { base, adminsOnly, description, participants: partText }; if (!c.accountId) c.accountId = accountId;
    saveState(); closeModal(); toast(`${(res.groups || []).length} grupos criados`, 'success'); route();
    syncCampaign(c).catch(() => toast('Grupos criados, mas o link inteligente não foi atualizado. Abra a campanha de novo para tentar outra vez.', 'error'));
  } catch (e) { toast(e.message, 'error'); setBusy(btn, false); }
};
A['group-move'] = (btn) => {
  const c = getCampaign(btn.dataset.id); if (!c) return;
  const dir = Number(btn.dataset.dir) || 0;
  const list = [...c.groups].sort((a, b) => a.n - b.n);
  const from = list.findIndex((g) => g.id === btn.dataset.gid); const to = from + dir;
  if (from < 0 || to < 0 || to >= list.length) return;
  const ns = list.map((g) => g.n);
  const [moved] = list.splice(from, 1); list.splice(to, 0, moved);
  list.forEach((g, i) => { g.n = ns[i]; });
  saveState(); route();
  toast('Ordem alterada. ' + moved.name + ' agora é o ' + (to + 1) + 'º da fila. Para os nomes acompanharem a nova ordem, use a ação "Trocar nome".', 'success');
  if (state.settings.mode === 'n8n') syncCampaign(c).catch(() => toast('Não consegui avisar o n8n da nova ordem. Abra a campanha de novo para tentar outra vez.', 'error'));
};
A['groups-sync'] = async (btn) => {
  const c = getCampaign(btn.dataset.id); if (!c || !c.groups.length) return;
  const acc = getAccount(c.groups[0].accountId) || getAccount(c.accountId);
  if (!acc) return toast('Não achei a conta que criou esses grupos', 'error');
  setBusy(btn, true);
  try {
    const r = await API.call('groups/sync', { instance: acc.instance, groupIds: c.groups.map((g) => g.id) });
    (r.groups || []).forEach((u) => { const g = c.groups.find((x) => x.id === u.id); if (g && typeof u.members === 'number') g.members = u.members; });
    saveState();
    try { await syncCampaign(c, { force: true }); } catch (e) { /* o link inteligente recontará sozinho em 1 minuto */ }
    toast('Participantes atualizados', 'success'); route();
  } catch (e) { toast(e.message, 'error'); setBusy(btn, false); }
};
A['sim-joins'] = (el) => {
  const c = getCampaign(el.dataset.id); if (!c) return;
  const added = fillGroups(c, 150);
  saveState(); toast(added ? `${added} pessoas entraram` : 'Todos os grupos estão lotados', added ? 'success' : 'error'); route();
};

/* ações */
A['new-action'] = () => { wiz = newWiz(); location.hash = '#/acoes/nova'; };
A['action-filter'] = (el) => { actionsFilter = el.dataset.f; viewAcoes(); };
A['action-open'] = (el) => openActionModal(el.dataset.id);
A['action-results'] = async (btn) => {
  const a = getAction(btn.dataset.id); if (!a) return;
  setBusy(btn, true);
  try {
    const r = await API.call('messages/info', { id: a.id });
    resultsCache[a.id] = { sent: r.sent || [], data: r.data || {}, stats: r.stats || null, at: Date.now() };
    refreshActionModal();
  } catch (e) { toast(e.message, 'error'); setBusy(btn, false); }
};
A['action-results-csv'] = (btn) => {
  const a = getAction(btn.dataset.id); const R = a && resultsRows(a); if (!R) return;
  const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = [['tipo', 'mensagem', 'grupo', 'pessoa', 'telefone', 'resposta']];
  R.items.forEach((r) => {
    const msg = (KINDS[r.it.kind] || { label: r.it.kind }).label + ' ' + (r.idx + 1);
    const tel = (jid) => (/@s\.whatsapp\.net$/.test(jid || '') ? String(jid).replace(/\D/g, '') : '');
    r.reactions.forEach((x) => rows.push(['reação', msg, x.group, x.name || '', tel(x.jid), x.emoji]));
    r.votes.forEach((x) => rows.push(['voto', msg, x.group, '', tel(x.jid), x.option]));
  });
  const csv = '\ufeff' + rows.map((r) => r.map(q).join(';')).join('\n');
  const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = 'resultados-' + a.id + '.csv'; link.click();
};
/* duplicar: abre o assistente já preenchido com os dados da ação, sem enviar nada */
A['action-edit'] = (el) => {
  const a = getAction(el.dataset.id); if (!a) return;
  if (a.status !== 'agendada') return toast('Só dá para editar ações que ainda estão agendadas.', 'error');
  if (!A['action-duplicate'](el, { quiet: true })) return;
  wiz.editId = a.id;
  wiz.schedule = { mode: 'later', at: a.scheduledAt ? toLocalInput(new Date(a.scheduledAt)) : '' };
  /* arquivos que já estão no servidor de arquivos continuam valendo sem precisar anexar de novo */
  wiz.keptMedia = a.media || {};
  let needFiles = false;
  (wiz.content.items || []).forEach((it, i) => {
    const old = (a.content.items || [])[i];
    if (old && wiz.keptMedia[old.id]) { wiz.keptMedia[it.id] = wiz.keptMedia[old.id]; it.kept = true; it.fileName = old.fileName; it.fileSize = old.fileSize; it.fileType = old.fileType; }
    else if (['image', 'video', 'audio', 'file'].includes(it.kind)) needFiles = true;
  });
  if (a.type === 'image') needFiles = true;
  wiz.step = !wiz.accountId ? 3 : 5;
  toast('Editando a ação agendada.' + (needFiles ? ' Anexe os arquivos de novo.' : '') + (!wiz.accountId ? ' Escolha a conta que vai executar.' : ''), 'success');
  renderWizard();
};
A['action-duplicate'] = (el, opt) => {
  const a = getAction(el.dataset.id); if (!a) return;
  const campaignIds = (a.campaignIds || []).filter((id) => getCampaign(id));
  if (!campaignIds.length) { toast('As campanhas desta ação não existem mais. Crie a ação do zero.', 'error'); return false; }
  const w = newWiz();
  w.type = a.type; w.campaignIds = campaignIds;
  campaignIds.forEach((id) => {
    const t = a.targets && a.targets[id];
    const c = getCampaign(id);
    w.targets[id] = Array.isArray(t) ? t.filter((gid) => c.groups.some((g) => g.id === gid)) : '*';
    if (Array.isArray(w.targets[id]) && !w.targets[id].length) w.targets[id] = '*';
  });
  const acc = getAccount(a.accountId);
  w.accountId = acc && acc.status === 'connected' ? acc.id : '';
  const base = JSON.parse(JSON.stringify(a.content || {}));
  delete base.numbersList;
  if (!base.numbers && a.content && Array.isArray(a.content.numbersList)) base.numbers = a.content.numbersList.join('\n');
  w.content = Object.assign(w.content, base);
  let needFiles = false;
  (w.content.items || []).forEach((it) => {
    it.id = uid('it');
    if (['image', 'video', 'audio', 'file'].includes(it.kind)) { it.fileName = ''; it.fileSize = 0; it.fileType = ''; needFiles = true; }
  });
  if (a.type === 'image') { w.content.imageName = ''; w.content.imageSize = 0; needFiles = true; }
  w.schedule = { mode: 'now', at: '' };
  w.step = !w.accountId ? 3 : needFiles ? 5 : 6;
  wiz = w;
  closeModal();
  location.hash = '#/acoes/nova';
  if (!(opt && opt.quiet)) toast('Ação copiada. Revise e confirme para enviar.' + (needFiles ? ' Anexe os arquivos de novo.' : '') + (!w.accountId ? ' Escolha a conta que vai executar.' : ''), 'success');
  if (location.hash === '#/acoes/nova') renderWizard();
  return true;
};
A['action-cancel'] = async (el) => {
  const a = getAction(el.dataset.id); if (!a) return;
  if (!['agendada', 'em andamento'].includes(a.status)) return toast('Essa ação já foi finalizada');
  try { await API.call('actions/cancel', { id: a.id }); } catch (e) { return toast(e.message, 'error'); }
  a.status = 'cancelada'; if (sims.has(a.id)) { clearInterval(sims.get(a.id)); sims.delete(a.id); }
  saveState(); toast('Ação cancelada'); refreshActionModal(); refreshIfRoute('acoes');
};
A['action-delete'] = async (el) => {
  const a = getAction(el.dataset.id); if (!a) return;
  closeModal();
  if (!(await confirmDialog('Excluir esta ação do histórico?', { okLabel: 'Excluir', danger: true }))) return;
  if (sims.has(a.id)) { clearInterval(sims.get(a.id)); sims.delete(a.id); }
  state.actions = state.actions.filter((x) => x.id !== a.id); saveState(); toast('Ação excluída'); refreshIfRoute('acoes');
};

/* wizard */
A['wiz-goto'] = (el) => { wiz.step = Number(el.dataset.step); renderWizard(); scrollTop(); };
A['wiz-back'] = () => { if (wiz.step > 1) { wiz.step--; renderWizard(); scrollTop(); } };
A['wiz-next'] = () => {
  const err = validateStep(wiz.step); if (err) return toast(err, 'error');
  wiz.step++; renderWizard(); scrollTop();
};
A['wiz-cancel'] = async () => {
  if (!(await confirmDialog('Descartar esta ação? Nada será enviado.', { okLabel: 'Descartar', danger: true }))) return;
  wiz = null; location.hash = '#/acoes';
};
A['wiz-campaign'] = (el) => { const id = el.dataset.id; const i = wiz.campaignIds.indexOf(id); if (i >= 0) wiz.campaignIds.splice(i, 1); else wiz.campaignIds.push(id); renderWizard(); };
A['wiz-type'] = (el) => { wiz.type = el.dataset.type; renderWizard(); };
A['wiz-account'] = (el) => { wiz.accountId = el.dataset.id; renderWizard(); };
A['wiz-target-all'] = (el) => { wiz.targets[el.dataset.c] = '*'; renderWizard(); };
A['wiz-target-some'] = (el) => { if (wiz.targets[el.dataset.c] === '*') wiz.targets[el.dataset.c] = []; renderWizard(); };
A['wiz-target-group'] = (el) => {
  const t = wiz.targets[el.dataset.c]; if (t === '*') return;
  const i = t.indexOf(el.dataset.g); if (i >= 0) t.splice(i, 1); else t.push(el.dataset.g); renderWizard();
};
A['wiz-add-item'] = (el) => {
  const kind = el.dataset.kind; const base = { id: uid('it'), kind };
  const defaults = { text: { text: '' }, image: { caption: '', fileName: '' }, video: { caption: '', fileName: '' }, audio: { fileName: '' }, file: { fileName: '' }, button: { text: '', label: '', url: '' }, poll: { question: '', options: ['', ''], multiple: false } };
  wiz.content.items.push(Object.assign(base, defaults[kind])); renderWizard();
};
A['wiz-item-up'] = (el) => { const i = Number(el.dataset.i); const a = wiz.content.items; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; renderWizard(); } };
A['wiz-item-down'] = (el) => { const i = Number(el.dataset.i); const a = wiz.content.items; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; renderWizard(); } };
A['wiz-item-del'] = (el) => { const i = Number(el.dataset.i); const [it] = wiz.content.items.splice(i, 1); if (it) dropFile(it.id); renderWizard(); };
A['wiz-poll-add'] = (el) => { wiz.content.items[Number(el.dataset.i)].options.push(''); renderWizard(); };
A['wiz-poll-del'] = (el) => { const it = wiz.content.items[Number(el.dataset.i)]; if (it.options.length > 2) { it.options.splice(Number(el.dataset.j), 1); renderWizard(); } else toast('A enquete precisa de pelo menos 2 opções', 'error'); };
A['wiz-speed'] = (el) => {
  const sp = wiz.content.speed; const mode = el.dataset.mode; sp.mode = mode;
  if (mode !== 'custom') { sp.min = SPEEDS[mode].min; sp.max = SPEEDS[mode].max; }
  renderWizard();
};
A['wiz-sched'] = (el) => { wiz.schedule.mode = el.dataset.mode; renderWizard(); };
A['wiz-submit'] = async (btn) => {
  if (wiz.schedule.mode === 'later') {
    const t = new Date(wiz.schedule.at).getTime();
    if (!wiz.schedule.at || isNaN(t) || t < Date.now() + 30000) return toast('Escolha uma data e hora no futuro', 'error');
  }
  const err = validateContent(); if (err) { wiz.step = 5; renderWizard(); return toast(err, 'error'); }
  setBusy(btn, true);
  const label = btn.textContent;
  try {
    const action = buildAction(); const payload = { action };
    const old = wiz.editId ? getAction(wiz.editId) : null;
    if (wiz.editId && !wiz.oldCancelled && (!old || old.status !== 'agendada')) throw new Error('Esta ação já começou ou foi cancelada e não pode mais ser editada. Use Duplicar.');
    if (state.settings.mode === 'n8n') payload.files = await collectFiles(action, (n, p) => { btn.textContent = 'Enviando ' + (n.length > 22 ? n.slice(0, 20) + '...' : n) + ' ' + p + '%'; });
    btn.textContent = label;
    if (payload.files) { const m = {}; Object.keys(payload.files).forEach((k) => { if (payload.files[k].mediaId) m[k] = payload.files[k]; }); if (Object.keys(m).length) action.media = m; }
    if (old && !wiz.oldCancelled) {
      /* cancela a antiga (mantendo os arquivos no servidor) antes de criar a nova, para nunca enviar duas vezes */
      await API.call('actions/cancel', { id: old.id, keepMedia: true });
      old.status = 'cancelada'; if (sims.has(old.id)) { clearInterval(sims.get(old.id)); sims.delete(old.id); }
      wiz.oldCancelled = true; saveState();
    }
    const res = await API.call('actions/run', payload);
    if (res.id) action.id = res.id; if (res.status) action.status = res.status;
    if (old) { const i = state.actions.findIndex((x) => x.id === old.id); if (i >= 0) state.actions.splice(i, 1, action); else state.actions.unshift(action); }
    else state.actions.unshift(action);
    saveState();
    if (state.settings.mode === 'demo' && action.status === 'em andamento') startSim(action.id);
    const later = action.status === 'agendada';
    wiz = null; toast(old ? (later ? 'Alterações salvas' : 'Ação iniciada') : later ? 'Ação agendada' : 'Ação iniciada', 'success'); location.hash = '#/acoes';
  } catch (e) { toast(e.message, 'error'); setBusy(btn, false); btn.textContent = label; }
};

/* configurações */
A['cfg-save'] = () => {
  state.settings.mode = $('#cfg-mode').value; state.settings.baseUrl = $('#cfg-url').value.trim(); state.settings.token = $('#cfg-token').value.trim();
  state.settings.mediaUrl = ($('#cfg-media') ? $('#cfg-media').value : state.settings.mediaUrl || '').trim().replace(/\/+$/, '');
  if (state.settings.mode !== 'n8n') { state.settings.client = null; remote.ready = false; }
  saveState(); updateModeBadge(); toast('Configurações salvas', 'success');
};
A['cfg-test'] = async (btn) => {
  A['cfg-save'](); setBusy(btn, true);
  try {
    if (state.settings.mode === 'n8n') { await connectRemote({ quiet: true }); toast('Conexão funcionando' + (state.settings.client ? '. Conectado como ' + state.settings.client.name : ''), 'success'); route(); }
    else { await API.call('ping', {}); toast('Conexão funcionando', 'success'); }
  } catch (e) { toast(e.message, 'error'); } finally { setBusy(btn, false); }
};
A['cfg-pull'] = async (btn) => {
  setBusy(btn, true);
  try { await connectRemote(); toast('Dados atualizados do servidor', 'success'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(btn, false); }
};
A['cfg-seed'] = () => { seedDemo(); toast('Dados de exemplo carregados', 'success'); };
A['cfg-export'] = () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'viphub-backup.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
A['cfg-reset'] = async () => {
  if (!(await confirmDialog('Apagar contas, campanhas e ações salvas neste navegador?', { okLabel: 'Apagar tudo', danger: true }))) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ok */ }
  state = defaultState(); wiz = null; updateModeBadge(); toast('Dados apagados'); route();
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  if (el.dataset.act === 'modal-backdrop' && e.target !== el) return;
  const fn = A[el.dataset.act]; if (fn) fn(el, e);
});
function onModel(e) {
  const t = e.target; const path = t.dataset && t.dataset.model; if (!path || !wiz) return;
  let val = t.type === 'checkbox' ? t.checked : (t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value);
  setPath(wiz, path, val);
  if (t.dataset.rerender) renderWizard(); else refreshPreview();
}
document.addEventListener('input', onModel);
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset && t.dataset.file) { handleFile(t); return; }
  if (t.id === 'cfg-import-file') {
    const f = t.files && t.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const s = JSON.parse(String(r.result)); const d = defaultState(); state = Object.assign(d, s, { settings: Object.assign(d.settings, s.settings || {}) }); saveState(); updateModeBadge(); toast('Dados importados', 'success'); route(); }
      catch (err) { toast('Arquivo de backup inválido', 'error'); }
    };
    r.readAsText(f); return;
  }
  onModel(e);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
window.addEventListener('hashchange', route);

/* =====================================================================
   Início
   ===================================================================== */
function init() {
  $$('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon); });
  document.documentElement.dataset.theme = state.settings.theme || 'light';
  updateModeBadge();
  route();
  state.actions.forEach((a) => { if (a.status === 'em andamento' && state.settings.mode === 'demo') startSim(a.id); });
  if (state.settings.mode === 'n8n') connectRemote().catch((e) => toast('Não consegui conectar ao n8n: ' + e.message, 'error'));
  checkScheduled();
  setInterval(checkScheduled, 15000);
  setInterval(pollRemote, 5000);
}
init();
