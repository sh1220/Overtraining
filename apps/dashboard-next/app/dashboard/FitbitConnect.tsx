'use client';
import { useState } from 'react';
import api from '@/lib/api';

interface FitbitConnectProps {
  connected: boolean;
  onDisconnect: () => void;
}

export default function FitbitConnect({ connected, onDisconnect }: FitbitConnectProps) {
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/fitbit/start');
      window.location.href = res.data.authorize_url;
    } catch (err) {
      alert('Fitbit 연동 시작 실패');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Fitbit 연동을 해제하시겠습니까?')) return;
    try {
      await api.post('/auth/fitbit/disconnect');
      onDisconnect();
    } catch {
      alert('연동 해제 실패');
    }
  };

  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-green-600 font-medium">Fitbit 연동됨</span>
        <button
          onClick={handleDisconnect}
          className="text-sm text-red-500 hover:underline"
        >
          해제
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={loading}
      className="bg-teal-500 text-white px-4 py-2 rounded-md hover:bg-teal-600 disabled:opacity-50"
    >
      {loading ? '연결 중...' : 'Fitbit 연동'}
    </button>
  );
}
