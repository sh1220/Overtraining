'use client';
import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { getToken } from '@/lib/auth';
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
    const token = getToken();
    if (!token) return;

    const es = new EventSource(`${API_BASE}/api/sessions/${sessionId}/stream?token=${token}`);
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

    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [sessionId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-gray-500">{connected ? '실시간 연결됨' : '연결 끊김'}</span>
      </div>

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
