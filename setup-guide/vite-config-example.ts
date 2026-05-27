// Functional-Competency 저장소의 vite.config.ts 에
// base 경로를 추가해야 합니다.
//
// GitHub Pages URL: https://story0316.github.io/FCA---web/
// → base를 '/FCA---web/' 로 설정

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/FCA---web/',   // ← 이 줄을 추가하세요
})
