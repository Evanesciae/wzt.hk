import tempfile
import unittest
from unittest.mock import patch, Mock
from datetime import datetime, timezone
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

    def test_navigation_skips_attachment_api_but_document_errors_are_visible(self):
        calls=[]
        def respond(request):
            calls.append(request)
            return httpx.Response(400, json={"message":"bad request"})
        school=runner.School('secret',httpx.Client(transport=httpx.MockTransport(respond)))
        path='/learn/api/public/v1/courses/c/contents/f'
        self.assertEqual(school.attachments(path,{'contentHandler':{'id':'resource/x-bb-folder'}}),[])
        self.assertEqual(calls,[])
        with self.assertRaises(runner.WorkError):
            school.attachments(path,{'contentHandler':{'id':'resource/x-bb-document'}})
        self.assertEqual(len(calls),1)

    def test_incremental_sync_retries_failed_attachment_and_downloads_new_files(self):
        item={'id':'lesson','title':'Lecture','contentHandler':{'id':'resource/x-bb-document'}}
        attachments=[{'id':'a','fileName':'a.pdf'},{'id':'b','fileName':'b.pdf'}]
        known={}; uploads=[]; finishes=[]; downloads=[]; failing={'a'}
        school=Mock()
        school.json.side_effect=lambda path: {} if path.endswith('/users/me') else item
        school.pages.return_value=[item]
        school.attachments.side_effect=lambda *args:list(attachments)
        def download(url,path):
            aid=url.split('/')[-2];downloads.append(aid)
            if aid in failing:raise runner.WorkError('temporary download failure')
            path.write_bytes(b'%PDF-1.7 '+aid.encode())
        school.download.side_effect=download
        bridge=Mock();bridge.manifest.side_effect=lambda:dict(known)
        def action(action,**data):
            if action=='begin':return {'id':'run'}
            if action=='source':
                sid=runner.source_id(data['courseId'],data['contentId'],data['attachmentId'])
                known[sid]={'fingerprint':data['fingerprint'],'version_id':None,'checked_at':datetime.now(timezone.utc).isoformat()}
                return {'id':sid}
            if action=='finish':finishes.append(data)
            return {}
        bridge.action.side_effect=action
        def upload(*args,**kwargs):
            sid=kwargs['headers']['x-source-id'];known[sid]['version_id']='version';uploads.append(sid)
        bridge.request.side_effect=upload
        with tempfile.TemporaryDirectory() as folder, patch.object(runner,'School',return_value=school), patch.object(runner.shutil,'disk_usage',return_value=Mock(free=10*1024**3)):
            settings={'cookie':'secret','courseIds':['course']}
            self.assertEqual(runner.sync(bridge,settings,Path(folder)),'partial')
            self.assertEqual(downloads,['a','b'])
            self.assertEqual(len(uploads),1)
            self.assertEqual(finishes[-1]['completedCourses'],[])
            failing.clear();downloads.clear()
            attachments.append({'id':'c','fileName':'c.pdf'})
            self.assertEqual(runner.sync(bridge,settings,Path(folder)),'completed')
            self.assertEqual(downloads,['a','c'])
            self.assertEqual(finishes[-1]['counts'],{'downloaded':2,'unchanged':1})
            self.assertEqual(finishes[-1]['completedCourses'],['course'])
            downloads.clear()
            runner.sync(bridge,settings,Path(folder))
            self.assertEqual(downloads,[])
            self.assertEqual(finishes[-1]['counts'],{'downloaded':0,'unchanged':3})
            item['modified']='2026-10-09T12:00:00Z'
            runner.sync(bridge,settings,Path(folder))
            self.assertEqual(downloads,['a','b','c'])

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
