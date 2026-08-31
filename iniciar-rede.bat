@echo off
chcp 65001 >nul
title Capricche - Manutencao Eletrica (modo fabrica)
cd /d "%~dp0"

echo.
echo  ========================================================
echo   Capricche - Manutencao Eletrica
echo   Modo fabrica: um servidor so, acessivel pela rede
echo  ========================================================
echo.

if not exist "node_modules" (
  echo  Instalando dependencias, aguarde...
  call npm install
  call npm approve-scripts esbuild
  echo.
)

if not exist "backend\.env" (
  copy "backend\.env.example" "backend\.env" >nul
)

echo  Compilando o site... (demora ~20 segundos na primeira vez)
call npm run build
if errorlevel 1 (
  echo.
  echo  ERRO ao compilar o site. Confira as mensagens acima.
  pause
  exit /b 1
)

echo.
echo  Endereco para acessar deste computador:
echo     http://localhost:3333
echo.
echo  Enderecos para acessar dos outros computadores e celulares
echo  que estiverem na MESMA rede:
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr /c:"IPv4"') do (
  for /f "tokens=1" %%j in ("%%i") do echo     http://%%j:3333
)
echo.
echo  Na primeira vez o Windows pode perguntar se libera o Node
echo  na rede: marque "Redes privadas" e clique em Permitir acesso.
echo.
echo  Deixe esta janela aberta enquanto estiver usando.
echo  Para encerrar, feche a janela ou aperte Ctrl+C.
echo  ========================================================
echo.

call npm run dev:api
pause
