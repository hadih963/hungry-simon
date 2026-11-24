// Public-domain melodies that fit the 8 keys (C4..C5).
// Notation: letter + length in beats. C D E F G A B = keys 0..6, c = high C (key 7).
const KEY_OF = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6, c: 7 };

function parse(text) {
  return text.trim().split(/\s+/).map((tok) => {
    const key = KEY_OF[tok[0]];
    const beats = Number(tok.slice(1));
    if (key === undefined || !(beats > 0)) throw new Error(`Bad note "${tok}"`);
    return { key, beats };
  });
}

export const SONGS = [
  {
    id: 'ode', title: 'Ode to Joy', bpm: 96,
    notes: parse(`E1 E1 F1 G1 G1 F1 E1 D1 C1 C1 D1 E1 E1.5 D0.5 D2
                  E1 E1 F1 G1 G1 F1 E1 D1 C1 C1 D1 E1 D1.5 C0.5 C2`),
  },
  {
    id: 'twinkle', title: 'Twinkle Twinkle Little Star', bpm: 100,
    notes: parse(`C1 C1 G1 G1 A1 A1 G2 F1 F1 E1 E1 D1 D1 C2
                  G1 G1 F1 F1 E1 E1 D2 G1 G1 F1 F1 E1 E1 D2
                  C1 C1 G1 G1 A1 A1 G2 F1 F1 E1 E1 D1 D1 C2`),
  },
  {
    id: 'mary', title: 'Mary Had a Little Lamb', bpm: 108,
    notes: parse(`E1 D1 C1 D1 E1 E1 E2 D1 D1 D2 E1 G1 G2
                  E1 D1 C1 D1 E1 E1 E1 E1 D1 D1 E1 D1 C4`),
  },
  {
    id: 'jingle', title: 'Jingle Bells (chorus)', bpm: 120,
    notes: parse(`E1 E1 E2 E1 E1 E2 E1 G1 C1.5 D0.5 E4
                  F1 F1 F1.5 F0.5 F1 E1 E1 E0.5 E0.5 E1 D1 D1 E1 D2 G2`),
  },
  {
    id: 'scale', title: 'Warm-up scale', bpm: 90,
    notes: parse(`C1 D1 E1 F1 G1 A1 B1 c2 B1 A1 G1 F1 E1 D1 C2`),
  },
];

export const songById = (id) => SONGS.find((s) => s.id === id) || SONGS[0];
