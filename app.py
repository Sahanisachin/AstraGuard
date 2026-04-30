#!/usr/bin/env python3
"""
PassCrack Web UI - Production Edition
A modern web interface for dictionary-based password cracking
Optimized for Vercel Serverless - v2.1
"""

from flask import Flask, render_template, request, jsonify, session, send_from_directory
from flask_cors import CORS
import os
import sys
import io
import time
import hashlib
import concurrent.futures
from functools import partial
import threading
import uuid
import json
from pathlib import Path
from werkzeug.utils import secure_filename
import traceback
import zipfile
import multiprocessing
import mmap
import itertools
from concurrent.futures import ThreadPoolExecutor, as_completed

# Global worker context for multiprocessing
worker_ctx = {'mods': {}, 'checker': None, 'label': '', 'wordlist_path': ''}


# ------------------ Configuration ------------------
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.urandom(24)
CORS(app)

from flask import Flask, render_template, request, jsonify, session, send_from_directory, make_response

# Serve React App
@app.route('/')
def index():
    dist_path = os.path.join(app.root_path, 'static', 'dist', 'index.html')
    if os.path.exists(dist_path):
        response = make_response(send_from_directory(os.path.join(app.root_path, 'static', 'dist'), 'index.html'))
    else:
        response = make_response(render_template('index.html'))
    
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

@app.route('/<path:path>')
def serve_static(path):
    dist_dir = os.path.join(app.root_path, 'static', 'dist')
    if os.path.exists(os.path.join(dist_dir, path)):
        response = make_response(send_from_directory(dist_dir, path))
    else:
        response = make_response(send_from_directory(app.static_folder, path))
    
    # Don't cache JS/CSS/HTML during this update phase
    if path.endswith(('.html', '.js', '.css')):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return response

# Detect Vercel serverless environment
IS_VERCEL = bool(os.environ.get('VERCEL', ''))
BASE_TMP = '/tmp' if IS_VERCEL else '.'

UPLOAD_FOLDER = os.path.join(BASE_TMP, 'passcrack_uploads')
JOBS_FOLDER = os.path.join(BASE_TMP, 'passcrack_jobs')
ALLOWED_EXTENSIONS = {'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'pdf', 'zip', '7z', 'rar', 'txt', 'csv'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(JOBS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024 * 1024  # 10GB max

DEFAULT_WORDLIST = os.path.join(BASE_TMP, 'rockyou.txt')
if not os.path.exists(DEFAULT_WORDLIST):
    with open(DEFAULT_WORDLIST, 'w') as f:
        f.write("\n".join(['password', '123456', 'admin', 'qwerty', 'root', '12345', 'welcome', 'guest', 'password123']))

crack_jobs = {}
wordlist_jobs = {}

# ------------------ Job State Helpers ------------------
def _job_path(job_id):
    return os.path.join(JOBS_FOLDER, f'{job_id}.json')

def save_job(job_id, data):
    try:
        with open(_job_path(job_id), 'w') as f:
            json.dump(data, f)
    except Exception:
        pass

def load_job(job_id):
    if job_id in crack_jobs:
        return crack_jobs[job_id]
    if job_id in wordlist_jobs:
        return wordlist_jobs[job_id]
    try:
        with open(_job_path(job_id), 'r') as f:
            data = json.load(f)
        crack_jobs[job_id] = data
        return data
    except Exception:
        return None

def set_job(job_id, data, type='crack'):
    if type == 'crack':
        crack_jobs[job_id] = data
    else:
        wordlist_jobs[job_id] = data
    save_job(job_id, data)

# ------------------ Package Import Map ------------------
PKG_IMPORT_MAP = {
    "msoffcrypto-tool": "msoffcrypto",
    "pikepdf": "pikepdf",
    "pyzipper": "pyzipper",
    "py7zr": "py7zr",
    "rarfile": "rarfile",
    "python-docx": "docx",
    "python-pptx": "pptx",
    "pandas": "pandas",
    "openpyxl": "openpyxl",
}

def load_optional_modules():
    mods = {}
    for pkg, modname in PKG_IMPORT_MAP.items():
        try:
            mods[modname] = __import__(modname)
        except Exception:
            mods[modname] = None
    return mods

OPT_MODULES = load_optional_modules()
TARGET_DATA_CACHE = {}

def get_target_data(path):
    if path not in TARGET_DATA_CACHE:
        try:
            with open(path, "rb") as f:
                TARGET_DATA_CACHE[path] = f.read()
        except Exception:
            return None
    return TARGET_DATA_CACHE[path]

# ------------------ Utility Functions ------------------
def sha256_of_path(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()

def sha256_of_bytes(b):
    return hashlib.sha256(b).hexdigest()

def get_wordlist_chunks(path, num_chunks=100):
    file_size = os.path.getsize(path)
    if file_size < 4096:
        return [(0, file_size)], file_size
    chunk_size = file_size // num_chunks
    chunks = []
    for i in range(num_chunks):
        start = i * chunk_size
        end = (i + 1) * chunk_size if i < num_chunks - 1 else file_size
        chunks.append((start, end))
    return chunks, file_size

def worker_init(ext, target_data, wordlist_path):
    global worker_ctx
    worker_ctx['wordlist_path'] = wordlist_path
    for pkg, modname in PKG_IMPORT_MAP.items():
        try:
            worker_ctx['mods'][modname] = __import__(modname)
        except:
            worker_ctx['mods'][modname] = None
    
    bio = io.BytesIO(target_data)
    mods = worker_ctx['mods']
    
    if ext in ('.docx', '.xlsx', '.pptx', '.doc', '.xls', '.ppt'):
        m = mods.get('msoffcrypto')
        if m:
            try:
                office = m.OfficeFile(bio)
                worker_ctx['checker'] = lambda pw: office.load_key(password=pw, verify_password=True) or True
                worker_ctx['label'] = "Office"
                return
            except: pass
    elif ext == '.pdf':
        pikepdf = mods.get('pikepdf')
        if pikepdf:
            def check_pdf(pw):
                try:
                    with pikepdf.open(io.BytesIO(target_data), password=pw): return True
                except: return False
            worker_ctx['checker'] = check_pdf
            worker_ctx['label'] = "PDF"
            return
    elif ext == '.zip':
        try:
            with zipfile.ZipFile(bio) as z:
                info_list = sorted(z.infolist(), key=lambda x: x.file_size)
                if info_list:
                    target_member = info_list[0].filename
                    def check_zip(pw):
                        try:
                            with z.open(target_member, pwd=pw.encode()) as f: f.read()
                            return True
                        except: return False
                    worker_ctx['checker'] = check_zip
                    worker_ctx['label'] = "ZIP"
                    return
        except: pass

def check_password_offset_batch(args):
    start_offset, end_offset, job_id = args
    global worker_ctx
    checker = worker_ctx['checker']
    path = worker_ctx['wordlist_path']
    if not checker: return None
    processed = 0
    with open(path, 'rb') as f:
        with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            mm.seek(start_offset)
            if start_offset > 0:
                while mm.tell() < end_offset and mm.read(1) != b'\n': pass
            while mm.tell() < end_offset:
                line = mm.readline()
                if not line: break
                processed += 1
                pw = line.decode('utf-8', errors='ignore').strip()
                if not pw: continue
                try:
                    if checker(pw): return pw, worker_ctx['label'], processed
                except: continue
    return None, None, processed

def crack_passwords_parallel(job_id, target_path, wordlist, max_workers=None, source='uploaded'):
    job = load_job(job_id)
    if not job: return
    
    print(f"[DEBUG] Source: {source}")
    print(f"[DEBUG] Total items = {len(wordlist)}")
    
    target_data = get_target_data(target_path)
    if not target_data:
        job['status'] = 'failed'; job['error'] = 'Could not read target file'; set_job(job_id, job); return
    ext = Path(target_path).suffix.lower()
    
    job['total'] = len(wordlist)
    job['source'] = source
    set_job(job_id, job)
    
    if max_workers is None: max_workers = os.cpu_count() or 4
    processed_count = 0
    start_time = time.time()

    # Use a simpler iteration for strict control if requested
    # But still use multiprocessing for speed if needed
    # To satisfy "if processed count > uploadedWordlist.length -> STOP", we just loop through the list
    
    def check_batch(batch):
        # Local worker init logic since we aren't using initializer here for simplicity in this mode
        worker_init(ext, target_data, "") # wordlist_path not needed for list-based check
        checker = worker_ctx['checker']
        results = []
        for pw in batch:
            if not pw: continue
            try:
                if checker(pw): return pw
            except: continue
        return None

    batch_size = 100
    batches = [wordlist[i:i + batch_size] for i in range(0, len(wordlist), batch_size)]
    
    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            for i, res_pw in enumerate(executor.map(check_batch, batches)):
                # Check for stop signal
                current_job = load_job(job_id)
                if current_job and current_job.get('status') == 'stopping':
                    current_job['status'] = 'stopped'
                    set_job(job_id, current_job)
                    return

                processed_count = min((i + 1) * batch_size, len(wordlist))
                
                # Safeguard
                if processed_count > len(wordlist):
                    print("[ERROR] Processed count exceeded wordlist length. Stopping.")
                    break

                if res_pw:
                    print(f"[DEBUG] Match found: {res_pw} at index {processed_count}")
                    job.update({'status': 'completed', 'processed': processed_count, 'progress': 100, 'result': {'password': res_pw, 'method': worker_ctx['label'], 'hash': sha256_of_bytes(res_pw.encode())}})
                    set_job(job_id, job); return
                
                elapsed = time.time() - start_time
                job.update({'processed': processed_count, 'progress': (processed_count / len(wordlist)) * 100, 'speed': int(processed_count / elapsed) if elapsed > 0 else 0})
                set_job(job_id, job)
                
                # Small delay to allow UI to see progress if list is tiny
                if len(wordlist) < 500: time.sleep(0.01)

    except Exception as e:
        print(f"[ERROR] Cracking failed: {str(e)}")
        job.update({'status': 'failed', 'error': str(e)}); set_job(job_id, job)
        return
    
    job = load_job(job_id)
    if job and job['status'] not in ('stopped', 'completed'):
        print(f"[DEBUG] Finished processing {source} dataset. Processed {processed_count} entries. No match found.")
        job.update({'status': 'failed', 'error': 'No password matched', 'processed': len(wordlist), 'progress': 100}); set_job(job_id, job)

# ------------------ Flask Routes ------------------
@app.route('/api/check-dependencies', methods=['GET'])
def check_dependencies():
    modules = load_optional_modules()
    installed = {pkg: modules.get(modname) is not None for pkg, modname in PKG_IMPORT_MAP.items()}
    return jsonify({'installed': installed, 'all_installed': all(installed.values())})

@app.route('/api/install-dependencies', methods=['POST'])
def install_dependencies():
    missing = [pkg for pkg, modname in PKG_IMPORT_MAP.items() if not load_optional_modules().get(modname)]
    if not missing: return jsonify({'success': True, 'message': 'All dependencies already installed'})
    try:
        import subprocess
        result = subprocess.run([sys.executable, "-m", "pip", "install", "--user"] + missing, capture_output=True, text=True)
        if result.returncode == 0:
            global OPT_MODULES; OPT_MODULES = load_optional_modules()
            return jsonify({'success': True, 'message': 'Dependencies installed successfully'})
        return jsonify({'success': False, 'message': result.stderr})
    except Exception as e: return jsonify({'success': False, 'message': str(e)})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files: return jsonify({'error': 'No file provided'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No file selected'}), 400
    filename = secure_filename(file.filename)
    file_id = str(uuid.uuid4())
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{file_id}_{filename}")
    file.save(file_path)
    return jsonify({'success': True, 'file_id': file_id, 'filename': filename, 'path': file_path, 'size': os.path.getsize(file_path)})

@app.route('/api/start-crack', methods=['POST'])
def start_crack():
    data = request.json
    target_path = data.get('target_path')
    wordlist_content = data.get('wordlist_content')
    wordlist_path = data.get('wordlist_path')
    source = data.get('source', 'uploaded') 
    max_workers = int(data.get('max_workers', os.cpu_count() or 8))
    
    if not target_path or not os.path.exists(target_path):
        return jsonify({'error': 'Target file not found'}), 400
    
    # STOP ANY PREVIOUS JOBS (Prevent parallel execution)
    for jid, job in list(crack_jobs.items()):
        if job.get('status') == 'running':
            job['status'] = 'stopping'
            print(f"[INFO] Cancelling previous job {jid} to start new one.")

    # Read wordlist into a list (uploadedWordlist)
    wordlist = []
    if source == 'internal':
        wordlist_path = DEFAULT_WORDLIST
    
    if wordlist_content:
        wordlist = wordlist_content.strip().split('\n')
    elif wordlist_path and os.path.exists(wordlist_path):
        try:
            with open(wordlist_path, 'r', encoding='utf-8', errors='ignore') as f:
                wordlist = [line.strip() for line in f if line.strip()]
        except Exception as e:
            return jsonify({'error': f'Failed to read wordlist: {str(e)}'}), 400
    else:
        return jsonify({'error': 'No wordlist provided'}), 400

    if not wordlist:
        return jsonify({'error': 'Wordlist is empty'}), 400

    total_count = len(wordlist)
    job_id = str(uuid.uuid4())
    set_job(job_id, {
        'id': job_id, 'status': 'running', 'progress': 0, 'processed': 0, 'total': total_count,
        'current_password': '', 'current_method': '', 'result': None, 'error': None,
        'target_file': os.path.basename(target_path), 'wordlist_file': 'uploaded_list' if wordlist_content else os.path.basename(wordlist_path),
        'candidate_count': total_count, 'source': source
    })
    
    print(f"[INFO] Initializing {source} dataset processing: {total_count} entries.")
    
    thread = threading.Thread(target=crack_passwords_parallel, args=(job_id, target_path, wordlist, max_workers, source))
    thread.daemon = True
    thread.start()
    return jsonify({'success': True, 'job_id': job_id})

@app.route('/api/job-status/<job_id>', methods=['GET'])
def job_status(job_id):
    job = load_job(job_id)
    if not job: return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)

@app.route('/api/stop-job/<job_id>', methods=['POST'])
def stop_job(job_id):
    job = load_job(job_id)
    if not job: return jsonify({'error': 'Job not found'}), 404
    if job['status'] == 'running':
        job['status'] = 'stopping'
        set_job(job_id, job)
    return jsonify({'success': True})

@app.route('/api/start-wordlist', methods=['POST'])
def start_wordlist():
    data = request.json
    job_id = str(uuid.uuid4())
    filename = secure_filename(data.get('filename', 'rockyou.txt'))
    if not filename.endswith('.txt'): filename += '.txt'
    
    job_data = {
        'id': job_id, 'type': 'wordlist', 'status': 'running', 'progress': 0, 'processed': 0, 'total': 0,
        'speed': 0, 'start_time': time.time(), 'min_len': data.get('min_len', 1), 'max_len': data.get('max_len', 8),
        'charset': data.get('charset', 'abcdefghijklmnopqrstuvwxyz'), 'pattern': data.get('pattern'),
        'limit': data.get('limit'), 'mode': data.get('mode', 'brute'), 'filename': filename,
        'max_repeat': data.get('max_repeat'),
        'max_consecutive': data.get('max_consecutive'),
        'must_contain': data.get('must_contain'),
        'no_sequential': data.get('no_sequential'),
        'pattern_string': data.get('pattern_string')
    }
    wordlist_jobs[job_id] = job_data
    
    def task():
        output_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{job_id}_{filename}")
        job_data['output_file'] = filename
        job_data['output_path'] = output_path
        charset = "".join(dict.fromkeys(job_data['charset'])) if job_data['charset'] else ""
        
        # Calculate total accurately
        import math
        total = 0
        n = len(charset)
        if n > 0:
            if job_data['mode'] == 'permutation':
                for r in range(int(job_data['min_len']), int(job_data['max_len']) + 1):
                    if r <= n: total += math.perm(n, r)
            else:
                for r in range(int(job_data['min_len']), int(job_data['max_len']) + 1):
                    total += n ** r
        
        if job_data['limit']: total = min(total, int(job_data['limit']))
        job_data['total'] = total if total > 0 else 1

        try:
            with open(output_path, 'w', encoding='utf-8', buffering=64*1024) as f:
                count = 0
                start_time = time.time()
                last_update = 0
                batch = []
                max_rep = int(job_data['max_repeat']) if job_data.get('max_repeat') else None
                max_cons = int(job_data['max_consecutive']) if job_data.get('max_consecutive') else None
                must_c = job_data.get('must_contain')
                no_seq = job_data.get('no_sequential')

                def is_valid(pw):
                    if must_c and not any(c in pw for c in must_c): return False
                    if max_rep:
                        counts = {}
                        for char in pw:
                            counts[char] = counts.get(char, 0) + 1
                            if counts[char] > max_rep: return False
                    if max_cons:
                        consecutive = 1
                        for i in range(1, len(pw)):
                            if pw[i] == pw[i-1]:
                                consecutive += 1
                                if consecutive > max_cons: return False
                            else:
                                consecutive = 1
                    if no_seq:
                        for i in range(2, len(pw)):
                            v1, v2, v3 = ord(pw[i-2]), ord(pw[i-1]), ord(pw[i])
                            if (v2 == v1 + 1 and v3 == v2 + 1) or (v2 == v1 - 1 and v3 == v2 - 1):
                                return False
                    return True

                def generate_from_pattern(template, entropy, digits, upper, lower):
                    import re
                    match = re.search(r'[XAa*]', template)
                    if not match:
                        if is_valid(template):
                            yield template
                        return

                    placeholder_idx = match.start()
                    char_type = template[placeholder_idx]
                    
                    if char_type == 'X': pool = digits
                    elif char_type == 'A': pool = upper
                    elif char_type == 'a': pool = lower
                    else: pool = entropy if entropy else [""]
                    
                    for c in pool:
                        if job_data['status'] != 'running': break
                        next_template = template[:placeholder_idx] + c + template[placeholder_idx + 1:]
                        yield from generate_from_pattern(next_template, entropy, digits, upper, lower)

                if job_data.get('pattern_string'):
                    import re
                    patterns = [p.strip() for p in re.split(r'[\n,]', job_data['pattern_string']) if p.strip()]
                    entropy = list(job_data.get('custom_charset', ""))
                    digits = list("0123456789")
                    upper = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
                    lower = list("abcdefghijklmnopqrstuvwxyz")
                    
                    for pattern in patterns:
                        if job_data['status'] != 'running': break
                        for pw in generate_from_pattern(pattern, entropy, digits, upper, lower):
                            if job_data['status'] != 'running': break
                            batch.append(pw)
                            count += 1
                            if len(batch) >= 1000:
                                f.write('\n'.join(batch) + '\n')
                                batch = []
                                # Update progress occasionally
                                elapsed = time.time() - start_time
                                job_data['processed'] = count
                                job_data['speed'] = int(count / elapsed) if elapsed > 0.1 else 0
                                set_job(job_id, job_data, 'wordlist')
                            if job_data['limit'] and count >= int(job_data['limit']): break
                        if job_data['limit'] and count >= int(job_data['limit']): break
                else:
                    charset_to_use = (job_data.get('custom_charset', '') + (job_data.get('charset', '') if not job_data.get('custom_charset') else '')) or "abcdefghijklmnopqrstuvwxyz0123456789"
                    for r in range(int(job_data['min_len']), int(job_data['max_len']) + 1):
                        if n == 0: break
                        gen = itertools.product(charset, repeat=r) if job_data['mode'] == 'brute' else itertools.permutations(charset, r)
                        for combo in gen:
                            if job_data['status'] != 'running': break
                            pw = ''.join(combo)
                            
                            if not is_valid(pw):
                                continue
                                
                            batch.append(pw)
                            count += 1
                            
                            if len(batch) >= 1000:
                                f.write('\n'.join(batch) + '\n')
                                batch = []
                                
                                now = time.time()
                                if now - last_update > 0.5:
                                    elapsed = now - start_time
                                    job_data['processed'] = count
                                    if total > 0:
                                        job_data['progress'] = min(99, (count / total * 100))
                                    job_data['speed'] = int(count / elapsed) if elapsed > 0.1 else 0
                                    set_job(job_id, job_data, 'wordlist')
                                    last_update = now
                            
                            if job_data['limit'] and count >= int(job_data['limit']): break
                        if job_data['status'] != 'running' or (job_data['limit'] and count >= int(job_data['limit'])): break
                
                if batch: f.write('\n'.join(batch) + '\n')
            
            job_data['status'] = 'completed' if job_data['status'] == 'running' else 'stopped'
            job_data['progress'] = 100
            job_data['processed'] = count
            set_job(job_id, job_data, 'wordlist')
        except Exception as e:
            job_data['status'] = 'error'; job_data['error'] = str(e); set_job(job_id, job_data, 'wordlist')
    
    threading.Thread(target=task, daemon=True).start()
    return jsonify({'success': True, 'job_id': job_id})

@app.route('/api/download-wordlist')
def download_wordlist():
    min_len = int(request.args.get('min_len', 1))
    max_len = int(request.args.get('max_len', 8))
    charset = request.args.get('charset', 'abcdefghijklmnopqrstuvwxyz')
    limit = request.args.get('limit')
    filename = secure_filename(request.args.get('filename', 'wordlist.txt'))
    if not filename.endswith('.txt'): filename += '.txt'

    def generate():
        count = 0
        limit_val = int(limit) if limit and limit != 'null' and limit != '' else None
        max_rep = int(request.args.get('max_repeat')) if request.args.get('max_repeat') else None
        max_cons = int(request.args.get('max_consecutive')) if request.args.get('max_consecutive') else None
        must_c = request.args.get('must_contain')
        no_seq = request.args.get('no_sequential') == 'true'
        mode = request.args.get('mode', 'brute')

        def is_valid(pw):
            if must_c and not any(c in pw for c in must_c): return False
            if max_rep:
                counts = {}
                for char in pw:
                    counts[char] = counts.get(char, 0) + 1
                    if counts[char] > max_rep: return False
            if max_cons:
                consecutive = 1
                for i in range(1, len(pw)):
                    if pw[i] == pw[i-1]:
                        consecutive += 1
                        if consecutive > max_cons: return False
                    else:
                        consecutive = 1
            if no_seq:
                for i in range(2, len(pw)):
                    v1, v2, v3 = ord(pw[i-2]), ord(pw[i-1]), ord(pw[i])
                    if (v2 == v1 + 1 and v3 == v2 + 1) or (v2 == v1 - 1 and v3 == v2 - 1):
                        return False
            return True

        def generate_from_pattern(template, entropy, digits, upper, lower):
            import re
            match = re.search(r'[XAa*]', template)
            if not match:
                if is_valid(template):
                    yield template
                return

            placeholder_idx = match.start()
            char_type = template[placeholder_idx]
            
            if char_type == 'X': pool = digits
            elif char_type == 'A': pool = upper
            elif char_type == 'a': pool = lower
            else: pool = entropy if entropy else [""]
            
            for c in pool:
                next_template = template[:placeholder_idx] + c + template[placeholder_idx + 1:]
                yield from generate_from_pattern(next_template, entropy, digits, upper, lower)

        batch = []
        pattern_string = request.args.get('pattern_string')
        if pattern_string:
            import re
            patterns = [p.strip() for p in re.split(r'[\n,]', pattern_string) if p.strip()]
            entropy = list(request.args.get('custom_charset', ""))
            digits = list("0123456789")
            upper = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
            lower = list("abcdefghijklmnopqrstuvwxyz")
            
            for pattern in patterns:
                for pw in generate_from_pattern(pattern, entropy, digits, upper, lower):
                    batch.append(pw)
                    count += 1
                    if len(batch) >= 1000:
                        yield '\n'.join(batch) + '\n'
                        batch = []
                    if limit_val and count >= limit_val:
                        if batch: yield '\n'.join(batch) + '\n'
                        return
        else:
            charset_to_use = (request.args.get('custom_charset', '') + (charset if not request.args.get('custom_charset') else '')) or "abcdefghijklmnopqrstuvwxyz0123456789"
            for r in range(min_len, max_len + 1):
                gen = itertools.product(charset_to_use, repeat=r) if mode == 'brute' else itertools.permutations(charset_to_use, r)
                for combo in gen:
                    pw = ''.join(combo)
                    if not is_valid(pw): continue
                    
                    batch.append(pw)
                    count += 1
                    if len(batch) >= 1000:
                        yield '\n'.join(batch) + '\n'
                        batch = []
                    if limit_val and count >= limit_val:
                        if batch: yield '\n'.join(batch) + '\n'
                        return
        if batch: yield '\n'.join(batch) + '\n'
        if batch: yield '\n'.join(batch) + '\n'

    from flask import Response
    return Response(generate(), mimetype='application/octet-stream', headers={
        "Content-Disposition": f"attachment; filename=\"{filename}\""
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
