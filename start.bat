@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules (
  echo Первый запуск: устанавливаю пакеты, подожди пару минут...
  call npm install
)
echo Запускаю Wortwechsel. Браузер откроется сам.
call npx vite --open
pause
