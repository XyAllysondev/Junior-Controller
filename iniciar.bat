@echo off
chcp 65001 >nul
title Capricche - Manutencao Eletrica
cd /d "%~dp0"

echo.
echo  Iniciando o Controle de Manutencao...
echo.

if not exist "node_modules" (
  echo  Instalando dependencias, aguarde...
  call npm install
  call npm approve-scripts esbuild
)

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo  Arquivo backend\.env criado.
)

start "API - Manutencao" cmd /k "cd /d "%~dp0" && npm run dev:api"
start "Site - Manutencao" cmd /k "cd /d "%~dp0" && npm run dev:web"

echo.
echo  API ....  http://localhost:3333
echo  Site ...  http://localhost:5173
echo.
echo  Aguarde alguns segundos e abra o site no navegador.
echo  Para encerrar, feche as duas janelas que abriram.
echo.
pause
