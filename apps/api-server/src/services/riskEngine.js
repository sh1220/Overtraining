export function calculateRisk({ sleep_score, current_hr, age, wbgt }) {
  const factors = { sleep: 0, wbgt: 0, heart_rate: 0 };

  if (sleep_score != null) {
    if (sleep_score < 60) factors.sleep = 30;
    else if (sleep_score < 75) factors.sleep = 15;
  }
  if (wbgt != null) {
    if (wbgt >= 28) factors.wbgt = 40;
    else if (wbgt >= 25) factors.wbgt = 20;
  }
  // 심박: (나이·%보다) 절대 BPM — 부담 늦게(고강도 구간)만 반영
  if (current_hr != null) {
    if (current_hr >= 180) factors.heart_rate = 30;
    else if (current_hr >= 150) factors.heart_rate = 20;
  }

  const score = factors.sleep + factors.wbgt + factors.heart_rate;
  let verdict = 'OK', level = 'INFO', recommendation = '운동 진행 가능';
  if (score >= 70) { verdict = 'STOP'; level = 'CRITICAL'; recommendation = '운동 즉시 중단 권고'; }
  else if (score >= 40) { verdict = 'CAUTION'; level = 'WARNING'; recommendation = '강도 낮추기 권장'; }

  return { risk_score: score, verdict, level, recommendation, factors };
}
