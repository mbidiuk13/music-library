//справжніх обкладинок немає: пара кольорів градієнта детерміновано обирається з id треку

const COVER_GRADIENTS = [
  ['#ff7a59', '#c04cfd'],
  ['#ffb347', '#ff4f8b'],
  ['#ff4f8b', '#7b2ff7'],
  ['#f9d423', '#ff4e50'],
  ['#c04cfd', '#5b2bff'],
];

function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function coverGradient(trackId) {
  const [from, to] = COVER_GRADIENTS[hashString(String(trackId)) % COVER_GRADIENTS.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}
