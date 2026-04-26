'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { getToken, getUser, isUiDemoMode, logout, AUTH_TEMP_DISABLED, enterUiDemoMode } from '@/lib/auth';
import FitbitConnect from './FitbitConnect';
import SessionLive from './SessionLive';
import RiskGauge from './RiskGauge';
import Link from 'next/link';

interface RiskData {
  risk_score: number;
  verdict: string;
  recommendation: string;
  factors: { sleep: number; wbgt: number; heart_rate: number };
}

interface Session {
  id: number;
  status: string;
  started_at: string;
  ended_at: string | null;
  max_risk_score: number;
  final_verdict: string | null;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [fitbitConnected, setFitbitConnected] = useState(false);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<any>(null);

  useEffect(() => {
    if (AUTH_TEMP_DISABLED) {
      if (!getToken()) enterUiDemoMode({ username: 'guest' });
      loadData();
    } else if (!getToken()) {
      router.replace('/login');
      return;
    } else {
      loadData();
    }

    // Fitbit 연동 완료 확인
    if (searchParams.get('fitbit') === 'connected') {
      alert('Fitbit 연동이 완료되었습니다!');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount 시 1회 (searchParams 는 Suspense 이후)
  }, []);

  const loadData = async () => {
    if (isUiDemoMode()) {
      const u = getUser() || { username: 'guest', age: 30, id: 0 };
      setUser({ ...u, fitbit_connected: false });
      setFitbitConnected(false);
      setRisk({
        risk_score: 42,
        verdict: 'CAUTION',
        recommendation: '운동 강도를 조절하세요. (UI 데모·데이터는 가짜)',
        factors: { sleep: 0.2, wbgt: 0.3, heart_rate: 0.1 },
      });
      setSessions([
        {
          id: 100,
          status: 'ended',
          started_at: new Date().toISOString(),
          ended_at: new Date().toISOString(),
          max_risk_score: 35,
          final_verdict: 'CAUTION',
        },
      ]);
      setActiveSession(null);
      setLoading(false);
      return;
    }
    try {
      const [meRes, riskRes, sessRes] = await Promise.all([
        api.get('/auth/me'),
        api.get('/api/health/risk'),
        api.get('/api/sessions'),
      ]);
      setUser(meRes.data);
      setFitbitConnected(meRes.data.fitbit_connected);
      setRisk(riskRes.data);
      setSessions(sessRes.data);

      const active = sessRes.data.find((s: Session) => s.status === 'active');
      setActiveSession(active || null);

      // Fitbit 스냅샷 조회
      if (meRes.data.fitbit_connected) {
        try {
          const snapRes = await api.get('/api/fitbit/snapshot');
          setSnapshot(snapRes.data);
        } catch {}
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    if (isUiDemoMode()) {
      setActiveSession({
        id: 1,
        status: 'active',
        started_at: new Date().toISOString(),
        ended_at: null,
        max_risk_score: 0,
        final_verdict: null,
      });
      return;
    }
    try {
      const res = await api.post('/api/sessions');
      setActiveSession(res.data);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setActiveSession({ id: err.response.data.session_id } as Session);
      } else {
        alert('세션 시작 실패');
      }
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    if (isUiDemoMode()) {
      setActiveSession(null);
      return;
    }
    try {
      await api.post(`/api/sessions/${activeSession.id}/end`);
      setActiveSession(null);
      loadData();
    } catch {
      alert('세션 종료 실패');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {isUiDemoMode() && (
        <p className="mb-3 text-center text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md py-2 px-3">
          UI 데모 모드 — API/백엔드 없이 가짜 데이터로 화면만 표시됩니다.
        </p>
      )}
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">대시보드</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user?.username}</span>
          <button onClick={logout} className="text-sm text-red-500 hover:underline">로그아웃</button>
        </div>
      </div>

      {/* Fitbit 연동 */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold">Fitbit</h2>
          <FitbitConnect connected={fitbitConnected} onDisconnect={() => { setFitbitConnected(false); setSnapshot(null); }} />
        </div>
        {snapshot && (
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="text-center">
              <div className="text-sm text-gray-500">수면점수</div>
              <div className="text-lg font-bold">{snapshot.sleep_score ?? '--'}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">안정시 심박</div>
              <div className="text-lg font-bold">{snapshot.resting_hr ?? '--'}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-500">HRV</div>
              <div className="text-lg font-bold">{snapshot.hrv_ms ?? '--'} ms</div>
            </div>
          </div>
        )}
      </div>

      {/* 운동 전 위험도 */}
      {!activeSession && risk && (
        <div className="mb-4">
          <RiskGauge score={risk.risk_score} verdict={risk.verdict} />
          <p className="text-center text-gray-600 mt-2">{risk.recommendation}</p>
        </div>
      )}

      {/* 세션 컨트롤 */}
      <div className="bg-white p-4 rounded-lg shadow mb-4">
        {activeSession ? (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-green-600">운동 중</h2>
              <button onClick={endSession} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">
                운동 종료
              </button>
            </div>
            <SessionLive sessionId={activeSession.id} />
          </div>
        ) : (
          <button onClick={startSession} className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 text-lg font-semibold">
            운동 시작
          </button>
        )}
      </div>

      {/* 세션 히스토리 */}
      {sessions.filter(s => s.status !== 'active').length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-3">히스토리</h2>
          <div className="space-y-2">
            {sessions.filter(s => s.status !== 'active').map((s) => (
              <Link
                key={s.id}
                href={`/sessions/${s.id}`}
                className="block p-3 border rounded-md hover:bg-gray-50"
              >
                <div className="flex justify-between">
                  <span className="text-sm">{new Date(s.started_at).toLocaleString('ko-KR')}</span>
                  <span className={`text-sm font-bold ${
                    s.final_verdict === 'STOP' ? 'text-red-600' :
                    s.final_verdict === 'CAUTION' ? 'text-yellow-600' : 'text-green-600'
                  }`}>
                    {s.final_verdict || '--'}
                  </span>
                </div>
                <div className="text-xs text-gray-400">최대 위험도: {s.max_risk_score}</div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={<div className="flex items-center justify-center min-h-screen">로딩 중...</div>}
    >
      <DashboardContent />
    </Suspense>
  );
}
