import sys
sys.stdout = sys.stderr

print('Step 1: Testing scrapling StealthySession...', flush=True)
from scrapling.engines._browsers._stealth import StealthySession

print('Step 2: Creating session...', flush=True)
results = []

with StealthySession(headless=True, locale='es-ES') as session:
    def action(page):
        print('Step 3: Page loaded, URL:', page.url, flush=True)
        import time
        time.sleep(2)

        feed = page.query_selector('[role="feed"]')
        print('Step 4: Feed found:', feed is not None, flush=True)

        articles = page.query_selector_all('div[role="article"]')
        print('Step 5: Articles found:', len(articles), flush=True)

        if articles:
            first = articles[0]
            name = first.get_attribute('aria-label') or ''
            print('Step 6: First result:', name[:60], flush=True)

    url = 'https://www.google.com/maps/search/restaurantes+en+Maracay+Aragua'
    print('Step 2b: Fetching:', url, flush=True)
    session.fetch(url, page_action=action, load_dom=True, network_idle=True, timeout=60000)

print('ALL TESTS PASSED!', flush=True)