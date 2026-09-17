@echo off
setlocal
title +55 Design - aplicacao (local)
cd /d "%~dp0"

echo.
echo  +55 Design - aplicacao local
echo  ---------------------------------------------
echo  Endereco: http://localhost:5055
echo  Usuario.: admin
echo.
echo  No PRIMEIRO acesso a senha provisoria aparece
echo  aqui embaixo, em "senha provisoria". Anote:
echo  ela so e mostrada uma vez e a troca e obrigatoria.
echo.
echo  Para encerrar: feche esta janela ou Ctrl+C.
echo  ---------------------------------------------
echo.

start "" http://localhost:5055
"C:\Scripts\WPy64-31700\python\python.exe" wsgi.py

echo.
echo  O servidor parou.
pause
