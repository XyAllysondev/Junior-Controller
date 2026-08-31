@echo off
chcp 65001 >nul
title Controle de Manutencao
cd /d "%~dp0"

echo.
echo  Iniciando o Controle de Manutencao...
echo.

if not exist "backend\node_modules" (
  echo  Instalando dependencias do backend, aguarde...
  pushd backend
  call npm install
  call npm approve-scripts better-sqlite3 esbuild
  popd
)

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
  echo  Arquivo backend\.env criado.
)

if not exist "frontend\node_modules" (
  echo  Instalando dependencias do frontend, aguarde...
  pushd frontend
  call npm install
  call npm approve-scripts esbuild
  popd
)

start "API - Manutencao" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "Site - Manutencao" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  API ....  http://localhost:3333
echo  Site ...  http://localhost:5173
echo.
echo  Aguarde alguns segundos e abra o site no navegador.
echo  Para encerrar, feche as duas janelas que abriram.
echo.
pause
