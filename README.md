# FCA---web — GitHub Pages 배포 저장소

이 저장소는 빌드된 정적 파일만 담는 **공개(Public) 배포 전용** 저장소입니다.
소스 코드는 private 저장소 `story0316/Functional-Competency`에서 관리됩니다.

## 동작 방식

1. `Functional-Competency` (private) 저장소의 `main` 브랜치에 push
2. GitHub Actions가 자동으로 `npm run build` 실행
3. 빌드 결과물(`dist/`)을 이 저장소의 `gh-pages` 브랜치에 자동 push
4. GitHub Pages가 `gh-pages` 브랜치를 서빙

🌐 **사이트 주소**: https://story0316.github.io/FCA---web/

> ⚠️ 이 저장소에 직접 파일을 수정하지 마세요. 모든 변경은 private 소스 저장소에서 이루어집니다.
