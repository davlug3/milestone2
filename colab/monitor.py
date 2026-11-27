"""Optional read-only Colab monitor. No remote command execution."""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from collections import deque
from datetime import datetime, timezone

class Monitor:
    def __init__(self, output, total, password=None, publish=None):
        self.output=Path(output)
        self.total=total
        self.password=password or secrets.token_urlsafe(24)
        self.publish=publish
        self.stop=threading.Event()
        self.logs=deque(maxlen=100)
        self.lock=threading.Lock()
        self.url=None
        self.ssh=None
        self.server=None
        self.thread=None
        self.frame=0
        self.uploaded=0
        self.uploading=None
        self.timings=deque(maxlen=30)
        self.started=time.monotonic()
    def log(self,line):
        with self.lock:
            # Only accept renderer lines, never authentication/tunnel output.
            self.logs.append(line.rstrip()[:1000])
            m=re.search(r'Finished (\d+) seconds ([\d.]+)',line)
            if m:
                self.frame=max(self.frame,int(m[1]))
                self.timings.append(float(m[2]))
    def status(self):
        depth=len(list((self.output/'depth').glob('frame-*.png')))
        committed=0
        chunks=0
        for p in (self.output/'chunks').glob('chunk-*.json'):
            try:
                d=json.loads(p.read_text())
                committed+=int(d['count']);chunks+=1
            except (OSError,ValueError,KeyError):pass
        with self.lock:
            frame=max(depth,self.frame)
            avg=sum(self.timings)/len(self.timings) if self.timings else None
        return dict(rendered=frame,total=self.total,committed=committed,chunks=chunks,
                    percent=round(frame/self.total*100,2),seconds_per_frame=avg,
                    eta_seconds=round(max(0,self.total-frame)*avg) if avg else None,
                    uploaded=self.uploaded,uploading=self.uploading,
                    complete=(self.output/'media.json').is_file(),
                    updated=datetime.now(timezone.utc).isoformat())
    def gpu(self):
        try:
            p=subprocess.run(['nvidia-smi','--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu','--format=csv,noheader,nounits'],capture_output=True,text=True,timeout=5,check=True)
            return [dict(zip(('name','utilization_percent','vram_used_mib','vram_total_mib','temperature_c'),[s.strip() for s in l.split(',')])) for l in p.stdout.splitlines()]
        except Exception:return []
    def system(self):
        d=shutil.disk_usage(self.output.parent)
        mem={}
        try:
            for line in Path('/proc/meminfo').read_text().splitlines():
                if line.startswith(('MemTotal:','MemAvailable:')):
                    k,v=line.split(':',1);mem[k]=int(v.split()[0])*1024
        except OSError:pass
        return dict(disk_free_bytes=d.free,disk_total_bytes=d.total,memory=mem,load_average=os.getloadavg())
    def start(self):
        if self.server:return self
        mon=self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                expected='Basic '+base64.b64encode(('monitor:'+mon.password).encode()).decode()
                if not hmac.compare_digest(self.headers.get('Authorization',''),expected):
                    self.send_response(401);self.send_header('WWW-Authenticate','Basic realm="Render monitor"');self.end_headers();return
                route=self.path.split('?',1)[0]
                if route=='/api/status':data=mon.status()
                elif route=='/api/gpu':data=mon.gpu()
                elif route=='/api/system':data=mon.system()
                elif route=='/api/uploads':data=dict(uploaded=mon.uploaded,uploading=mon.uploading,total=mon.total)
                elif route=='/api/logs':
                    with mon.lock:data=list(mon.logs)
                elif route=='/':
                    data=('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Render monitor</title><style>body{font:16px system-ui;max-width:720px;margin:2em auto;padding:1em;background:#111827;color:#eee}pre{white-space:pre-wrap;background:#1f2937;padding:1em;border-radius:8px}progress{width:100%}</style><h1>Colab render monitor</h1><progress id="bar" max="100"></progress><pre id="status"></pre><pre id="gpu"></pre><pre id="system"></pre><pre id="logs"></pre><script>async function update(){for(let name of ["status","gpu","system","logs"]){try{let r=await fetch("/api/"+name);if(!r.ok)throw Error(r.status);let j=await r.json();document.getElementById(name).textContent=JSON.stringify(j,null,2);if(name==="status")document.getElementById("bar").value=j.percent}catch(e){document.getElementById(name).textContent="Unavailable: "+e}}}update();setInterval(update,5000)</script>').encode()
                    return self.reply(200,data,'text/html; charset=utf-8')
                else:return self.reply(404,b'Not found','text/plain')
                self.reply(200,json.dumps(data).encode(),'application/json')
            def reply(self,code,body,typ):
                self.send_response(code);self.send_header('Content-Type',typ);self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(body)
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        threading.Thread(target=self.server.serve_forever,daemon=True).start()
        self.thread=threading.Thread(target=self.tunnel,daemon=True)
        self.thread.start()
        return self
    def tunnel(self):
        # SSH host keys are accepted on first use, not disabled on subsequent connections.
        port=self.server.server_address[1]
        # A dedicated, ephemeral SSH key avoids password prompts on reconnect.
        key=self.output.parent/'monitor-ssh-key'
        if not key.exists():
            subprocess.run(['ssh-keygen','-q','-t','ed25519','-N','','-f',str(key)],check=True)
        while not self.stop.is_set():
            try:
                self.ssh=subprocess.Popen(['ssh','-tt','-i',str(key),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-p','443','-o','StrictHostKeyChecking=accept-new','-o','ServerAliveInterval=30','-o','ServerAliveCountMax=3','-o','ConnectTimeout=15','-R',f'0:127.0.0.1:{port}','free.pinggy.io'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
                for line in self.ssh.stdout:
                    if self.stop.is_set():break
                    m=re.search(r'https://[a-zA-Z0-9.-]+\.pinggy(?:-free)?\.(?:link|io|run)(?=[^a-zA-Z0-9.-]|$)',line)
                    if m and m[0]!=self.url:
                        self.url=m[0]
                        print('[MONITOR] '+self.url,flush=True)
                        if self.publish:
                            try:self.publish(self.url)
                            except Exception:print('[MONITOR] URL publication failed',flush=True)
                self.ssh.wait(timeout=15)
            except Exception:
                if self.ssh and self.ssh.poll() is None:self.ssh.terminate()
            self.url=None
            self.stop.wait(10)
    def close(self):
        self.stop.set()
        if self.ssh and self.ssh.poll() is None:self.ssh.terminate()
        if self.server:self.server.shutdown();self.server.server_close()
