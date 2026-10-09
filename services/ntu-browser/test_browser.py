import unittest
from unittest.mock import Mock
import browser

class BrowserTests(unittest.TestCase):
    def test_navigation_stays_on_school_and_identity_providers(self):
        for url in ['https://ntulearn.ntu.edu.sg/ultra/stream','https://sso.ntu.edu.sg/login','https://login.microsoftonline.com/tenant']:
            self.assertTrue(browser.allowed(url, True))
        for url in ['http://ntulearn.ntu.edu.sg','https://ntulearn.ntu.edu.sg.evil.test','https://127.0.0.1','http://169.254.169.254','file:///etc/passwd','https://x@ntulearn.ntu.edu.sg','https://ntulearn.ntu.edu.sg:8888','https://wzt.hk/admin']:
            self.assertFalse(browser.allowed(url, True))
        self.assertTrue(browser.allowed('https://assets.blackboardcdn.com/x.js'))
        self.assertFalse(browser.allowed('https://assets.blackboardcdn.com/x.js',True))

    def test_text_and_keys_cannot_execute_browser_scripts_or_navigate_arbitrary_urls(self):
        page=Mock();page.url='https://ntulearn.ntu.edu.sg/'
        browser.apply_command(page,{'type':'text','text':'secret'})
        page.keyboard.insert_text.assert_called_once_with('secret')
        for cmd in [{'type':'key','key':'Control+L'},{'type':'goto','url':'http://localhost'}, {'type':'click','x':1280,'y':0}]:
            with self.assertRaises(ValueError):browser.apply_command(page,cmd)
        page.url='https://evil.test'
        with self.assertRaises(ValueError):browser.apply_command(page,{'type':'text','text':'secret'})
        page.evaluate.assert_not_called()

if __name__=='__main__':unittest.main()
