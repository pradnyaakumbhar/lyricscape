export interface Word {
  w: string;
  t0: number; // seconds – word starts
  t1: number; // seconds – word ends
}

export interface Line {
  t: number;   // line start time (seconds)
  end: number; // line end time (seconds)
  words: Word[];
}

/** Parse an LRC string into timed lines, spreading each line's duration across its words by character length. */
export function parseLRC(txt: string): Line[] {
  const raw: { t: number; text: string }[] = [];

  for (const row of txt.split("\n")) {
    const m = row.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    if (m) raw.push({ t: Number(m[1]) * 60 + Number(m[2]), text: m[3].trim() });
  }

  raw.sort((a, b) => a.t - b.t);

  const lines: Line[] = [];
  raw.forEach((r, i) => {
    if (!r.text) return;
    const end = raw[i + 1]?.t ?? r.t + 4;
    const parts = r.text.split(/\s+/);
    const totalChars = parts.reduce((s, w) => s + w.length + 2, 0);
    const span = Math.max(0.5, (end - r.t) * 0.92);
    let acc = r.t;
    const words: Word[] = parts.map((w) => {
      const d = (span * (w.length + 2)) / totalChars;
      const word: Word = { w, t0: acc, t1: acc + d };
      acc += d;
      return word;
    });
    lines.push({ t: r.t, end, words });
  });

  return lines;
}
