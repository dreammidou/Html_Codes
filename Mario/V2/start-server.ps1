# Start a static server in this folder
$port = 8000
Write-Host "Starting python http.server on port $port (CTRL-C to stop)"
python -m http.server $port