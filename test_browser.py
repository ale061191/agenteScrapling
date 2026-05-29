import sys
sys.stdout = sys.stderr

print('Step 1: Importing playwright...', flush=True)
from playwright.sync_api import sync_playwright

print('Step 2: Starting playwright with context manager...', flush=True)
with sync_playwright() as p:
    print('Step 3: Launching browser...', flush=True)
    b = p.chromium.launch(headless=True)
    print('Step 4: Creating page...', flush=True)
    pg = b.new_page()
    print('Step 5: Navigating to Google...', flush=True)
    pg.goto('https://www.google.com', timeout=15000)
    print('Step 6: Page title:', pg.title(), flush=True)
    print('Step 7: Closing browser...', flush=True)
    b.close()
    print('ALL TESTS PASSED!', flush=True)