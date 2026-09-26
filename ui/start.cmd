@echo off
cd /d "%~dp0"
if not exist node_modules\vite\bin\vite.js (
  echo Dang cai thu vien cho StarCi Status...
  call npm install
  if errorlevel 1 exit /b 1
)
start "" http://127.0.0.1:4545/
call npm run dev
