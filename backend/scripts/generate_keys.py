#!/usr/bin/env python3
"""
Generate secure secret keys for Askify configuration.
Run this script to generate random secure keys for your .env file.
"""

import secrets
import base64
import argparse

def generate_secret_key(length=32):
    """Generate a secure random hex string of specified length."""
    return secrets.token_hex(length)

def generate_jwt_secret(length=32):
    """Generate a secure random base64 string for JWT."""
    return base64.b64encode(secrets.token_bytes(length)).decode('utf-8')

def main():
    parser = argparse.ArgumentParser(description='Generate secure keys for Askify')
    parser.add_argument('--type', choices=['hex', 'jwt'], default='hex',
                      help='Type of key to generate (hex or jwt)')
    parser.add_argument('--length', type=int, default=32,
                      help='Length of the key in bytes')
    
    args = parser.parse_args()
    
    print("\n=== Askify Security Key Generator ===\n")
    
    if args.type == 'hex':
        key = generate_secret_key(args.length)
        print(f"Secret Key (hex, {args.length*2} characters):")
        print(f"\n{key}\n")
        print("Use this for SECRET_KEY in your .env file")
    else:
        key = generate_jwt_secret(args.length)
        print(f"JWT Secret (base64, ~{args.length*1.3:.0f} characters):")
        print(f"\n{key}\n")
        print("Use this for JWT_SECRET_KEY in your .env file")
    
    print("\nRemember: Never share these keys or commit them to version control!")
    print("===========================================\n")

if __name__ == "__main__":
    main()
