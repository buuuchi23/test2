// 画面部品の小さな道具。ユーザーの入力文字は必ず textContent で入れる（HTML として解釈しない）

// h('button', { class: 'btn', onclick }, '押す')
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === undefined || c === null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

let toastTimer = null;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// 下からせり上がるシート。close() を返す
export function openSheet(title, body, { onClose } = {}) {
  const backdrop = h('div', { class: 'sheet-backdrop' });
  const closeBtn = h('button', { type: 'button', class: 'sheet-close', 'aria-label': '閉じる' }, '×');
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' }, h('h2', {}, title), closeBtn),
    h('div', { class: 'sheet-body' }, body),
  );
  backdrop.append(sheet);
  document.body.append(backdrop);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => backdrop.classList.add('open'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => backdrop.remove(), 200);
    onClose && onClose();
  };
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  return close;
}

// やさしい確認ダイアログ。Promise<boolean>
export function confirmDialog(message, { ok = 'OK', cancel = 'やめておく', danger = false } = {}) {
  return new Promise((resolve) => {
    let result = false;
    const okBtn = h('button', { type: 'button', class: danger ? 'btn btn-danger' : 'btn' }, ok);
    const cancelBtn = h('button', { type: 'button', class: 'btn btn-ghost' }, cancel);
    const body = h('div', { class: 'confirm' },
      h('p', { class: 'confirm-msg' }, message),
      h('div', { class: 'btn-row' }, cancelBtn, okBtn),
    );
    const close = openSheet('確認', body, { onClose: () => resolve(result) });
    okBtn.addEventListener('click', () => { result = true; close(); });
    cancelBtn.addEventListener('click', close);
  });
}

// 中身が空のときの案内
export function emptyState(emoji, text, ...actions) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-emoji', 'aria-hidden': 'true' }, emoji),
    h('p', {}, text),
    actions.length ? h('div', { class: 'btn-col' }, actions) : null,
  );
}
