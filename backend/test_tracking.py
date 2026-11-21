import unittest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models import User


class TrackingAccessTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine(
            'sqlite://',
            connect_args={'check_same_thread': False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)
        with Session(self.engine) as db:
            db.add_all([
                User(id=1, full_name='Admin', email='admin@example.com', password_hash='unused', role='superadmin', is_active=True),
                User(id=2, full_name='Member One', email='one@example.com', password_hash='unused', role='member', is_active=True),
                User(id=3, full_name='Member Two', email='two@example.com', password_hash='unused', role='member', is_active=True),
            ])
            db.commit()
        def database():
            with Session(self.engine) as db:
                yield db
        app.dependency_overrides[get_db] = database
        self.client = TestClient(app)
        self.payload = {'company_name': 'Acme', 'job_title': 'Engineer', 'applied_at': '2026-11-17', 'notes': 'Follow up'}

    def tearDown(self):
        app.dependency_overrides.clear()
        self.client.close()
        self.engine.dispose()

    def headers(self, user_id):
        return {'Authorization': 'Bearer ' + create_access_token(user_id)}

    def create_application(self, user_id=2):
        response = self.client.post('/applications', json=self.payload, headers=self.headers(user_id))
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def interview_payload(self, application_id):
        return {'application_id': application_id, 'round_name': 'Technical', 'scheduled_at': '2026-12-01T10:00:00+05:00', 'meeting_link': 'https://example.com/meeting'}

    def test_application_ownership_and_admin_access(self):
        application = self.create_application()
        self.assertEqual(application['user_id'], 2)
        self.assertEqual(self.client.get('/applications', headers=self.headers(3)).json(), [])
        self.assertEqual(len(self.client.get('/applications', headers=self.headers(1)).json()), 1)
        path = '/applications/' + str(application['id'])
        self.assertEqual(self.client.put(path, json=self.payload, headers=self.headers(3)).status_code, 404)
        response = self.client.put(path, json={**self.payload, 'application_status': 'offer', 'job_type': 'hybrid'}, headers=self.headers(2))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['application_status'], 'offer')
        self.assertEqual(self.client.put(path, json=self.payload, headers=self.headers(1)).status_code, 200)
        self.assertEqual(self.client.post('/applications', json={**self.payload, 'user_id': 3}, headers=self.headers(2)).status_code, 403)
        response = self.client.post('/applications', json={**self.payload, 'user_id': 3}, headers=self.headers(1))
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['user_id'], 3)
        self.assertEqual(self.client.post('/applications', json={**self.payload, 'user_id': 999}, headers=self.headers(1)).status_code, 422)

    def test_interview_ownership_and_updates(self):
        application = self.create_application()
        payload = self.interview_payload(application['id'])
        self.assertEqual(self.client.post('/interviews', json=payload, headers=self.headers(3)).status_code, 404)
        response = self.client.post('/interviews', json=payload, headers=self.headers(2))
        self.assertEqual(response.status_code, 201, response.text)
        interview = response.json()
        self.assertEqual(interview['meeting_link'], payload['meeting_link'])
        self.assertEqual(self.client.get('/interviews', headers=self.headers(3)).json(), [])
        self.assertEqual(len(self.client.get('/interviews', headers=self.headers(1)).json()), 1)
        path = '/interviews/' + str(interview['id'])
        self.assertEqual(self.client.put(path, json=payload, headers=self.headers(3)).status_code, 404)
        other_application = self.create_application(3)
        self.assertEqual(self.client.put(path, json={**payload, 'application_id': other_application['id']}, headers=self.headers(2)).status_code, 404)
        response = self.client.put(path, json={**payload, 'status': 'completed', 'meeting_link': None}, headers=self.headers(2))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'completed')
        self.assertIsNone(response.json()['meeting_link'])
        self.assertEqual(self.client.put(path, json=payload, headers=self.headers(1)).status_code, 200)

    def test_standalone_interview_and_application_deletion(self):
        headers = self.headers(2)
        standalone = {
            'application_id': None,
            'round_name': 'Recruiter screen',
            'scheduled_at': '2026-12-01T10:00:00+05:00',
        }
        response = self.client.post('/interviews', json=standalone, headers=headers)
        self.assertEqual(response.status_code, 201, response.text)
        self.assertIsNone(response.json()['application_id'])
        self.assertEqual(response.json()['user_id'], 2)
        self.assertEqual(len(self.client.get('/interviews', headers=headers).json()), 1)

        application = self.create_application()
        linked_response = self.client.post(
            '/interviews', json=self.interview_payload(application['id']), headers=headers
        )
        self.assertEqual(linked_response.status_code, 201, linked_response.text)
        path = '/applications/' + str(application['id'])
        self.assertEqual(self.client.delete(path, headers=self.headers(3)).status_code, 404)
        self.assertEqual(self.client.delete(path, headers=headers).status_code, 204)
        remaining = self.client.get('/interviews', headers=headers).json()
        self.assertEqual(len(remaining), 2)
        self.assertTrue(all(item['application_id'] is None for item in remaining))

    def test_authentication_and_validation(self):
        application = self.create_application()
        payload = self.interview_payload(application['id'])
        for resource in ['/applications', '/interviews']:
            self.assertEqual(self.client.get(resource).status_code, 401)
        self.assertEqual(self.client.post('/applications', json=self.payload).status_code, 401)
        self.assertEqual(self.client.post('/interviews', json=payload).status_code, 401)
        self.assertEqual(self.client.post('/members', json={'full_name': 'Another Member', 'email': 'another@example.com', 'password': 'MemberPassword123!'}, headers=self.headers(2)).status_code, 403)
        self.assertEqual(self.client.post('/applications', json={**self.payload, 'company_name': '   '}, headers=self.headers(2)).status_code, 422)
        self.assertEqual(self.client.post('/interviews', json={**payload, 'scheduled_at': '2026-12-01T10:00:00'}, headers=self.headers(2)).status_code, 422)
        self.assertEqual(self.client.post('/interviews', json={**payload, 'meeting_link': 'javascript:alert(1)'}, headers=self.headers(2)).status_code, 422)
        with Session(self.engine) as db:
            db.get(User, 2).is_active = False
            db.commit()
        self.assertEqual(self.client.get('/applications', headers=self.headers(2)).status_code, 401)

    def test_login_returns_user_with_access_token(self):
        password = 'MemberPassword123!'
        with Session(self.engine) as db:
            db.get(User, 2).password_hash = hash_password(password)
            db.commit()
        response = self.client.post(
            '/auth/login',
            data={'username': 'one@example.com', 'password': password},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(response.json()['access_token'])
        self.assertEqual(response.json()['user']['id'], 2)
        self.assertEqual(response.json()['user']['email'], 'one@example.com')


if __name__ == '__main__':
    unittest.main()
