# GitHub Pages 배포 세팅 가이드

## 구조

```
story0316/Functional-Competency  (Private - 소스 코드)
         │
         │  GitHub Actions (자동 빌드 + 배포)
         ▼
story0316/FCA---web              (Public - 빌드 결과물)
         │
         │  GitHub Pages
         ▼
https://story0316.github.io/FCA---web/
```

---

## 1단계 — Personal Access Token (PAT) 발급

1. GitHub 우측 상단 프로필 → **Settings**
2. 좌측 하단 **Developer settings** → **Personal access tokens** → **Tokens (classic)**
3. **Generate new token (classic)** 클릭
4. Note: `FCA-deploy-token` (아무 이름)
5. Expiration: 원하는 기간 (또는 No expiration)
6. 스코프(Scope): ✅ **repo** 전체 체크
7. **Generate token** → 토큰 복사 (다시 볼 수 없으니 반드시 복사!)

---

## 2단계 — Private 저장소에 Secret 등록

1. `Functional-Competency` 저장소 → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** 클릭
3. Name: `DEPLOY_TOKEN`
4. Secret: (1단계에서 복사한 토큰 붙여넣기)
5. **Add secret** 클릭

---

## 3단계 — Private 저장소에 GitHub Actions 워크플로우 추가

`Functional-Competency` 저장소에 아래 경로로 파일 생성:
```
.github/workflows/deploy.yml
```

내용은 이 가이드와 함께 있는 `deploy-workflow.yml` 파일을 복사하세요.

---

## 4단계 — Vite 설정에 base 경로 추가

`Functional-Competency/vite.config.ts` 를 열고 `base` 옵션 추가:

```ts
export default defineConfig({
  plugins: [react()],
  base: '/FCA---web/',  // ← 추가
})
```

> Create React App 프로젝트라면 `vite.config.ts` 대신
> `package.json`에 `"homepage": "https://story0316.github.io/FCA---web/"` 추가

---

## 5단계 — FCA---web 저장소 GitHub Pages 활성화

1. `FCA---web` 저장소 → **Settings** → **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `gh-pages` / `/ (root)` 선택
4. **Save**

> 첫 배포 전까지는 `gh-pages` 브랜치가 없어서 선택이 안 될 수 있습니다.
> 6단계 배포 후에 다시 설정하세요.

---

## 6단계 — 첫 배포 실행

```bash
# Functional-Competency 저장소에서
git add .
git commit -m "chore: add GitHub Actions deploy workflow"
git push origin main
```

push 후 `Functional-Competency` 저장소 → **Actions** 탭에서 워크플로우 실행 확인.
성공하면 `FCA---web` 저장소에 `gh-pages` 브랜치가 자동 생성됩니다.

---

## 완료 후 접속 주소

https://story0316.github.io/FCA---web/

(첫 배포 후 GitHub Pages 활성화까지 1~2분 소요될 수 있습니다.)
