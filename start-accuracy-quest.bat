@echo off
cd /d "%~dp0"
start python accuracy-quest-backend.py
start http://localhost:8080