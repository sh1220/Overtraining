'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getToken, isUiDemoMode, AUTH_TEMP_DISABLED, enterUiDemoMode } from '@/lib/auth';
import Link from 'next/link';

interface Alert {
  id: number;
  ts: string;
  level: string;
  risk_score: number;
  message: string;
}

interface SessionDetail {
  id: number;
  user_id: number;
  started_at: string;
  ended_at: string | null;
  status: string;
  max_risk_score: number;
  final_verdict: string | null;
  alerts: Alert[];
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (AUTH_TEMP_DISABLED) {
      if (!getToken()) enterUiDemoMode({ username: 'guest' });
      loadSession();
      return;
    }
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    loadSession();
  }, []);

  const loadSession = async () => {
    if (isUiDemoMode()) {
      const id = Number(params.id) || 100;
      setSession({
        id,
        user_id: 0,
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        status: 'ended',
        max_risk_score: 35,
        final_verdict: 'CAUTION',
        alerts: [
          { id: 1, ts: new Date().toISOString(), level: 'WARNING', risk_score: 32, message: '과열에 주의 (UI 데모)' },
        ],
      });
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/api/sessions/${params.id}`);
      setSession(res.data);
    } catch {
      alert('세션을 찾을 수 없습니다');
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen">로딩 중...</div>;
  if (!session) return null;

  const verdictColor = session.final_verdict === 'STOP' ? 'text-red-600' :
    session.final_verdict === 'CAUTION' ? 'text-yellow-600' : 'text-green-600';

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-blue-600 hover:underline">← 대시보드</Link>
        <h1 className="text-xl font-bold">세션 #{session.id}</h1>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500">시작</div>
            <div className="font-medium">{new Date(session.started_at).toLocaleString('ko-KR')}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">종료</div>
            <div className="font-medium">
              {session.ended_at ? new Date(session.ended_at).toLocaleString('ko-KR') : '진행 중'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">상태</div>
            <div className="font-medium">{session.status}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">최종 판정</div>
            <div className={`font-bold text-lg ${verdictColor}`}>
              {session.final_verdict || '--'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">최대 위험도</div>
            <div className="font-bold text-lg">{session.max_risk_score}</div>
          </div>
        </div>
      </div>

      {/* Alerts 타임라인 */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h2 className="font-semibold mb-3">알림 타임라인 ({session.alerts.length}건)</h2>
        {session.alerts.length === 0 ? (
          <p className="text-gray-400 text-sm">알림 없음</p>
        ) : (
          <div className="space-y-2">
            {session.alerts.map((a) => (
              <div
                key={a.id}
                className={`p-3 rounded-md border-l-4 ${
                  a.level === 'CRITICAL'
                    ? 'border-red-500 bg-red-50'
                    : 'border-yellow-500 bg-yellow-50'
                }`}
              >
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">{a.level}</span>
                  <span className="text-gray-400">{new Date(a.ts).toLocaleTimeString('ko-KR')}</span>
                </div>
                <div className="text-sm mt-1">{a.message}</div>
                <div className="text-xs text-gray-400 mt-1">위험도: {a.risk_score}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
