@echo off
cd /d "C:\Users\batpo\OneDrive\Documents\ScaryMovieSite"
python -m http.server 5500 --bind 0.0.0.0
pause
