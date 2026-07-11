import { copyTextToClipboard } from '@/lib/clipboard';
import { getExternalFaviconUrl, isExternalHttpUrl, isLoopbackHttpUrl } from '@/lib/url';
import { dropdownMenuItemClass, dropdownMenuPopupClass } from '@/components/ui/dropdown-menu.styles';

// ---------------------------------------------------------------------------
// Shared decoration context
// ---------------------------------------------------------------------------

export type MermaidRender = { svg?: string; ascii?: string };

export type DecorateLabels = {
  copy: string;
  copied: string;
  copyTable: string;
  downloadTable: string;
  copyDiagram: string;
  downloadDiagram: string;
  previewLabel: string;
  previewTitle: string;
};

export type DecorateContext = {
  labels: DecorateLabels;
  // Renders a mermaid block source to svg/ascii using current theme colors.
  renderMermaid: (source: string) => MermaidRender;
  onPreviewLoopback?: (url: string) => void;
};

// Reference the app's icon sprite (injected into <body> by the shared Icon
// component) so DOM-built controls use the same themed icons as the rest of
// the app. Sprite symbols are registered under `#oc-<name>`.
const spriteIcon = (name: string): string =>
  `<svg class="remixicon size-3.5" viewBox="0 0 24 24" aria-hidden="true"><use href="#oc-${name}"></use></svg>`;

const ICONS = {
  copy: spriteIcon('file-copy'),
  check: spriteIcon('check'),
  download: spriteIcon('download'),
} as const;

const ICON_BTN_CLASS =
  'p-1 rounded hover:bg-interactive-hover/60 text-muted-foreground hover:text-foreground transition-colors';

const setHtml = (el: Element, html: string): void => {
  el.innerHTML = html;
};

const makeIconButton = (icon: keyof typeof ICONS, title: string, slot: string): HTMLButtonElement => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = ICON_BTN_CLASS;
  button.setAttribute('data-md-action', slot);
  button.setAttribute('title', title);
  button.setAttribute('aria-label', title);
  setHtml(button, ICONS[icon]);
  return button;
};

const flashCopied = (button: HTMLButtonElement, copiedTitle: string, restore: keyof typeof ICONS, restoreTitle: string): void => {
  setHtml(button, ICONS.check);
  button.setAttribute('title', copiedTitle);
  window.setTimeout(() => {
    setHtml(button, ICONS[restore]);
    button.setAttribute('title', restoreTitle);
  }, 2000);
};

// ---------------------------------------------------------------------------
// Code blocks: inline-code marker + copy button wrapper
// ---------------------------------------------------------------------------

const decorateInlineCode = (root: HTMLElement): void => {
  const inline = root.querySelectorAll<HTMLElement>(':not(pre) > code');
  for (const code of Array.from(inline)) {
    if (code.getAttribute('data-markdown') !== 'inline-code') {
      code.setAttribute('data-markdown', 'inline-code');
    }
  }
};

const decorateCodeBlocks = (root: HTMLElement, labels: DecorateLabels): void => {
  const blocks = root.querySelectorAll<HTMLPreElement>('pre');
  for (const pre of Array.from(blocks)) {
    // Skip rich visual placeholders (handled separately).
    if (pre.querySelector('code.language-mermaid, code.language-canvas')) continue;
    const parent = pre.parentElement;
    if (!parent) continue;
    // Already wrapped (idempotent across morphdom passes).
    if (parent.closest('[data-component="markdown-code"]')) continue;

    // `data-md-lang` is stamped by the async highlight pass; on the synchronous
    // first paint it isn't set yet, so fall back to the `language-*` class marked
    // emits — keeps the card header label stable instead of flashing 'text'.
    const classLang = pre.querySelector('code')?.className.match(/language-([\w+#.-]+)/)?.[1];
    const language = pre.getAttribute('data-md-lang') ?? classLang ?? 'text';

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-component', 'markdown-code');
    wrapper.className =
      'my-4 group overflow-hidden rounded-2xl border border-border/80 bg-[var(--surface-elevated)]';

    const header = document.createElement('div');
    header.className = 'flex items-center justify-between border-b border-border/70 px-3 py-1.5';
    const langLabel = document.createElement('span');
    langLabel.className = 'font-mono text-[13px] text-muted-foreground';
    langLabel.textContent = language;
    const copyBtn = makeIconButton('copy', labels.copy, 'copy-code');
    header.appendChild(langLabel);
    header.appendChild(copyBtn);

    const body = document.createElement('div');
    body.className = 'px-3 py-2.5 overflow-x-auto';

    parent.replaceChild(wrapper, pre);
    pre.style.margin = '0';
    pre.style.background = 'transparent';
    body.appendChild(pre);
    wrapper.appendChild(header);
    wrapper.appendChild(body);
  }
};

// ---------------------------------------------------------------------------
// Tables: wrapper + copy/download toolbars
// ---------------------------------------------------------------------------

const extractTableData = (table: HTMLTableElement): { headers: string[]; rows: string[][] } => {
  const headers: string[] = [];
  const rows: string[][] = [];
  const headerCells = table.querySelectorAll('thead th');
  for (const cell of Array.from(headerCells)) headers.push((cell.textContent ?? '').trim());
  const bodyRows = table.querySelectorAll('tbody tr');
  for (const row of Array.from(bodyRows)) {
    const cells = Array.from(row.querySelectorAll('td')).map((c) => (c.textContent ?? '').trim());
    if (cells.length > 0) rows.push(cells);
  }
  return { headers, rows };
};

const escapeCsv = (value: string): string =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const tableToCSV = ({ headers, rows }: { headers: string[]; rows: string[][] }): string =>
  [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');

const tableToTSV = ({ headers, rows }: { headers: string[]; rows: string[][] }): string =>
  [headers, ...rows].map((row) => row.join('\t')).join('\n');

const tableToMarkdown = ({ headers, rows }: { headers: string[]; rows: string[][] }): string => {
  const head = `| ${headers.join(' | ')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.join(' | ')} |`).join('\n');
  return `${head}\n${sep}\n${body}`;
};

const buildTableMenu = (action: string, items: Array<{ key: string; label: string }>): HTMLDivElement => {
  const menu = document.createElement('div');
  // Match the app's DropdownMenu look (same class tokens + surface colors).
  menu.className = `absolute top-full right-0 mt-1 hidden ${dropdownMenuPopupClass}`;
  menu.style.backgroundColor = 'var(--surface-elevated)';
  menu.style.color = 'var(--surface-elevated-foreground)';
  menu.setAttribute('data-md-menu', action);
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `w-full text-left ${dropdownMenuItemClass}`;
    button.setAttribute('data-md-action', `${action}-${item.key}`);
    button.textContent = item.label;
    menu.appendChild(button);
  }
  return menu;
};

const decorateTables = (root: HTMLElement, labels: DecorateLabels): void => {
  const tables = root.querySelectorAll<HTMLTableElement>('table');
  for (const table of Array.from(tables)) {
    const existing = table.closest('[data-markdown="table-wrapper"]');
    if (existing) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'group my-4 flex flex-col space-y-2';
    wrapper.setAttribute('data-markdown', 'table-wrapper');

    const toolbar = document.createElement('div');
    toolbar.className = 'flex items-center justify-end gap-1';

    const copyGroup = document.createElement('div');
    copyGroup.className = 'relative';
    copyGroup.appendChild(makeIconButton('copy', labels.copyTable, 'table-copy-toggle'));
    copyGroup.appendChild(buildTableMenu('table-copy', [
      { key: 'csv', label: 'CSV' },
      { key: 'tsv', label: 'TSV' },
      { key: 'markdown', label: 'Markdown' },
    ]));

    const downloadGroup = document.createElement('div');
    downloadGroup.className = 'relative';
    downloadGroup.appendChild(makeIconButton('download', labels.downloadTable, 'table-download-toggle'));
    downloadGroup.appendChild(buildTableMenu('table-download', [
      { key: 'csv', label: 'CSV' },
      { key: 'markdown', label: 'Markdown' },
    ]));

    toolbar.appendChild(copyGroup);
    toolbar.appendChild(downloadGroup);

    const scroll = document.createElement('div');
    scroll.className = 'overflow-x-auto rounded-lg border border-border/80 bg-[var(--surface-elevated)]';

    const parent = table.parentElement;
    if (!parent) continue;
    parent.replaceChild(wrapper, table);
    table.setAttribute('data-markdown', 'table');
    table.classList.add('w-full', 'border-collapse', 'text-sm');

    for (const tr of Array.from(table.querySelectorAll('tr'))) {
      tr.classList.add('border-b', 'border-border/60');
    }
    const lastBodyRow = table.querySelector('tbody tr:last-child');
    lastBodyRow?.classList.remove('border-b');
    lastBodyRow?.classList.add('border-0');
    for (const th of Array.from(table.querySelectorAll('th'))) {
      th.classList.add('border-r', 'border-border/60', 'px-4', 'py-2.5', 'text-left', 'align-middle', 'font-semibold', 'text-foreground', 'last:border-r-0');
    }
    for (const td of Array.from(table.querySelectorAll('td'))) {
      td.classList.add('border-r', 'border-border/60', 'px-4', 'py-2.5', 'align-middle', 'text-foreground/90', 'last:border-r-0');
    }

    scroll.appendChild(table);
    wrapper.appendChild(toolbar);
    wrapper.appendChild(scroll);
  }
};

// ---------------------------------------------------------------------------
// Canvas: replace ```canvas freeform fences with a lightweight whiteboard block
// ---------------------------------------------------------------------------

const appendCanvasLine = (lineEl: HTMLElement, line: string): void => {
  const tokenRe = /(\[[^\]\n]{1,120}\]|\{[^}\n]{1,120}\}|\([^()\n]{1,80}\)|[-=]+>|←|→|↔|=>)/g;
  let cursor = 0;
  let match: RegExpExecArray | null = tokenRe.exec(line);
  while (match) {
    if (match.index > cursor) {
      lineEl.appendChild(document.createTextNode(line.slice(cursor, match.index)));
    }
    const token = match[0] ?? '';
    const span = document.createElement('span');
    if (token.startsWith('[') && token.endsWith(']')) {
      span.className = 'inline-flex rounded-xl border border-primary/35 bg-primary/10 px-2 py-0.5 font-medium text-foreground shadow-sm';
      span.textContent = token.slice(1, -1).trim();
    } else if (token.startsWith('{') && token.endsWith('}')) {
      span.className = 'inline-flex -rotate-1 rounded-lg border border-amber-400/45 bg-amber-300/20 px-2 py-0.5 text-amber-950 shadow-sm dark:text-amber-100';
      span.textContent = token.slice(1, -1).trim();
    } else if (token.startsWith('(') && token.endsWith(')')) {
      span.className = 'inline-flex rounded-full border border-border/80 bg-[var(--surface-muted)] px-2 py-0.5 text-muted-foreground';
      span.textContent = token.slice(1, -1).trim();
    } else {
      span.className = 'mx-1 inline-flex font-semibold text-primary';
      span.textContent = token;
    }
    lineEl.appendChild(span);
    cursor = match.index + token.length;
    match = tokenRe.exec(line);
  }
  if (cursor < line.length) {
    lineEl.appendChild(document.createTextNode(line.slice(cursor)));
  }
};

const decorateCanvas = (root: HTMLElement, labels: DecorateLabels): void => {
  const codes = root.querySelectorAll<HTMLElement>('pre > code.language-canvas');
  for (const code of Array.from(codes)) {
    const pre = code.parentElement as HTMLPreElement | null;
    if (!pre) continue;
    const source = (code.textContent ?? '').replace(/\s+$/, '');

    const block = document.createElement('div');
    block.setAttribute('data-markdown', 'canvas-block');
    block.className = 'group relative my-4 overflow-hidden rounded-3xl border border-border/80 bg-[var(--surface-elevated)] shadow-sm';

    const toolbar = document.createElement('div');
    toolbar.className = 'absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-border/70 bg-[var(--surface-elevated)]/90 px-1 py-0.5 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100';
    const copy = makeIconButton('copy', labels.copy, 'canvas-copy');
    const download = makeIconButton('download', 'Download canvas', 'canvas-download');
    toolbar.appendChild(copy);
    toolbar.appendChild(download);

    const board = document.createElement('div');
    board.setAttribute('data-markdown', 'canvas-board');
    board.setAttribute('data-md-source', source);
    board.className = 'overflow-x-auto p-5 font-mono text-[13px] leading-7 text-foreground/90';
    board.style.backgroundImage = 'radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--border) 55%, transparent) 1px, transparent 0)';
    board.style.backgroundSize = '18px 18px';

    const content = document.createElement('div');
    content.className = 'inline-block min-w-full whitespace-pre';
    const lines = source.split(/\r?\n/);
    for (const line of lines.length > 0 ? lines : ['']) {
      const lineEl = document.createElement('div');
      lineEl.className = 'min-h-7';
      appendCanvasLine(lineEl, line);
      content.appendChild(lineEl);
    }
    board.appendChild(content);
    block.appendChild(board);
    block.appendChild(toolbar);

    const host = pre.parentElement;
    if (!host) continue;
    host.replaceChild(block, pre);
  }
};

// ---------------------------------------------------------------------------
// Mermaid: replace ```mermaid code fences with rendered diagram blocks
// ---------------------------------------------------------------------------

const decorateMermaid = (root: HTMLElement, ctx: DecorateContext): void => {
  const codes = root.querySelectorAll<HTMLElement>('pre > code.language-mermaid');
  for (const code of Array.from(codes)) {
    const pre = code.parentElement as HTMLPreElement | null;
    if (!pre) continue;
    const source = (code.textContent ?? '').replace(/\s+$/, '');
    const rendered = ctx.renderMermaid(source);

    const block = document.createElement('div');
    block.setAttribute('data-markdown', 'mermaid-block');
    block.className = 'group relative';

    const scroll = document.createElement('div');
    scroll.setAttribute('data-markdown', 'mermaid-scroll');

    const toolbar = document.createElement('div');
    toolbar.className = 'absolute top-1 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity';

    if (rendered.svg) {
      const svgHost = document.createElement('div');
      svgHost.setAttribute('data-markdown', 'mermaid');
      setHtml(svgHost, rendered.svg);
      scroll.appendChild(svgHost);
      const copy = makeIconButton('copy', ctx.labels.copyDiagram, 'mermaid-copy');
      copy.setAttribute('data-md-source', source);
      const download = makeIconButton('download', ctx.labels.downloadDiagram, 'mermaid-download');
      download.setAttribute('data-md-svg', '1');
      toolbar.appendChild(copy);
      toolbar.appendChild(download);
    } else {
      const asciiPre = document.createElement('pre');
      asciiPre.setAttribute('data-markdown', 'mermaid-ascii');
      asciiPre.textContent = rendered.ascii || source;
      scroll.appendChild(asciiPre);
      const copy = makeIconButton('copy', ctx.labels.copyDiagram, 'mermaid-copy');
      copy.setAttribute('data-md-source', rendered.ascii || source);
      toolbar.appendChild(copy);
    }

    block.appendChild(scroll);
    block.appendChild(toolbar);

    const host = pre.parentElement;
    if (!host) continue;
    host.replaceChild(block, pre);
  }
};

// ---------------------------------------------------------------------------
// External links: favicon + loopback preview button
// ---------------------------------------------------------------------------

const decorateLinks = (root: HTMLElement, ctx: DecorateContext): void => {
  const anchors = root.querySelectorAll<HTMLAnchorElement>('a[href]');
  for (const anchor of Array.from(anchors)) {
    if (anchor.getAttribute('data-md-link-decorated') === 'true') continue;
    if (anchor.getAttribute('data-openchamber-file-link') === 'true') continue;
    const href = anchor.getAttribute('href') ?? '';
    if (!isExternalHttpUrl(href)) continue;
    anchor.setAttribute('data-md-link-decorated', 'true');

    const faviconUrl = getExternalFaviconUrl(href);
    if (faviconUrl) {
      const favWrap = document.createElement('span');
      favWrap.className =
        'mr-1 inline-flex size-[18px] items-center justify-center rounded border border-[var(--border)] bg-[var(--interactive-hover)] align-middle';
      const img = document.createElement('img');
      img.src = faviconUrl;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.className = 'size-3.5 rounded-sm';
      img.addEventListener('error', () => favWrap.remove(), { once: true });
      favWrap.appendChild(img);
      anchor.parentNode?.insertBefore(favWrap, anchor);
    }

    if (ctx.onPreviewLoopback && isLoopbackHttpUrl(href)) {
      const preview = document.createElement('button');
      preview.type = 'button';
      preview.className = `ml-1 align-middle ${ICON_BTN_CLASS}`;
      preview.setAttribute('data-md-action', 'preview-loopback');
      preview.setAttribute('data-md-url', href);
      preview.setAttribute('title', ctx.labels.previewTitle);
      preview.setAttribute('aria-label', ctx.labels.previewLabel);
      setHtml(preview, ICONS.download);
      anchor.parentNode?.insertBefore(preview, anchor.nextSibling);
    }
  }
};

/** Run all idempotent DOM decoration passes over freshly-rendered markdown. */
export const decorateMarkdown = (root: HTMLElement, ctx: DecorateContext): void => {
  decorateInlineCode(root);
  decorateCanvas(root, ctx.labels);
  decorateMermaid(root, ctx);
  decorateCodeBlocks(root, ctx.labels);
  decorateTables(root, ctx.labels);
  decorateLinks(root, ctx);
};

// ---------------------------------------------------------------------------
// Delegated interactions (copy/download/menus/preview)
// ---------------------------------------------------------------------------

const downloadBlob = (filename: string, content: string, mime: string): void => {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const closeAllMenus = (container: HTMLElement): void => {
  for (const menu of Array.from(container.querySelectorAll<HTMLElement>('[data-md-menu]'))) {
    menu.classList.add('hidden');
  }
};

/**
 * Attach a single delegated click listener for all in-markdown actions: code
 * copy, table copy/download menus, mermaid copy/download, loopback preview.
 * Returns a cleanup function.
 */
export const attachMarkdownInteractions = (
  container: HTMLElement,
  ctx: DecorateContext,
): (() => void) => {
  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const actionEl = target.closest<HTMLElement>('[data-md-action]');
    if (!actionEl) {
      closeAllMenus(container);
      return;
    }
    const action = actionEl.getAttribute('data-md-action') ?? '';

    // Copy code
    if (action === 'copy-code') {
      const code = actionEl.closest('[data-component="markdown-code"]')?.querySelector('code');
      const text = code?.textContent ?? '';
      if (text) void copyTextToClipboard(text).then(() => flashCopied(actionEl as HTMLButtonElement, ctx.labels.copied, 'copy', ctx.labels.copy));
      return;
    }

    // Toggle table menus
    if (action === 'table-copy-toggle' || action === 'table-download-toggle') {
      event.preventDefault();
      const menu = actionEl.parentElement?.querySelector<HTMLElement>('[data-md-menu]') ?? null;
      const willOpen = menu?.classList.contains('hidden') ?? false;
      closeAllMenus(container);
      if (menu && willOpen) menu.classList.remove('hidden');
      return;
    }

    // Table copy formats
    if (action.startsWith('table-copy-')) {
      const format = action.replace('table-copy-', '');
      const table = actionEl.closest('[data-markdown="table-wrapper"]')?.querySelector('table');
      if (table instanceof HTMLTableElement) {
        const data = extractTableData(table);
        const content = format === 'csv' ? tableToCSV(data) : format === 'tsv' ? tableToTSV(data) : tableToMarkdown(data);
        void copyTextToClipboard(content);
      }
      closeAllMenus(container);
      return;
    }

    // Table download formats
    if (action.startsWith('table-download-')) {
      const format = action.replace('table-download-', '');
      const table = actionEl.closest('[data-markdown="table-wrapper"]')?.querySelector('table');
      if (table instanceof HTMLTableElement) {
        const data = extractTableData(table);
        const content = format === 'csv' ? tableToCSV(data) : tableToMarkdown(data);
        downloadBlob(format === 'csv' ? 'table.csv' : 'table.md', content, format === 'csv' ? 'text/csv' : 'text/markdown');
      }
      closeAllMenus(container);
      return;
    }

    // Canvas copy/download source
    if (action === 'canvas-copy') {
      const source = actionEl.closest('[data-markdown="canvas-block"]')?.querySelector<HTMLElement>('[data-md-source]')?.getAttribute('data-md-source') ?? '';
      if (source) void copyTextToClipboard(source).then(() => flashCopied(actionEl as HTMLButtonElement, ctx.labels.copied, 'copy', ctx.labels.copy));
      return;
    }

    if (action === 'canvas-download') {
      const source = actionEl.closest('[data-markdown="canvas-block"]')?.querySelector<HTMLElement>('[data-md-source]')?.getAttribute('data-md-source') ?? '';
      if (source) downloadBlob('canvas.txt', source, 'text/plain;charset=utf-8');
      return;
    }

    // Mermaid copy source / ascii
    if (action === 'mermaid-copy') {
      const source = actionEl.getAttribute('data-md-source') ?? '';
      if (source) void copyTextToClipboard(source).then(() => flashCopied(actionEl as HTMLButtonElement, ctx.labels.copied, 'copy', ctx.labels.copyDiagram));
      return;
    }

    // Mermaid download svg
    if (action === 'mermaid-download') {
      const svgHost = actionEl.closest('[data-markdown="mermaid-block"]')?.querySelector('[data-markdown="mermaid"]');
      const svg = svgHost?.innerHTML ?? '';
      if (svg) downloadBlob('diagram.svg', svg, 'image/svg+xml;charset=utf-8');
      return;
    }

    // Loopback preview
    if (action === 'preview-loopback') {
      event.preventDefault();
      const url = actionEl.getAttribute('data-md-url') ?? '';
      if (url) ctx.onPreviewLoopback?.(url);
      return;
    }
  };

  container.addEventListener('click', handleClick);
  return () => container.removeEventListener('click', handleClick);
};
