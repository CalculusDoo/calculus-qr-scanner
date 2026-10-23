import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseAnnouncementBody } from '@/lib/announcement-body';

const rtf = (content: string) => `{\\rtf1\\ansi\\ansicpg1250 ${content}}`;

describe('PowerBuilder announcement bodies', () => {
  it('decodes the exact TX_RTF32 sample without its font, stylesheet or shape metadata', () => {
    const sample = readFileSync(join(__dirname, 'fixtures/announcement-powerbuilder.rtf'), 'utf8');
    const result = parseAnnouncementBody(sample);
    expect(result.format).toBe('rtf');
    expect(result.text).toBe('Test obaveštenje');
    expect(result.runs).toEqual([{ text: 'Test obaveštenje', bold: false, italic: false, underline: false, strike: false }]);
  });

  it('keeps existing plain announcements and literal HTML as text', () => {
    const text = '  Obaveštenje\nDrugi red {tekst} i C:\\računi\n<script>alert(1)</script>  ';
    expect(parseAnnouncementBody(text)).toMatchObject({ format: 'plain', text });
    expect(parseAnnouncementBody(null).runs).toEqual([]);
    expect(parseAnnouncementBody(undefined).text).toBe('');
    expect(parseAnnouncementBody('').runs).toEqual([]);
  });

  it('decodes all Serbian Latin letters from Windows-1250 bytes', () => {
    expect(parseAnnouncementBody(rtf(String.raw`\'8a\'9a\'c8\'e8\'c6\'e6\'d0\'f0\'8e\'9e`)).text)
      .toBe('ŠšČčĆćĐđŽž');
  });

  it('uses per-font character sets and restores encoding after a nested group', () => {
    const result = parseAnnouncementBody(String.raw`{\rtf1\ansi\ansicpg1252\deff0{\fonttbl{\f0\fcharset238 Arial;}{\f1\fcharset204 Arial;}}\f0 \'c8\'e8 {\f1 \'cf\'f0\'e8\'e2\'e5\'f2} \'9a}`);
    expect(result.text).toBe('Čč Привет š');
    expect(parseAnnouncementBody(String.raw`{\rtf1\ansi\ansicpg1252 \'80\'93test\'94}`).text).toBe('€“test”');
  });

  it('decodes Unicode, skips its ANSI fallbacks, and restores scoped fallback counts', () => {
    const result = parseAnnouncementBody(rtf(String.raw`\uc1 \u352?\u353\'9a {\uc2 \u268ab}\u269? {\uc0\u272}\u273?`));
    expect(result.text).toBe('Šš Čč Đđ');
    expect(parseAnnouncementBody(rtf(String.raw`\uc1 \u-10179?\u-8704?`)).text).toBe('😀');
    expect(parseAnnouncementBody(rtf(String.raw`\u353\{X`)).text).toBe('šX');
  });

  it('keeps only the Unicode branch when an RTF editor includes an ANSI alternative', () => {
    expect(parseAnnouncementBody(rtf(String.raw`{\upr{Obavestenje}{\*\ud{Obave\uc0\u353tenje}}}`)).text)
      .toBe('Obaveštenje');
  });

  it('restores nested styles and honors explicit reset controls', () => {
    const result = parseAnnouncementBody(rtf(String.raw`Normal {\b Bold {\i Both} Bold} Normal {\ul Under\ulnone Off} {\strike Strike\strike0 Off} \b\i\ul\plain Reset`));
    expect(result.text).toBe('Normal Bold Both Bold Normal UnderOff StrikeOff Reset');
    expect(result.runs.find((run) => run.text === 'Both')).toMatchObject({ bold: true, italic: true });
    expect(result.runs.find((run) => run.text === ' Bold')).toMatchObject({ bold: true, italic: false });
    expect(result.runs.find((run) => run.text === 'Under')).toMatchObject({ underline: true });
    expect(result.runs.find((run) => run.text === 'Strike')).toMatchObject({ strike: true });
    expect(result.runs.at(-1)).toMatchObject({ bold: false, italic: false, underline: false, strike: false });
  });

  it('preserves paragraphs, tabs, list markers, quotes, and escaped literal braces', () => {
    const result = parseAnnouncementBody(rtf(String.raw`Prvi\par\par Drugi\line Treći\tab Vrednost\par {\pntext\bullet\tab}Stavka\par \\server\{računi\} \ldblquote Tekst\rdblquote\par`));
    expect(result.text).toBe('Prvi\n\nDrugi\nTreći\tVrednost\n•\tStavka\n\\server{računi} “Tekst”');
    expect(parseAnnouncementBody(String.raw`{\rtf1\deff0{\fonttbl{\f0\fcharset238 Arial;}{\f1\fcharset2 Symbol;}}{\pntext\f1\'b7\tab}\f0 Stavka}`).text)
      .toBe('•\tStavka');
  });

  it('hides metadata and embedded objects while displaying hyperlink labels as ordinary text', () => {
    const result = parseAnnouncementBody(rtf(String.raw`{\info{\author Private author}}{\*\custom Hidden {nested metadata}}{\pict\pngblip 1234abcd}{\object{\objdata abcdef}}{\header Header}\v Hidden\v0 Vidljivo {\field{\*\fldinst HYPERLINK "javascript:alert(1)"}{\fldrslt Link}}`));
    expect(result.text).toBe('Vidljivo Link');
  });

  it('consumes Unicode fallbacks even in hidden text', () => {
    expect(parseAnnouncementBody(rtf(String.raw`\v\u353?\v0 Visible`)).text).toBe('Visible');
  });

  it('ignores physical source wrapping, binary braces, and text outside the document', () => {
    expect(parseAnnouncementBody('\uFEFF  '+rtf('Prvi\r\nDrugi')).text).toBe('PrviDrugi');
    expect(parseAnnouncementBody(rtf(String.raw`{\pict\bin4 {\}}}Tekst`)).text).toBe('Tekst');
    expect(parseAnnouncementBody(rtf('Tekst')+' not part of the announcement').text).toBe('Tekst');
  });

  it('does not throw on incomplete RTF or a dangling escape', () => {
    expect(parseAnnouncementBody(String.raw`{\rtf1 Test {\b važan`).text).toBe('Test važan');
    expect(parseAnnouncementBody('{\\rtf1 Tekst\\').text).toBe('Tekst');
    expect(parseAnnouncementBody(rtf(String.raw`\'zz tekst`)).text).toBe('zz tekst');
  });
});
