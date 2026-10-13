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

let openSheets = 0;

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
  openSheets++;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => backdrop.classList.add('open'));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('open');
    if (--openSheets === 0) document.body.classList.remove('no-scroll');
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

// ラベル付きの入力欄
export function field(label, control, hint) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    control,
    hint ? h('span', { class: 'field-hint' }, hint) : null,
  );
}

// ボタン型の選択肢。multi=false なら1つだけ（もう一度押すと解除できるのは allowNone のとき）
// 戻り値の .value で選択中の値（multi なら配列）
export function chips(options, { value = null, multi = false, allowNone = true, onChange } = {}) {
  let selected = multi ? new Set(value || []) : value;
  const el = h('div', { class: 'chips', role: multi ? 'group' : 'radiogroup' });
  const buttons = options.map((o) => {
    const b = h('button', { type: 'button', class: 'chip' }, o.label);
    b.addEventListener('click', () => {
      if (multi) {
        selected.has(o.v) ? selected.delete(o.v) : selected.add(o.v);
      } else {
        selected = selected === o.v && allowNone ? null : o.v;
      }
      sync();
      onChange && onChange(api.value);
    });
    return [o.v, b];
  });
  const sync = () => {
    for (const [v, b] of buttons) {
      const on = multi ? selected.has(v) : selected === v;
      b.classList.toggle('on', on);
      b.setAttribute(multi ? 'aria-pressed' : 'aria-checked', on ? 'true' : 'false');
      if (!multi) b.setAttribute('role', 'radio');
    }
  };
  el.append(...buttons.map(([, b]) => b));
  sync();
  const api = {
    el,
    get value() { return multi ? [...selected] : selected; },
  };
  return api;
}

// セレクトボックス
export function select(options, value) {
  const el = h('select', { class: 'input' },
    options.map((o) => h('option', { value: o.v }, o.label)));
  if (value != null) el.value = value;
  return el;
}

// Enter で決定する小さな入力行（例：カテゴリを新しく作る）
export function inlineAdd(placeholder, buttonLabel, onSubmit) {
  const input = h('input', { type: 'text', class: 'input', placeholder, enterkeyhint: 'done' });
  const submit = async () => {
    const v = input.value.trim();
    if (!v) { input.focus(); return; }
    try {
      await onSubmit(v);
      input.value = '';
    } catch (err) {
      toast(err.message);
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); }
  });
  return h('div', { class: 'inline-add' }, input,
    h('button', { type: 'button', class: 'btn btn-small btn-outline', onclick: submit }, buttonLabel));
}

// メモの中の URL をリンクにする（それ以外はただの文字）
export function linkify(text) {
  const out = [];
  const re = /https?:\/\/[^\s<>"'「」（）()]+/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer' }, m[0]));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
