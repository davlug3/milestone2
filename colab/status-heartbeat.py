"""Publish read-only render telemetry to the authenticated job's Drive folder."""
import argparse
import io
import json
import socket
import time
from datetime import datetime, timezone
from pathlib import Path

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--job-folder", required=True)
    p.add_argument("--interval", type=int, default=30)
    a = p.parse_args()
    if a.interval < 15:
        p.error("Interval must be at least 15 seconds")
    from google.auth import default
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseUpload
    import httplib2, google_auth_httplib2
    creds, _ = default()
    api = build("drive", "v3", http=google_auth_httplib2.AuthorizedHttp(creds, http=httplib2.Http(timeout=25)), cache_discovery=False)
    name = "render-status.json"
    fid = None
    while True:
        try:
            frames = list((a.output / "depth").glob("frame-*.png"))
            stamps = sorted(f.stat().st_mtime for f in frames)
            active = False
            for proc in Path("/proc").iterdir():
                if not proc.name.isdigit():
                    continue
                try:
                    active |= (proc / "comm").read_text().strip() == "blender"
                except OSError:
                    pass
            complete = (a.output / "media.json").is_file() and not active
            h = dict(device=socket.gethostname(), updatedAt=datetime.now(timezone.utc).isoformat(),
                     rendered=len(frames), rendering=active, complete=complete,
                     secondsPerFrame=(stamps[-1]-stamps[-31])/30 if active and len(stamps)>30 and 0<stamps[-1]-stamps[-31]<180 else None)
            if fid is None:
                files = api.files().list(q=f"'{a.job_folder}' in parents and trashed=false and name='{name}'", fields="files(id)", supportsAllDrives=True).execute()["files"]
                if len(files)>1:
                    raise RuntimeError("Duplicate status file")
                if files:
                    fid = files[0]["id"]
            media = MediaIoBaseUpload(io.BytesIO(json.dumps(h).encode()), mimetype="application/json")
            if fid:
                api.files().update(fileId=fid,media_body=media,supportsAllDrives=True).execute(num_retries=2)
            else:
                fid=api.files().create(body={"name":name,"parents":[a.job_folder]},media_body=media,fields="id",supportsAllDrives=True).execute(num_retries=2)["id"]
            print("Heartbeat", h, flush=True)
            if complete:
                break
        except Exception as e:
            print("Heartbeat deferred", type(e).__name__, flush=True)
        time.sleep(a.interval)

if __name__ == "__main__":
    main()
