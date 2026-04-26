'use client';

interface RiskGaugeProps {
  score: number;
  verdict: string;
}

export default function RiskGauge({ score, verdict }: RiskGaugeProps) {
  const getColor = () => {
    if (score >= 70) return 'text-red-600 bg-red-50 border-red-300';
    if (score >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-300';
    return 'text-green-600 bg-green-50 border-green-300';
  };

  const getBarColor = () => {
    if (score >= 70) return 'bg-red-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getColor()}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-lg">위험도</span>
        <span className="text-2xl font-bold">{score}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${getBarColor()}`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <div className="text-center font-bold text-xl">{verdict}</div>
    </div>
  );
}
