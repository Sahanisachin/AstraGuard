from waitress import serve
from app import app
import os

if __name__ == '__main__':
    # Ensure build exists
    dist_path = os.path.join('static', 'dist')
    if not os.path.exists(dist_path):
        print("[!] Warning: static/dist not found. Did you run 'npm run build'?")
    
    print("==========================================")
    print("PassCrack Production Server Starting...")
    print("==========================================")
    print("Local Access: http://localhost:5000")
    print("Network Access: http://10.106.118.100:5000")
    print("==========================================")
    
    # Serve using waitress
    serve(app, host='0.0.0.0', port=5000, threads=12)
