#!/bin/bash
# Start script for Paperwise backend

# Navigate to the correct directory
cd "$(dirname "$0")"

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Run the FastAPI server
python run.py
