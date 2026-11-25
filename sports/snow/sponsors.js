// FoxSports parody sponsors (2026-11-25, the user: "add sponsors that imitate real companies ... Red Fox (Red Bull), The Fox Face (The North Face)"):
// our own brands, drawn here (their own fox logos, colours and lettering; nothing copied from the real brands). Used by Ski Jump; Snowboard has its own copy.
const SPONSOR = {};
export function sponsorTex(THREE, kind) { if (SPONSOR[kind]) return SPONSOR[kind];
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const fox = (x, y, r, col, face) => { g.fillStyle = col; g.beginPath(); g.moveTo(x - r, y - r * 0.2); g.lineTo(x - r * 0.75, y - r * 1.15); g.lineTo(x - r * 0.25, y - r * 0.55); g.lineTo(x + r * 0.25, y - r * 0.55); g.lineTo(x + r * 0.75, y - r * 1.15); g.lineTo(x + r, y - r * 0.2); g.lineTo(x, y + r * 0.95); g.closePath(); g.fill();
    g.fillStyle = face; g.beginPath(); g.moveTo(x - r * 0.55, y + r * 0.05); g.lineTo(x, y + r * 0.8); g.lineTo(x + r * 0.55, y + r * 0.05); g.lineTo(x, y + r * 0.3); g.closePath(); g.fill(); g.beginPath(); g.arc(x, y + r * 0.72, r * 0.1, 0, 7); g.fillStyle = '#1b1b2a'; g.fill(); };
  const round = (x, y, w, h, r, col) => { g.fillStyle = col; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.fill(); };
  if (kind === 'red') {   // RED FOX: a cream card, an orange fox head, navy lettering, "GIVES YOU SPEED!"
    round(6, 6, 500, 244, 34, '#fff6e6'); round(6, 196, 500, 54, 0, '#ff5a1f'); fox(110, 104, 70, '#ff5a1f', '#fff6e6');
    g.fillStyle = '#16205a'; g.font = '900 italic 84px "Lilita One", "Arial Black", sans-serif'; g.textBaseline = 'middle'; g.fillText('RED', 200, 72); g.fillText('FOX', 200, 148);
    g.fillStyle = '#fff6e6'; g.font = '800 30px "Lilita One", "Arial Black", sans-serif'; g.textAlign = 'center'; g.fillText('GIVES YOU SPEED!', 256, 224); }
  else {   // THE FOX FACE: a dark teal card, a white fox face in a rounded square, white lettering, "NEVER STOP RIDING"
    round(6, 6, 500, 244, 30, '#0f3d44'); round(28, 40, 150, 150, 28, '#ffffff'); fox(103, 112, 52, '#ff8a2a', '#ffffff');
    g.fillStyle = '#ffffff'; g.textBaseline = 'middle'; g.font = '800 40px "Lilita One", "Arial Black", sans-serif'; g.fillText('THE', 200, 66); g.font = '900 64px "Lilita One", "Arial Black", sans-serif'; g.fillText('FOX FACE', 196, 124);
    g.fillStyle = '#7fe0d4'; g.font = '800 24px "Lilita One", "Arial Black", sans-serif'; g.fillText('NEVER STOP RIDING', 200, 182); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return (SPONSOR[kind] = t); }
