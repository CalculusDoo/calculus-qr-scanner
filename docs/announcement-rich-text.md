# PowerBuilder announcement text

The announcement API's `body` may contain plain text or a PowerBuilder RTF
document. Keep the original value in the API response and JSON-encode it normally;
do not manually remove or double-escape backslashes. The app detects the RTF header
and converts the document when rendering it.

`lib/announcement-body.ts` reads RTF into native text runs. Both the drawer and
important-announcement popup use `components/announcements/AnnouncementBody.tsx`.
This is JavaScript-only and works with the existing development installation.

Supported content:

- Plain text remains unchanged.
- Windows-1250 (Serbian Latin), Windows-1251 (Cyrillic), Windows-1252, and RTF
  Unicode escapes, including scoped ANSI fallback counts and per-font encodings.
- Paragraphs, line breaks, tabs, explicit list labels/bullets, and basic
  bold/italic/underline/strikethrough styling.
- Visible hyperlink field labels. Navigation continues to use the announcement's
  separate `link` action; RTF field instructions are not executed or opened.

The app uses its Rubik fonts and existing text sizes/colors. Desktop font names,
page layout, shapes, embedded objects/images, headers/footers, and document
metadata are omitted. Tables retain text separators rather than desktop layout.
This reader covers announcement text; it is not a complete RTF word processor.
Unsupported byte encodings produce replacement characters instead of guessing.

The supplied TX_RTF32 sample is saved as a regression fixture. Its
`\ansicpg1250` / `\fcharset238` and `\'9a` decode to **Test obaveštenje**.

Validation: typecheck, lint, and 91 tests pass. Tests cover the supplied document,
Serbian letters, Cyrillic, Unicode/surrogate pairs, scoped formatting, lists,
metadata, field labels, binary groups, and incomplete RTF. Check both the collapsed
and expanded drawer entries and the important popup on a phone after refreshing
the development app. No native rebuild or backend deployment is needed for this
rendering change.

References:

- [PowerBuilder 12.5 CopyRTF](https://infocenter.sybase.com/help/topic/com.sybase.infocenter.dc37783.1250/html/dwref/CAIBGFGEdw.htm)
- [Microsoft RTF text encoding](https://learn.microsoft.com/en-us/openspecs/exchange_server_protocols/ms-oxrtfex/1e44fa4c-3ea3-402c-8b21-fb19a617e43b)
- [Unicode Windows character mappings](https://unicode.org/Public/MAPPINGS/VENDORS/MICSFT/WINDOWS/)
