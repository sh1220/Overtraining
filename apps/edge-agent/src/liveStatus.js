// 터미널에 심박 + 환경 한 줄로 보이게 쓰는 스냅샷
const s = {
  hr: null,
  wbgt: null,
  temperature: null,
  humidity: null,
};

export function setLiveHr(bpm) {
  if (bpm != null && !Number.isNaN(Number(bpm))) s.hr = Number(bpm);
}

export function setLiveWbgt({ wbgt, temperature, humidity }) {
  if (wbgt != null) s.wbgt = wbgt;
  if (temperature != null) s.temperature = temperature;
  if (humidity != null) s.humidity = humidity;
}

function fmt(n, unit) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${n}${unit}`;
}

/** Kafka 전송 직후 같이 부르기: 심박 | WBGT | 기온 | 습도 */
export function logLive() {
  const line = [
    `심박 ${s.hr != null ? `${s.hr} BPM` : '—'}`,
    `WBGT ${fmt(s.wbgt, '°C')}`,
    `기온 ${fmt(s.temperature, '°C')}`,
    `습도 ${fmt(s.humidity, '%')}`,
  ].join('  |  ');
  console.log(`[edge] ${line}`);
}
