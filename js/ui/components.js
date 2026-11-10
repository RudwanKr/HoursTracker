/**
 * ui/components.js — Helpers to build DOM elements, dialogs, toasts.
 * Never uses innerHTML with user-provided data. All user strings go via textContent.
 */

// ─── Toast system ─────────────────────────────────────────────────────────────

let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.getElementById('toast-container');
  }
  return _toastContainer;
}

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [duration=4000] ms, 0 = persistent
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');

  const msg = document.createElement('span');
  msg.className = 'toast__msg';
  msg.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast__close';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.addEventListener('click', () => toast.remove());

  toast.appendChild(msg);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => toast.remove(), duration);
  }
  return toast;
}

// ─── Modal helper ─────────────────────────────────────────────────────────────

/**
 * Create and show a modal dialog.
 * @param {{ title: string, body: HTMLElement|HTMLElement[], onConfirm?: Function, confirmLabel?: string, confirmClass?: string, onClose?: Function }} opts
 * @returns {{ overlay: HTMLElement, close: Function }}
 */
export function showModal({ title, body, onConfirm, confirmLabel = 'Confirm', confirmClass = 'btn--yellow', onClose }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const modal = document.createElement('div');
  modal.className = 'modal';

  // Header
  const header = document.createElement('div');
  header.className = 'modal__header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'modal__title';
  titleEl.textContent = title;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal__close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.textContent = '✕';

  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Body
  const bodyEl = document.createElement('div');
  bodyEl.className = 'modal__body';
  if (Array.isArray(body)) {
    body.forEach(el => bodyEl.appendChild(el));
  } else {
    bodyEl.appendChild(body);
  }

  // Footer
  const footer = document.createElement('div');
  footer.className = 'modal__footer';

  const cancelBtn = makeButton('Cancel', 'btn');
  footer.appendChild(cancelBtn);

  if (onConfirm) {
    const confirmBtn = makeButton(confirmLabel, `btn ${confirmClass}`);
    confirmBtn.addEventListener('click', () => {
      onConfirm();
    });
    footer.appendChild(confirmBtn);
  }

  modal.appendChild(header);
  modal.appendChild(bodyEl);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
    onClose && onClose();
  };

  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  // Trap focus
  const focusable = modal.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable.length) focusable[0].focus();

  return { overlay, close };
}

// ─── Confirm dialog ───────────────────────────────────────────────────────────

/**
 * Show a simple confirmation dialog.
 * @param {{ title: string, message: string, onConfirm: Function, confirmLabel?: string, confirmClass?: string }} opts
 */
export function confirm({ title, message, onConfirm, confirmLabel = 'Confirm', confirmClass = 'btn--red' }) {
  const p = document.createElement('p');
  p.textContent = message;
  const { close } = showModal({
    title,
    body: p,
    confirmLabel,
    confirmClass,
    onConfirm: () => {
      close();
      onConfirm();
    }
  });
}

// ─── DOM builders ─────────────────────────────────────────────────────────────

/**
 * Create a button element.
 * @param {string} text
 * @param {string} [className='btn']
 */
export function makeButton(text, className = 'btn') {
  const btn = document.createElement('button');
  btn.className = className;
  btn.textContent = text;
  return btn;
}

/**
 * Create a form group: label + input (or any element).
 */
export function makeFormGroup(labelText, inputEl) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.textContent = labelText;
  if (inputEl.id) label.htmlFor = inputEl.id;

  group.appendChild(label);
  group.appendChild(inputEl);
  return group;
}

/**
 * Create a text input.
 */
export function makeInput({ id, type = 'text', value = '', placeholder = '', required = false, min, max, step }) {
  const input = document.createElement('input');
  input.className = 'form-input';
  input.type = type;
  if (id) input.id = id;
  input.value = value;
  if (placeholder) input.placeholder = placeholder;
  if (required) input.required = true;
  if (min !== undefined) input.min = min;
  if (max !== undefined) input.max = max;
  if (step !== undefined) input.step = step;
  return input;
}

/**
 * Create a textarea.
 */
export function makeTextarea({ id, value = '', placeholder = '', rows = 3 }) {
  const ta = document.createElement('textarea');
  ta.className = 'form-textarea';
  if (id) ta.id = id;
  ta.value = value;
  if (placeholder) ta.placeholder = placeholder;
  ta.rows = rows;
  return ta;
}

/**
 * Create a status chip element.
 * @param {'active'|'paused'|'ended'|'running'} status
 */
export function makeChip(status) {
  const chip = document.createElement('span');
  chip.className = `chip chip--${status}`;

  if (status === 'running') {
    const dot = document.createElement('span');
    dot.className = 'chip__dot';
    chip.appendChild(dot);
  }

  const text = document.createTextNode(status.toUpperCase());
  chip.appendChild(text);
  return chip;
}

/**
 * Create a progress bar element.
 * @param {number} pct - 0–100+
 * @param {boolean} complete - use green fill
 */
export function makeProgressBar(pct, complete) {
  const track = document.createElement('div');
  track.className = 'progress';
  const fill = document.createElement('div');
  fill.className = `progress__fill${complete ? ' complete' : ''}`;
  fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  track.appendChild(fill);
  return track;
}

/**
 * Create a simple element with a class and text.
 */
export function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

/**
 * Remove all children from a node.
 */
export function clearEl(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}
