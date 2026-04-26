import readline from 'readline';

let currentValues = {
  temperature: 25.0,
  humidity: 60.0,
  black_globe: 26.0,
  wbgt: 23.0,
};

let mockJitter = false;

const MOCK_RISK_DEMO = process.env.MOCK_RISK_DEMO === 'true';

function round1(n) {
  return Math.round(n * 10) / 10;
}

// WBGT 계산 (간이 공식: 0.7*습구 + 0.2*흑구 + 0.1*건구)
function calcWbgt(temp, hum, blackGlobe) {
  const wetBulb = temp * Math.atan(0.151977 * Math.sqrt(hum + 8.313659))
    + Math.atan(temp + hum) - Math.atan(hum - 1.676331)
    + 0.00391838 * Math.pow(hum, 1.5) * Math.atan(0.023101 * hum) - 4.686035;
  return Math.round((0.7 * wetBulb + 0.2 * blackGlobe + 0.1 * temp) * 10) / 10;
}

export function initMockSensor() {
  mockJitter = true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (line) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const val = parseFloat(parts[1]);

    if (isNaN(val)) {
      console.log('사용법: wbgt 28.5 | temp 30 | hum 80 | bg 35');
      return;
    }

    switch (cmd) {
      case 'wbgt':
        currentValues.wbgt = val;
        console.log(`[mock] WBGT 직접 설정: ${val}`);
        break;
      case 'temp':
        currentValues.temperature = val;
        currentValues.wbgt = calcWbgt(val, currentValues.humidity, currentValues.black_globe);
        console.log(`[mock] 기온: ${val}, WBGT 재계산: ${currentValues.wbgt}`);
        break;
      case 'hum':
        currentValues.humidity = val;
        currentValues.wbgt = calcWbgt(currentValues.temperature, val, currentValues.black_globe);
        console.log(`[mock] 습도: ${val}, WBGT 재계산: ${currentValues.wbgt}`);
        break;
      case 'bg':
        currentValues.black_globe = val;
        currentValues.wbgt = calcWbgt(currentValues.temperature, currentValues.humidity, val);
        console.log(`[mock] 흑구: ${val}, WBGT 재계산: ${currentValues.wbgt}`);
        break;
      default:
        console.log('사용법: wbgt 28.5 | temp 30 | hum 80 | bg 35');
    }
  });
  console.log('[mock] 센서 mock 모드 — 명령어: wbgt/temp/hum/bg <값>');
}

export function readSensor() {
  if (!mockJitter) {
    return { ...currentValues };
  }
  if (MOCK_RISK_DEMO) {
    const tMs = Date.now() / 42000;
    const w =
      25.5 + 3.0 * Math.sin(tMs) + (Math.random() - 0.5) * 0.25;
    return {
      temperature: round1(currentValues.temperature + (Math.random() - 0.5) * 0.4),
      humidity: round1(
        Math.min(100, Math.max(0, currentValues.humidity + (Math.random() - 0.5) * 1.2))
      ),
      black_globe: round1(currentValues.black_globe + (Math.random() - 0.5) * 0.2),
      wbgt: round1(w),
    };
  }
  const t = currentValues.temperature + (Math.random() - 0.5) * 0.9;
  const h = Math.min(100, Math.max(0, currentValues.humidity + (Math.random() - 0.5) * 2.5));
  const bg = currentValues.black_globe + (Math.random() - 0.5) * 0.5;
  const temperature = round1(t);
  const humidity = round1(h);
  const black_globe = round1(bg);
  return {
    temperature,
    humidity,
    black_globe,
    wbgt: round1(calcWbgt(t, h, bg)),
  };
}
