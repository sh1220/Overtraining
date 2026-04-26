#!/bin/bash
# EC2 초기 셋업 스크립트 (Ubuntu 22.04)
set -e

echo "=== Docker 설치 ==="
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER

echo "=== Git 설치 ==="
sudo apt-get install -y git

echo "=== DuckDNS 크론 설정 ==="
echo "DuckDNS 토큰과 서브도메인을 입력하세요:"
read -p "서브도메인 (예: myhealth-demo): " DUCKDNS_SUBDOMAIN
read -p "토큰: " DUCKDNS_TOKEN
echo "*/5 * * * * echo url=\"https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=\" | curl -k -o ~/duckdns/duck.log -K -" | crontab -
mkdir -p ~/duckdns
echo "url=\"https://www.duckdns.org/update?domains=${DUCKDNS_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=\"" | curl -k -o ~/duckdns/duck.log -K -
echo "DuckDNS 설정 완료"

echo "=== 완료 ==="
echo "1. .env 파일을 infra/ 디렉터리에 작성하세요"
echo "2. cd infra && docker compose up -d"
