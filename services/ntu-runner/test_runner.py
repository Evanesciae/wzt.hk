import tempfile
import unittest
from pathlib import Path
import httpx
import runner


class WorkerTests(unittest.TestCase):
    def test_cookie_never_sent_to_external_links_or_pagination(self):
        calls=[]
        school=runner.School('secret',httpx.Client(transport=httpx.MockTransport(lambda r:calls.append(r))))
        for url in ['https://evil.test/a','//evil.test/x','https://ntulearn.ntu.edu.sg:444/x','https://user@ntulearn.ntu.edu.sg/x']:
            with self.assertRaises(runner.WorkError):school.json(url)
        self.assertEqual(calls,[])

    def test_redirect_cannot_forward_cookie(self):
        calls=[]
        def respond(request):
            calls.append(request)
            return httpx.Response(302,headers={'location':'https://evil.test/secret.pdf'})
        school=runner.School('secret',httpx.Client(transport=httpx.MockTransport(respond)))
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'file.pdf'
            with self.assertRaises(runner.WorkError):school.download('/file',path)
            self.assertFalse(path.exists());self.assertFalse(path.with_suffix('.part').exists())
        self.assertEqual(len(calls),1);self.assertEqual(calls[0].headers['cookie'],'BbRouter=secret')

    def test_login_html_and_oversized_files_are_rejected(self):
        for response in [httpx.Response(200,headers={'content-type':'text/html'},text='<html>Login</html>'),httpx.Response(200,headers={'content-length':str(runner.MAX_FILE+1)})]:
            school=runner.School('secret',httpx.Client(transport=httpx.MockTransport(lambda r:response)))
            with tempfile.TemporaryDirectory() as folder:
                with self.assertRaises(runner.WorkError):school.download('/file',Path(folder)/'file')
                self.assertEqual(list(Path(folder).iterdir()),[])

    def test_attachment_missing_is_empty_but_forbidden_is_not(self):
        for status in [404,403]:
            school=runner.School('secret',httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(status))))
            if status==404:self.assertEqual(school.pages('/learn/api/public/v1/attachments',missing_ok=True),[])
            else:
                with self.assertRaises(runner.WorkError):school.pages('/learn/api/public/v1/attachments',missing_ok=True)

    def test_same_origin_download_is_atomic(self):
        school=runner.School('secret',httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(200,content=b'file bytes'))))
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'file';school.download('/file',path);self.assertEqual(path.read_bytes(),b'file bytes')

    def test_scanned_pdf_requires_ocr(self):
        from pypdf import PdfWriter
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'scan.pdf';doc=PdfWriter();doc.add_blank_page(width=100,height=100);doc.write(path)
            with self.assertRaises(runner.NeedsOCR):runner.extract(path,path.name)

    def test_chunks_preserve_page_provenance_and_bound_cost(self):
        batches=runner.chunks([(7,'a'*20000),(8,'b'*5000)])
        self.assertIn('[来源页 7]',batches[0]);self.assertIn('[来源页 7]',batches[1]);self.assertIn('[来源页 8]',batches[-1])
        with self.assertRaises(runner.WorkError):runner.chunks([(i,'x'*14000) for i in range(20)])


if __name__=='__main__':unittest.main()
