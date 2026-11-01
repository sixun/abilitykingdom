"""VARCO TextToSound(NC AI)로 효과음 후보 만들기.

tools/sfx/varco_prompts.json 의 키마다 prompt 로 후보 n개를 받아 <출력>/<키>/<번호>.mp3 로 저장한다.
- API: POST https://openapi.ai.nc.com/sound/varco/v1/api/text2sound, 머리글 OPENAPI_KEY (값은 환경변수 VARCO_OPENAPI_KEY)
  결과는 10초 고정 WAV(44.1kHz 16bit)라 게임에 넣을 때 tools/build_sfx.py 가 잘라 쓴다.
- 같은 프롬프트로 이미 만든 키는 건너뛴다(<출력>/index.json 에 프롬프트 해시 기록) → 프롬프트를 고친 키만 다시 만든다(과금 절약).
- 실패는 멈추지 않고 <출력>/last_run.json 에 적는다(GitHub Actions 로그를 못 보는 곳에서도 확인 가능).
키는 GitHub 비밀값으로만 넣는다(채팅·파일에 적지 않음). 실행: .github/workflows/varco-sfx.yml
사용: VARCO_OPENAPI_KEY=... python3 tools/varco_sfx.py <출력 폴더> [키1,키2 ...]
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = 'https://openapi.ai.nc.com/sound/varco/v1/api/text2sound'
ROOT = Path(__file__).resolve().parent.parent
PROMPTS = ROOT / 'tools/sfx/varco_prompts.json'


def call(key, prompt, n):
    body = json.dumps({'prompt': prompt, 'num_sample': n}).encode()  # 문서 예제 기준 필드 이름
    req = urllib.request.Request(API, data=body, method='POST', headers={'OPENAPI_KEY': key, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read())
    items = data if isinstance(data, list) else data.get('data') or data.get('result') or data.get('results') or []
    if isinstance(items, dict):
        items = [items]
    out = [base64.b64decode(it['audio'] if isinstance(it, dict) else it) for it in items]
    if not out:
        raise RuntimeError(f'빈 응답: {str(data)[:300]}')
    return out


def main():
    out = Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
    only = set(sys.argv[2].split(',')) if len(sys.argv) > 2 and sys.argv[2] else None
    key = os.environ.get('VARCO_OPENAPI_KEY', '').strip()
    if not key:
        raise SystemExit('VARCO_OPENAPI_KEY 없음')
    spec = {k: v for k, v in json.loads(PROMPTS.read_text()).items() if not k.startswith('_')}
    idx_f = out / 'index.json'
    index = json.loads(idx_f.read_text()) if idx_f.exists() else {}
    log = {'started': time.strftime('%Y-%m-%d %H:%M:%S'), 'made': [], 'skipped': [], 'failed': {}}
    for k, v in spec.items():
        if only and k not in only:
            continue
        h = hashlib.sha1(f"{v['prompt']}|{v['n']}".encode()).hexdigest()[:12]
        if index.get(k, {}).get('hash') == h and (out / k).exists():
            log['skipped'].append(k); continue
        try:
            for attempt in range(3):
                try:
                    wavs = call(key, v['prompt'], v['n']); break
                except urllib.error.HTTPError as e:
                    msg = e.read().decode(errors='replace')[:300]
                    if e.code in (429, 500, 502, 503, 504) and attempt < 2:
                        time.sleep(10 * (attempt + 1)); continue
                    raise RuntimeError(f'HTTP {e.code}: {msg}')
            d = out / k
            d.mkdir(exist_ok=True)
            for f in d.glob('*'):
                f.unlink()
            files = []
            for i, w in enumerate(wavs):
                wav = d / f'{i}.wav'; wav.write_bytes(w)
                mp3 = d / f'{i}.mp3'
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-q:a', '2', str(mp3)], check=True)
                wav.unlink(); files.append(mp3.name)
            index[k] = {'hash': h, 'prompt': v['prompt'], 'files': files, 'at': time.strftime('%Y-%m-%d %H:%M:%S')}
            log['made'].append(k)
            idx_f.write_text(json.dumps(index, ensure_ascii=False, indent=1))
            print('ok', k, len(files))
        except Exception as e:  # 하나 실패해도 나머지는 계속
            log['failed'][k] = str(e)[:400]
            print('FAIL', k, e)
    log['ended'] = time.strftime('%Y-%m-%d %H:%M:%S')
    (out / 'last_run.json').write_text(json.dumps(log, ensure_ascii=False, indent=1))
    idx_f.write_text(json.dumps(index, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
