# 📂 OmniData AI Explorer

AI 기반의 동적 데이터 관리 및 폴더형 탐색기 도구입니다. Gemini AI를 사용하여 수식을 생성하고, 날짜 기반 필터링 및 버튼 로직을 구현할 수 있습니다.

## 🚀 GitHub Pages 배포 방법

이 코드를 본인의 GitHub 저장소에 올려서 웹사이트로 만드는 방법입니다.

### 1. GitHub 저장소 생성
1. GitHub에서 새로운 저장소(Repository)를 만듭니다.
2. 본 프로젝트의 파일들을 해당 저장소에 업로드(Push)합니다.

### 2. API Key 설정 (매우 중요)
보안을 위해 API Key는 코드에 직접 넣지 않고 GitHub Secrets를 사용합니다.
1. 저장소의 **Settings** > **Secrets and variables** > **Actions**로 이동합니다.
2. **New repository secret** 버튼을 누릅니다.
3. Name에 `API_KEY`를 입력합니다.
4. Value에 본인의 [Google AI Studio](https://aistudio.google.com/app/apikey)에서 발급받은 키를 입력하고 저장합니다.

### 3. 자동 배포
1. 코드를 `main` 브랜치에 Push하면 `.github/workflows/deploy.yml`이 자동으로 실행됩니다.
2. **Actions** 탭에서 배포 과정을 확인할 수 있습니다.
3. 배포가 완료되면 저장소의 **Settings** > **Pages** 탭에서 생성된 웹사이트 주소를 확인할 수 있습니다.

## ✨ 주요 기능
- **계층형 폴더 구조**: 폴더 안에 폴더를 무한히 생성하여 데이터를 정리할 수 있습니다.
- **AI 수식 & 버튼**: 자연어로 요청하면 AI가 JavaScript 로직을 짜줍니다.
- **날짜 전용 헬퍼**: `diffDays`, `isToday`, `addDays` 등의 함수를 AI 로직에서 바로 사용 가능합니다.
- **강력한 필터링**: 수식 결과값에 대해서도 '최근 N일 이내', '날짜 일치' 등의 필터를 걸 수 있습니다.
- **실시간 타이머**: 작업 시간을 측정할 수 있는 전용 타이머 셀을 제공합니다.
