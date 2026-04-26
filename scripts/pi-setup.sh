#!/bin/bash
# Raspberry Pi 셋업 스크립트
set -e

echo "=== Node.js 20 설치 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== Edge Agent 설치 ==="
cd apps/edge-agent
npm install

echo "=== 완료 ==="
echo "1. .env 파일을 작성하세요 (.env.example 참고)"
echo "2. EC2에서 /api/edge/register로 API 키 발급"
echo "3. npm start"
