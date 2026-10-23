import { WINDOWS_CODE_PAGES } from './rtf-code-pages';

export type AnnouncementTextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
};

export type AnnouncementBody = {
  format: 'plain' | 'rtf';
  text: string;
  runs: AnnouncementTextRun[];
};

type ReaderState = Omit<AnnouncementTextRun, 'text'> & {
  skip: boolean;
  hidden: boolean;
  fontTable: boolean;
  font: number;
  codePage: number;
  unicodeFallback: number;
  ignorable: boolean;
  alternative: number | null;
};

// These groups describe the document or contain non-text data, not announcement content.
const NON_BODY_DESTINATIONS = new Set([
  'fonttbl', 'colortbl', 'stylesheet', 'info', 'generator', 'background',
  'pict', 'object', 'objdata', 'shp', 'shpinst', 'shppict', 'nonshppict',
  'header', 'headerl', 'headerr', 'headerf', 'footer', 'footerl', 'footerr', 'footerf',
  'filetbl', 'revtbl', 'rsidtbl', 'listtable', 'listoverridetable', 'xmlnstbl',
  'themedata', 'colorschememapping', 'datastore', 'datafield', 'fldinst',
  'annotation', 'atnauthor', 'atnid', 'footnote', 'pn', 'bkmkstart', 'bkmkend',
]);

const CHARSET_CODE_PAGES: Record<number, number> = { 0: 1252, 1: 1252, 2: 42, 204: 1251, 238: 1250 };
const SYMBOLS: Record<string, string> = {
  par: '\n', line: '\n', softline: '\n', page: '\n', sect: '\n',
  tab: '\t', cell: '\t', nestcell: '\t', row: '\n', nestrow: '\n',
  bullet: '•', emdash: '—', endash: '–', emspace: '\u2003', enspace: '\u2002',
  lquote: '‘', rquote: '’', ldblquote: '“', rdblquote: '”',
};
const PLAIN_STYLE = { bold: false, italic: false, underline: false, strike: false };

/** Read PowerBuilder/TX Text Control RTF into native text runs; never execute embedded content. */
export function parseAnnouncementBody(body: string | null | undefined): AnnouncementBody {
  const input = typeof body === 'string' ? body : '';
  const source = input.replace(/^\uFEFF?\s*/, '');
  if (!/^\{\\rtf\d+\b/.test(source)) {
    return { format: 'plain', text: input, runs: input ? [{ text: input, ...PLAIN_STYLE }] : [] };
  }

  const runs: AnnouncementTextRun[] = [];
  const stack: ReaderState[] = [];
  const fontCodePages = new Map<number, number>();
  let defaultFont = 0;
  let fallbackLeft = 0;
  let state: ReaderState = {
    ...PLAIN_STYLE, skip: false, hidden: false, fontTable: false, font: 0,
    codePage: 1252, unicodeFallback: 1, ignorable: false, alternative: null,
  };

  function emit(value: string, unicode = false) {
    if (!unicode && fallbackLeft) { fallbackLeft--; return; }
    if (state.skip || state.hidden) return;
    const last = runs.at(-1);
    if (last && last.bold === state.bold && last.italic === state.italic &&
        last.underline === state.underline && last.strike === state.strike) last.text += value;
    else runs.push({ text: value, bold: state.bold, italic: state.italic, underline: state.underline, strike: state.strike });
  }

  function decodeByte(byte: number) {
    const codePage = fontCodePages.get(state.font) ?? state.codePage;
    // Symbol is commonly used for a PowerBuilder list's bullet marker.
    if (codePage === 42) return byte === 0xb7 ? '•' : '\uFFFD';
    return byte < 128 ? String.fromCharCode(byte) : (WINDOWS_CODE_PAGES[codePage]?.[byte - 128] ?? '\uFFFD');
  }

  for (let index = 0; index < source.length;) {
    const character = source[index++];
    if (character === '{') {
      const alternative = state.alternative;
      if (alternative !== null) state.alternative++;
      stack.push({ ...state });
      state = { ...state, alternative: null, ignorable: false, skip: state.skip || alternative === 0 };
      fallbackLeft = 0;
      continue;
    }
    if (character === '}') {
      const parent = stack.pop();
      if (!parent) break;
      state = parent;
      fallbackLeft = 0;
      if (!stack.length) break; // Do not display text appended after the RTF document.
      continue;
    }
    // Physical source line endings wrap RTF syntax; visible breaks are explicit controls.
    if (character === '\r' || character === '\n' || character === '\0') continue;
    if (character !== '\\') { emit(character); continue; }

    const control = source[index++];
    if (!control) break;
    if (control === '\\' || control === '{' || control === '}') { emit(control); continue; }
    if (control === "'") {
      const hex = source.slice(index, index + 2);
      if (/^[0-9a-f]{2}$/i.test(hex)) { emit(decodeByte(parseInt(hex, 16))); index += 2; }
      continue;
    }
    if (control === '*') { state.ignorable = true; continue; }
    if (control === '~') { emit('\u00A0'); continue; }
    if (control === '_') { emit('\u2011'); continue; }
    if (control === '-') { emit('\u00AD'); continue; }
    if (!/[a-z]/i.test(control)) continue;

    let word = control;
    while (index < source.length && /[a-z]/i.test(source[index])) word += source[index++];
    let digits = '';
    if (source[index] === '-' && /\d/.test(source[index + 1] ?? '')) digits += source[index++];
    while (index < source.length && /\d/.test(source[index])) digits += source[index++];
    const parameter = digits ? Number(digits) : undefined;
    if (source[index] === ' ') index++; // Only one delimiter space belongs to the control.

    if (state.ignorable) {
      // The Unicode branch of \upr is a recognized destination despite its \* marker.
      if (word !== 'ud') state.skip = true;
      state.ignorable = false;
    }
    if (word === 'fonttbl') state.fontTable = true;
    if (NON_BODY_DESTINATIONS.has(word)) state.skip = true;
    if (word === 'bin' && parameter !== undefined && parameter > 0) {
      index += Math.min(parameter, source.length - index);
      continue; // Binary bytes can contain braces and must never be tokenized as RTF.
    }
    if (word === 'f' && parameter !== undefined) state.font = parameter;
    if (state.fontTable) {
      if (word === 'fcharset' && parameter !== undefined && CHARSET_CODE_PAGES[parameter] !== undefined)
        fontCodePages.set(state.font, CHARSET_CODE_PAGES[parameter]);
      if (word === 'cpg' && parameter !== undefined) fontCodePages.set(state.font, parameter);
    }
    if (state.skip) continue;

    if (word === 'ansicpg' && parameter !== undefined) state.codePage = parameter;
    else if (word === 'deff' && parameter !== undefined) { defaultFont = parameter; state.font = parameter; }
    else if (word === 'uc' && parameter !== undefined) state.unicodeFallback = Math.max(0, parameter);
    else if (word === 'u' && parameter !== undefined) {
      if (parameter >= -32768 && parameter <= 65535) emit(String.fromCharCode(parameter & 0xffff), true);
      fallbackLeft = state.unicodeFallback;
    } else if (word === 'upr') state.alternative = 0;
    else if (word === 'plain') { Object.assign(state, PLAIN_STYLE); state.hidden = false; state.font = defaultFont; }
    else if (word === 'b') state.bold = parameter !== 0;
    else if (word === 'i') state.italic = parameter !== 0;
    else if (word === 'ulnone') state.underline = false;
    else if (word === 'ul' || word === 'uldb' || word === 'ulw') state.underline = parameter !== 0;
    else if (word === 'strike' || word === 'striked') state.strike = parameter !== 0;
    else if (word === 'v') state.hidden = parameter !== 0;
    else if (SYMBOLS[word]) emit(SYMBOLS[word]);
  }

  // Editors commonly end with \par; avoid adding blank space around an announcement.
  while (runs.length && !runs[0].text.trim()) runs.shift();
  while (runs.length && !runs.at(-1)!.text.trim()) runs.pop();
  if (runs.length) {
    runs[0].text = runs[0].text.trimStart();
    runs[runs.length - 1].text = runs.at(-1)!.text.trimEnd();
  }
  return { format: 'rtf', text: runs.map((run) => run.text).join(''), runs };
}
