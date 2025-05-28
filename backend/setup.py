# Setup.py for the Paperwise backend

import os
import subprocess
import sys
from dotenv import load_dotenv

def check_python_version():
    """Check if Python version is compatible."""
    if sys.version_info < (3, 7):
        print("Error: Python 3.7 or higher is required.")
        sys.exit(1)

def create_env_file():
    """Create .env file if it doesn't exist."""
    if os.path.exists(".env"):
        print("INFO: .env file already exists.")
        return
    
    if os.path.exists(".env.sample"):
        print("Creating .env file from template...")
        with open(".env.sample", "r") as sample:
            with open(".env", "w") as env:
                env.write(sample.read())
        print("Created .env file. Please update it with your credentials.")
    else:
        print("ERROR: Could not find .env.sample template.")

def install_requirements():
    """Install required Python packages."""
    try:
        print("Installing requirements...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
        print("Requirements installed successfully!")
    except subprocess.CalledProcessError:
        print("ERROR: Failed to install requirements.")
        sys.exit(1)

def check_config():
    """Check if configuration is valid."""
    load_dotenv()
    
    required_vars = [
        "SECRET_KEY",
        "OPENAI_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_KEY"
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print("WARNING: The following environment variables are not set:")
        for var in missing_vars:
            print(f"  - {var}")
        print("Please update your .env file with the required values.")

def main():
    """Run the setup process."""
    print("Setting up Paperwise backend...")
    
    check_python_version()
    create_env_file()
    install_requirements()
    check_config()
    
    print("\nSetup completed!")
    print("\nTo start the server, run:")
    print("python run.py")

if __name__ == "__main__":
    main()
