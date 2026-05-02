#!/usr/bin/env python3
"""
EVS Authentication helper for CI/CD environments.
Reads credentials from environment variables and creates config file.
"""

import os
import json
import sys
from pathlib import Path

def authenticate():
    username = os.environ.get('EVS_USERNAME')
    password = os.environ.get('EVS_PASSWORD')
    
    if not username or not password:
        print("Error: EVS_USERNAME and EVS_PASSWORD environment variables must be set")
        sys.exit(1)
    
    # Config file location
    config_dir = Path.home() / '.config' / 'evs'
    config_file = config_dir / 'config.json'
    
    # Create directory if needed
    config_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Authenticating EVS account: {username}")
    
    try:
        # Import EVS modules
        from castlabs_evs.auth import Auth
        
        # Create auth object with no_ask=True
        auth = Auth(no_ask=True)
        
        # Force refresh with credentials (this will authenticate and store tokens)
        auth._refresh_auth(username, password)
        
        print("EVS authentication successful!")
        if auth._auth_access_token:
            print(f"Access token acquired: {auth._auth_access_token[:20]}...")
        return True
        
    except Exception as e:
        print(f"EVS authentication failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    authenticate()
