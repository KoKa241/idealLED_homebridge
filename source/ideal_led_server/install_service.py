import os
import sys
import subprocess
import venv
import getpass
from pathlib import Path

def create_venv_and_install():
    print("Creating virtual environment...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(base_dir, "venv")
    
    if not os.path.exists(venv_dir):
        venv.create(venv_dir, with_pip=True)
    
    pip_exe = os.path.join(venv_dir, "Scripts", "pip.exe") if sys.platform == "win32" else os.path.join(venv_dir, "bin", "pip")
    
    print("Installing requirements...")
    req_file = os.path.join(base_dir, "requirements.txt")
    subprocess.check_call([pip_exe, "install", "-r", req_file])
    
    return venv_dir

def setup_linux_service(venv_dir):
    print("Setting up systemd service for Linux...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    python_exe = os.path.join(venv_dir, "bin", "python")
    script_path = os.path.join(base_dir, "server.py")
    
    service_content = f"""[Unit]
Description=iDeal LED HTTP Server
After=network.target

[Service]
ExecStart={python_exe} {script_path}
WorkingDirectory={base_dir}
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
"""
    
    systemd_dir = os.path.expanduser("~/.config/systemd/user")
    os.makedirs(systemd_dir, exist_ok=True)
    
    service_path = os.path.join(systemd_dir, "idealled-server.service")
    with open(service_path, "w") as f:
        f.write(service_content)
        
    print(f"Service file created at {service_path}")
    
    try:
        subprocess.check_call(["systemctl", "--user", "daemon-reload"])
        subprocess.check_call(["systemctl", "--user", "enable", "idealled-server.service"])
        subprocess.check_call(["systemctl", "--user", "start", "idealled-server.service"])
        subprocess.check_call(["loginctl", "enable-linger", getpass.getuser()])
        print("Service enabled and started successfully.")
    except Exception as e:
        print(f"Failed to start service. Error: {e}")
        print("You may need to start it manually: systemctl --user start idealled-server.service")

def setup_windows_service():
    """Delegate to the real Windows service installer (run as Administrator)."""
    script = Path(__file__).with_name("install_windows.ps1")
    subprocess.check_call(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script)])

if __name__ == "__main__":
    print("Starting iDeal LED Server Setup...")
    if sys.platform == "win32":
        setup_windows_service()
    elif sys.platform == "linux" or sys.platform == "linux2":
        setup_linux_service(create_venv_and_install())
    else:
        print(f"Unsupported platform: {sys.platform}. Please run the server manually.")
