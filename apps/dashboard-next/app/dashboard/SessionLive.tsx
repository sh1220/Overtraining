'use client';
import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { getToken, isUiDemoMode } from '@/lib/auth';
import RiskGauge from './RiskGauge';

interface SessionLiveProps {
  sessionId: number;
}

interface LiveData {
  hr: number | null;
  wbgt: number | null;
  temperature: number | null;
  humidity: number | null;
  risk_score: number;
  verdict: string;
  recommendation: string;
  ts: string;
}

interface Alert {
  level: string;
  risk_score: number;
  message: string;
}

export default function SessionLive({ sessionId }: SessionLiveProps) {
  const [data, setData] = useState<LiveData | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (isUiDemoMode()) {
      setConnected(true);
      setData({
        hr: 98,
        wbgt: 28.5,
        temperature: 30,
        humidity: 65,
        risk_score: 45,
        verdict: 'CAUTION',
        recommendation: '휴식을 권장합니다. (UI 데모)',
        ts: new Date().toISOString(),
      });
      return;
    }
    const token = getToken();
    if (!token) return;

    const qs = new URLSearchParams({ token: token ?? '' });
    const es = new EventSource(
      `${API_BASE}/api/sessions/${sessionId}/stream?${qs.toString()}`
    );
    esRef.current = es;

    es.addEventListener('connected', () => setConnected(true));

    es.addEventListener('update', (e) => {
      const parsed = JSON.parse(e.data);
      setData(parsed);
    });

    es.addEventListener('alert', (e) => {
      const alert = JSON.parse(e.data);
      setAlerts((prev) => [alert, ...prev].slice(0, 20));
    });

    // EventSource 는 재접속 시에도 onerror가 자주 뜸 — 끊김(CLOSED)일 때만 빨간 표시
    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) setConnected(false);
    };

    return () => es.close();
  }, [sessionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-gray-500">{connected ? '실시간 연결됨' : '연결 끊김'}</span>
      </div>

      {connected && !data && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md p-3 leading-relaxed">
          아래 수치는 <strong>라즈베리 Pi 엣지 → Kafka</strong>로 데이터가 올 때마다 갱신됩니다. 이 상태로 멈춰 있으면: Pi에서
          <code className="mx-1 text-xs bg-white px-1 py-0.5 rounded">edge-agent</code> 실행 여부,{' '}
          <code className="text-xs bg-white px-1 py-0.5 rounded">.env</code>의{' '}
          <code className="text-xs bg-white px-1 py-0.5 rounded">KAFKA_BROKERS</code>를 확인하세요. 심박/리스크는 HR 메시지의{' '}
          <code className="text-xs bg-white px-1 py-0.5 rounded">device_id</code>에 대응하는{' '}
          <code className="text-xs bg-white px-1 py-0.5 rounded">edge_devices.user_id</code>(또는{' '}
          <code className="text-xs bg-white px-1 py-0.5 rounded">/api/edge/register</code>)가 로그인 id와 같아야 합니다.
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-3 rounded-lg shadow text-center">
              <div className="text-sm text-gray-500">심박수</div>
              <div className="text-2xl font-bold text-red-500">{data.hr ?? '--'}</div>
              <div className="text-xs text-gray-400">BPM</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow text-center">
              <div className="text-sm text-gray-500">WBGT</div>
              <div className="text-2xl font-bold text-orange-500">{data.wbgt ?? '--'}</div>
              <div className="text-xs text-gray-400">°C</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow text-center">
              <div className="text-sm text-gray-500">기온</div>
              <div className="text-2xl font-bold">{data.temperature ?? '--'}</div>
              <div className="text-xs text-gray-400">°C</div>
            </div>
            <div className="bg-white p-3 rounded-lg shadow text-center">
              <div className="text-sm text-gray-500">습도</div>
              <div className="text-2xl font-bold">{data.humidity ?? '--'}</div>
              <div className="text-xs text-gray-400">%</div>
            </div>
          </div>

          <RiskGauge score={data.risk_score} verdict={data.verdict} />

          <p className="text-center text-gray-600">{data.recommendation}</p>
        </>
      )}

      {alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">알림</h3>
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`p-2 rounded text-sm ${
                a.level === 'CRITICAL' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              [{a.level}] {a.message} (위험도: {a.risk_score})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
