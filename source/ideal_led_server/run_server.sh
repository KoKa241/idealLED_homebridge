#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"
if [ ! -f "venv/bin/python" ]; then
    echo "Virtual environment not found. Please run install_service.py first."
    exit 1
fi
echo "Starting iDeal LED Server..."
./venv/bin/python server.py "$@"
