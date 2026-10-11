"""Outbound-only, persistent NTULearn browser. No passwords or URLs in logs.

Control and screenshots require the website's admin session. The browser token
is scoped to this relay and cannot read course files or other service secrets.
"""
from __future__ import annotations
import logging
import json
import os
import signal
import time
from pathlib import Path
from urllib.parse import urlparse
import httpx

ORIGIN = 'https://ntulearn.ntu.edu.sg'
HOME = ORIGIN + '/ultra/stream'
API = ORIGIN + '/learn/api/public/v1/users/me'
KEYS = {'Tab', 'Shift+Tab', 'Enter', 'Backspace', 'Escape', 'Control+A',
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'}
NAV_DOMAINS = ('ntu.edu.sg', 'microsoftonline.com', 'login.live.com', 'duosecurity.com')
RESOURCE_DOMAINS = NAV_DOMAINS + ('blackboard.com', 'blackboardcdn.com', 'msauth.net',
    'msftauth.net', 'msauthimages.net', 'msftauthimages.net', 'microsoft.com',
    'office.com', 'azureedge.net', 'gstatic.com')


def allowed(url: str, navigation=False) -> bool:
    try:
        p = urlparse(url)
        return p.scheme == 'https' and p.port in (None, 443) and not p.username and not p.password and any(
            p.hostname == domain or (p.hostname or '').endswith('.' + domain)
            for domain in (NAV_DOMAINS if navigation else RESOURCE_DOMAINS))
    except ValueError:
        return False


def apply_command(page, command):
    kind = command.get('type')
    if kind == 'home':
        page.goto(HOME, wait_until='domcontentloaded', timeout=45000)
    elif not allowed(page.url, navigation=True):
        raise ValueError('Unsupported login origin')
    elif kind == 'click':
        x, y = command.get('x'), command.get('y')
        if not isinstance(x, int) or not isinstance(y, int) or not 0 <= x < 1280 or not 0 <= y < 900:
            raise ValueError('Bad coordinates')
        page.mouse.click(x, y)
    elif kind == 'text':
        text = command.get('text')
        if not isinstance(text, str) or not 1 <= len(text) <= 2000:
            raise ValueError('Bad input')
        page.keyboard.insert_text(text)
    elif kind == 'key' and command.get('key') in KEYS:
        page.keyboard.press(command['key'])
    elif kind == 'scroll' and command.get('y') in (-600, 600):
        page.mouse.wheel(0, command['y'])
    else:
        raise ValueError('Unsupported command')


class Relay:
    def __init__(self):
        site = os.environ.get('WZT_SITE_URL', 'https://wzt.hk').rstrip('/')
        if site != 'https://wzt.hk':
            raise ValueError('Unexpected relay origin')
        token = os.environ.get('NTU_BROWSER_TOKEN', '')
        if len(token) < 32:
            raise ValueError('Missing browser token')
        self.url = site + '/api/ntu-browser'
        self.http = httpx.Client(timeout=35, follow_redirects=False,
            headers={'Authorization': 'Bearer ' + token})

    def request(self, method='GET', **kwargs):
        # Never automatically repeat input consumption or cookie writes.
        r = self.http.request(method, self.url, **kwargs)
        if not r.is_success:
            raise RuntimeError('Relay unavailable')
        return r.json()


def main():
    from playwright.sync_api import sync_playwright
    logging.basicConfig(level=logging.WARNING, format='%(asctime)s %(levelname)s %(message)s')
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpcore').setLevel(logging.WARNING)
    os.umask(0o077)
    root = Path('/profile')
    root.mkdir(parents=True, exist_ok=True)
    relay = Relay()
    context = None
    generation = None
    last_auth = 0
    last_recovery = 0
    state = 'needs_login'
    with sync_playwright() as pw:
        while True:
            signal.alarm(150)  # restart if browser/network wedges; Docker restarts the process
            (root / 'heartbeat').touch()
            interactive = False
            try:
                cfg = relay.request()
                interactive = cfg['interactive']
                if not cfg['enabled']:
                    if context:
                        context.close(); context = None
                    generation = None
                    time.sleep(15)
                    continue
                if not context:
                    context = pw.chromium.launch_persistent_context(str(root / 'chromium'),
                        headless=True, chromium_sandbox=True, viewport={'width':1280,'height':900},
                        accept_downloads=False, service_workers='block', locale='en-SG',
                        args=['--disable-dev-shm-usage'])
                    context.set_default_timeout(10000)
                    def route(req):
                        request = req.request
                        main_navigation = request.is_navigation_request() and request.frame.parent_frame is None
                        if allowed(request.url, navigation=main_navigation):
                            req.continue_()
                        else:
                            req.abort()
                    context.route('**/*', route)
                    context.on('page', lambda p: p.on('dialog', lambda d: d.dismiss()))
                    for p in context.pages:
                        p.on('dialog', lambda d: d.dismiss())
                    saved = root / 'cookies.json'
                    if saved.exists():
                        context.add_cookies(json.loads(saved.read_text()))
                    last_auth = 0
                pages = [p for p in context.pages if not p.is_closed()]
                page = pages[-1] if pages else context.new_page()
                # Opening a new window reuses the same persistent login, without
                # sharing the user's normal desktop browser or its other accounts.
                if generation != cfg['sessionId'] or page.url == 'about:blank':
                    generation = cfg['sessionId']
                    page.goto(HOME, wait_until='domcontentloaded', timeout=45000)
                    last_auth = 0
                if cfg.get('command'):
                    apply_command(page, cfg['command'])
                    cfg['command'] = None
                    page.wait_for_timeout(400)
                now = time.monotonic()
                if now-last_auth > (5 if interactive else 600):
                    last_auth = now
                    response = context.request.get(API, max_redirects=0, timeout=20000)
                    ok = response.status == 200 and 'json' in response.headers.get('content-type','')
                    response.dispose()
                    if not ok and not interactive and now-last_recovery > 1800:
                        # One normal SSO navigation, never password/MFA automation.
                        last_recovery = now
                        page.goto(HOME, wait_until='domcontentloaded', timeout=45000)
                        response = context.request.get(API, max_redirects=0, timeout=20000)
                        ok = response.status == 200 and 'json' in response.headers.get('content-type','')
                        response.dispose()
                    state = 'connected' if ok else 'needs_login'
                    if ok:
                        cookies = context.cookies(ORIGIN)
                        cookie = next((c['value'] for c in cookies if c['name']=='BbRouter'), None)
                        if cookie:
                            relay.request('POST',json={'sessionId':generation,'status':'connected',
                                'host':'ntulearn.ntu.edu.sg','cookie':cookie,'revision':cfg['revision'],
                                'userAgent':page.evaluate('navigator.userAgent')})
                            temporary = root / 'cookies.tmp'
                            temporary.write_text(json.dumps(context.cookies()))
                            temporary.replace(root / 'cookies.json')
                pages = [p for p in context.pages if not p.is_closed()]
                page = pages[-1] if pages else context.new_page()
                relay.request('POST',json={'sessionId':generation,'status':state,
                    'host':urlparse(page.url).hostname or ''})
                if interactive:
                    frame = page.screenshot(type='jpeg', quality=65, timeout=15000)
                    if len(frame) <= 600000:
                        relay.request('POST',content=frame,headers={'Content-Type':'image/jpeg','x-browser-session':generation})
                time.sleep(2 if interactive else 30)
            except Exception as error:
                # Exceptions from browser APIs can contain typed text or signed URLs.
                logging.warning('Browser operation deferred (%s); details intentionally omitted', type(error).__name__)
                try:
                    if generation:
                        relay.request('POST',json={'sessionId':generation,'status':'error'})
                except Exception:
                    pass
                # Discard an exited browser; preserve the profile for Docker recovery.
                if context:
                    try:
                        if not context.pages:
                            context.close();context=None
                    except Exception:
                        context=None
                time.sleep(5 if interactive else 30)


if __name__ == '__main__':
    main()
