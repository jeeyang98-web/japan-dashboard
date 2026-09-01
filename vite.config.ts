import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// GitHub Pages project 사이트는 /<repo-name>/ 경로에서 서빙되므로,
// 빌드할 때만 base를 붙이고 로컬 개발 서버(dev)는 그대로 "/"를 씁니다.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/japan-dashboard/' : '/',
}));
