@echo off
cd /d "%~dp0"
set PORT=8792
start "" "http://127.0.0.1:%PORT%/"
node server.mjs
