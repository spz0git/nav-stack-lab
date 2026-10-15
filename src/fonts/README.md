# Fonts

The page embeds its four typefaces as `data:` URIs so that it makes no network request at runtime (offline, behind
blockers and on GitHub Pages it looks the same as on the author's machine). `fonts.json` lists each face: family,
style, weight (a range for a variable font), the file, the `unicode-range` it covers and the Google Fonts URL it was
taken from. `node build.mjs` turns the list into `@font-face` rules with the file base64-encoded (about 215 KB in the
page) and inlines them before the stylesheet.

| Family | Use | Files | Licence |
| --- | --- | --- | --- |
| Barlow 400 / 500 / 600 | body text (`--f-body`) | `barlow-*.woff2` | SIL OFL 1.1, `OFL-barlow.txt` |
| Barlow Semi Condensed 500 / 600 / 700 | headings and tabs (`--f-display`) | `barlow-semi-condensed-*.woff2` | SIL OFL 1.1, `OFL-barlow.txt` |
| JetBrains Mono 400–500 (variable) | numbers, code, the event log (`--f-mono`) | `jetbrains-mono-400-500.woff2` | SIL OFL 1.1, `OFL-jetbrainsmono.txt` |
| STIX Two Text 400, italic 400 | symbols and glossary terms (`--f-math`) | `stix-two-text-*.woff2` | SIL OFL 1.1, `OFL-stixtwotext.txt` |

The files are the Latin subsets Google Fonts serves (the same bytes the page used to load from `fonts.gstatic.com`), so
Latin Extended, Greek and Cyrillic text falls back to the system fonts named after each family in `src/styles.css`.

To refresh or add a face: fetch the CSS for the families from `https://fonts.googleapis.com/css2?...` with a modern
browser user agent, copy the `/* latin */` block's `src` URL and `unicode-range` into `fonts.json`, download the file
next to it, and rebuild.
