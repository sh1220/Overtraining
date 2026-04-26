# Overtraining Prevention System

Raspberry Pi(엣지) + AWS EC2(백엔드) + Vercel(프론트엔드) 구조의 과훈련 방지 스마트헬스케어 시연 시스템.

WBGT 환경 센서와 Fitbit 심박수를 실시간으로 수집하고, Risk Engine이 위험도를 평가하여 운동 중단/주의 알림을 제공한다.

---

## 아키텍처

```
┌─────────────────┐     Kafka(9094)     ┌──────────────────────────────────────┐
│  Raspberry Pi   │ ──────────────────> │  AWS EC2 t3.medium                   │
│                 │                     │                                      │
│  - WBGT 센서    │     HTTPS           │  Caddy (auto TLS)                    │
│  - Fitbit HR    │ <────────────────── │    ├── Express API (:3000)            │
│  - Kafka 발행   │                     │    │   ├── Kafka Consumer             │
└─────────────────┘                     │    │   ├── Risk Engine                │
                                        │    │   ├── Fitbit OAuth               │
┌─────────────────┐     HTTPS           │    │   └── SSE Broker                 │
│  Vercel         │ ──────────────────> │    ├── MySQL 8                        │
│  Next.js 14     │                     │    ├── Kafka 3.7 (KRaft)              │
│  대시보드        │                     │    └── Prometheus                     │
└─────────────────┘                     └──────────────────────────────────────┘
```

---

## 기술 스택

| 계층 | 기술 |
|---|---|
| Edge | Node.js 20, kafkajs, axios |
| Backend | Express, kafkajs, mysql2, prom-client, jsonwebtoken, bcrypt |
| DB | MySQL 8 (Docker) |
| Streaming | Kafka 3.7 KRaft 단일 노드 |
| Metrics | Prometheus |
| Reverse Proxy | Caddy 2 (Let's Encrypt 자동) |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Auth | JWT (내부) + Fitbit OAuth 2.0 (PKCE) |
| 배포 | Docker Compose (EC2), Vercel (프론트) |

---

## 사전 준비

1. **AWS EC2 t3.medium** — Ubuntu 22.04, 보안 그룹: 22(SSH), 80/443(HTTP/S), 9094(Kafka)
2. **DuckDNS** — https://duckdns.org 가입 후 서브도메인 생성, EC2 퍼블릭 IP 등록
3. **Fitbit Developer Portal** — https://dev.fitbit.com 에서 앱 등록
4. **Vercel 계정** — https://vercel.com
5. **(선택) Raspberry Pi** — Node.js 20 설치 가능한 Pi 3B+ 이상

---

## 1. EC2 셋업

```bash
# EC2 접속
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>

# 초기 설정 스크립트 실행
chmod +x scripts/ec2-setup.sh
./scripts/ec2-setup.sh

# 재접속 (docker 그룹 반영)
exit && ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

### 환경변수 설정

```bash
cd infra
cp .env.example .env
vi .env
```

```env
EC2_PUBLIC_HOST=<EC2 퍼블릭 IP>
PUBLIC_DOMAIN=myhealth-demo.duckdns.org
VERCEL_URL=https://your-app.vercel.app
MYSQL_ROOT_PASSWORD=<강한 비밀번호>
JWT_SECRET=<32자 이상 랜덤 문자열>
FITBIT_CLIENT_ID=<Fitbit 앱 Client ID>
FITBIT_CLIENT_SECRET=<Fitbit 앱 Client Secret>
EDGE_API_KEY_PEPPER=<랜덤 문자열>
SEED_EDGE_API_KEY=<pi-01 초기 API 키>
```

### 서비스 시작

```bash
cd infra
docker compose up -d

# 로그 확인
docker compose logs -f api-server
```

약 30초 후 모든 서비스가 준비된다. Caddy가 자동으로 Let's Encrypt 인증서를 발급한다.

확인:
- `https://<도메인>/health` → `{"status":"ok"}`
- `https://<도메인>/api-docs` → Swagger UI
- `https://<도메인>/metrics` → Prometheus 메트릭

---

## 2. Fitbit Developer Portal 등록

1. https://dev.fitbit.com/apps/new 접속
2. 설정:
   - **Application Name**: Overtraining Prevention
   - **OAuth 2.0 Application Type**: **Server**
   - **Callback URL**: `https://<도메인>/auth/fitbit/callback`
   - **Default Access Type**: Read Only
3. **Scope** 선택: `heartrate`, `sleep`, `activity`, `profile`
4. 발급된 **Client ID**와 **Client Secret**을 EC2 `.env`에 입력
5. `docker compose restart api-server`

> Personal 타입으로 등록하면 Intraday HR 접근이 자동 부여된다.

---

## 3. Raspberry Pi 셋업

```bash
# 프로젝트 클론
git clone <repo-url>
cd overtraining-prevention

# 셋업
chmod +x scripts/pi-setup.sh
./scripts/pi-setup.sh
```

### Edge 디바이스 등록

```bash
# EC2 API에서 API 키 발급
curl -X POST https://<도메인>/api/edge/register \
  -H "Content-Type: application/json" \
  -d '{"device_id": "pi-01", "user_id": 1}'
```

응답의 `api_key`를 복사한다.

### 환경변수 설정

```bash
cd apps/edge-agent
cp .env.example .env
vi .env
```

```env
KAFKA_BROKERS=<도메인>:9094
EC2_API_BASE=https://<도메인>
EDGE_API_KEY=<발급받은 API 키>
DEVICE_ID=pi-01
USER_ID=1
MOCK_SENSOR=true
MOCK_FITBIT=true
```

### 실행

```bash
npm start
```

Mock 센서 모드에서 사용 가능한 명령어:

| 명령어 | 설명 | 예시 |
|---|---|---|
| `wbgt <값>` | WBGT 직접 설정 | `wbgt 28.5` |
| `temp <값>` | 기온 변경 (WBGT 자동 재계산) | `temp 35` |
| `hum <값>` | 습도 변경 | `hum 90` |
| `bg <값>` | 흑구온도 변경 | `bg 40` |
| `hr <값>` | 심박수 변경 | `hr 180` |

---

## 4. Vercel 배포

1. GitHub에 레포 push
2. https://vercel.com/new 에서 레포 연결
3. **Root Directory**: `apps/dashboard-next`
4. **Environment Variables**:
   - `NEXT_PUBLIC_API_BASE` = `https://<도메인>`
5. Deploy

---

## 5. 시드 데이터

서버 시작 시 자동 생성:

| 사용자 | 비밀번호 | 나이 |
|---|---|---|
| `demo` | `demo` | 30 |
| `senior` | `senior` | 68 |

Edge 디바이스: `pi-01` (`.env`의 `SEED_EDGE_API_KEY`로 등록)

---

## 6. 시연 시나리오

### 준비

1. EC2: `docker compose up -d` (모든 서비스 기동)
2. Pi: `npm start` (센서/HR 폴링 시작)
3. Vercel 배포 완료

### 시연 흐름

1. 브라우저에서 대시보드 접속 → `demo / demo` 로그인
2. **Fitbit 연동** 버튼 클릭 → Fitbit 동의 → 대시보드 복귀
3. 대시보드에서 수면점수/WBGT/심박 카드 확인
4. **운동 시작** 버튼 → 실시간 게이지 활성화
5. Pi SSH에서 **시연 트리거**:
   ```
   wbgt 28.5
   ```
6. 5초 내 대시보드 게이지가 빨갛게 변경 → **CRITICAL** 알림
7. **운동 종료** → 히스토리에서 세션 상세 + 알림 타임라인 확인

---

## 7. Risk Engine 로직

| 요소 | 조건 | 점수 |
|---|---|---|
| 수면점수 | < 60 | +30 |
| 수면점수 | < 75 | +15 |
| WBGT | >= 28 | +40 |
| WBGT | >= 25 | +20 |
| 심박수 | > 최대심박 90% | +30 |
| 심박수 | > 최대심박 80% | +15 |

- 최대심박 = 220 - 나이
- **합계 >= 70**: STOP (운동 즉시 중단)
- **합계 >= 40**: CAUTION (강도 낮추기)
- **합계 < 40**: OK (운동 진행 가능)

---

## 8. API 명세

Swagger UI: `https://<도메인>/api-docs`

주요 엔드포인트:

| 메서드 | 경로 | 설명 | 인증 |
|---|---|---|---|
| POST | `/auth/register` | 회원가입 | - |
| POST | `/auth/login` | 로그인 (JWT 반환) | - |
| GET | `/auth/fitbit/start` | Fitbit OAuth 시작 | JWT |
| GET | `/auth/fitbit/callback` | Fitbit OAuth 콜백 | - |
| POST | `/api/sessions` | 운동 세션 시작 | JWT |
| POST | `/api/sessions/:id/end` | 세션 종료 | JWT |
| GET | `/api/sessions/:id/stream` | SSE 실시간 스트림 | JWT (query) |
| GET | `/api/health/risk` | 즉석 위험도 평가 | JWT |
| GET | `/api/fitbit/snapshot` | 오늘 수면/HRV 스냅샷 | JWT |
| POST | `/api/edge/register` | Edge 디바이스 등록 | - |
| GET | `/api/edge/fitbit-token/:userId` | Fitbit 토큰 조회 | API Key |
| GET | `/metrics` | Prometheus 메트릭 | - |

---

## 9. Kafka 토픽

| 토픽 | Producer | Consumer | 페이로드 |
|---|---|---|---|
| `sensors.wbgt` | Pi | API | `{device_id, temperature, humidity, black_globe, wbgt, ts}` |
| `fitbit.heartrate` | Pi | API | `{user_id, hr, ts, source}` |
| `alerts.risk` | API | (확장용) | `{session_id, user_id, level, risk_score, message, ts}` |

---

## 10. 트러블슈팅

### Caddy 인증서 발급 실패
- EC2 보안 그룹에서 80, 443 포트 열려있는지 확인
- DuckDNS 도메인이 EC2 퍼블릭 IP를 가리키는지 확인: `nslookup <도메인>`

### Kafka 연결 실패 (Pi → EC2)
- EC2 보안 그룹에서 9094 포트 열려있는지 확인
- `EC2_PUBLIC_HOST`가 올바른 퍼블릭 IP인지 확인
- `docker compose logs kafka`로 advertised listener 확인

### Fitbit OAuth 오류
- Callback URL이 정확히 `https://<도메인>/auth/fitbit/callback`인지 확인
- Client ID/Secret이 `.env`에 올바르게 입력되었는지 확인
- HTTPS가 정상 동작하는지 확인 (Fitbit은 HTTPS 필수)

### MySQL 연결 실패
- `docker compose logs mysql`로 초기화 완료 확인
- api-server가 MySQL보다 먼저 시작하면 최대 30초 대기 후 재시도

---

## 비용

| 서비스 | 비용 |
|---|---|
| EC2 t3.medium (서울) | ~$0.0416/시간 |
| DuckDNS | 무료 |
| Let's Encrypt | 무료 |
| Vercel (Hobby) | 무료 |

> 시연 종료 후 EC2 인스턴스를 **Stop** 하여 불필요한 과금을 방지하세요.
