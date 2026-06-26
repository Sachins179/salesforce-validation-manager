from flask import Flask, request, jsonify, redirect, session
from flask_cors import CORS
import requests
import os
import hashlib
import base64
import secrets
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

app.secret_key = os.getenv('FLASK_SECRET_KEY', 'fallback_secret_123')
app.config['SESSION_COOKIE_SECURE'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(hours=1)

CORS(
    app,
    supports_credentials=True,
    origins=[
        "http://localhost:3000",
        "https://salesforce-validation-manager-gx34u1vmd-sachin-projects2.vercel.app"
    ]
)

sf_client_id = os.getenv('SALESFORCE_CLIENT_ID')
sf_client_secret = os.getenv('SALESFORCE_CLIENT_SECRET')
sf_redirect_uri = os.getenv('SALESFORCE_REDIRECT_URI')
sf_instance_url = os.getenv('SALESFORCE_INSTANCE_URL')
frontend_url = os.getenv('FRONTEND_URL', 'https://salesforce-validation-manager-front-sooty.vercel.app')


def generate_code_verifier():
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).rstrip(b'=').decode('utf-8')


def generate_code_challenge(verifier):
    digest = hashlib.sha256(verifier.encode()).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b'=').decode('utf-8')


@app.route('/login')
def login():
    code_verifier = generate_code_verifier()
    code_challenge = generate_code_challenge(code_verifier)
    session['code_verifier'] = code_verifier
    session.permanent = True

    url = sf_instance_url + '/services/oauth2/authorize'
    url += '?response_type=code'
    url += '&client_id=' + sf_client_id
    url += '&redirect_uri=' + sf_redirect_uri
    url += '&code_challenge=' + code_challenge
    url += '&code_challenge_method=S256'

    return redirect(url)


@app.route('/oauth/callback')
def callback():
    code = request.args.get('code')
    if not code:
        return jsonify({'error': 'no code received'}), 400

    code_verifier = session.get('code_verifier')

    token_url = sf_instance_url + '/services/oauth2/token'
    payload = {
        'grant_type': 'authorization_code',
        'client_id': sf_client_id,
        'client_secret': sf_client_secret,
        'redirect_uri': sf_redirect_uri,
        'code': code,
        'code_verifier': code_verifier
    }

    resp = requests.post(token_url, data=payload)
    tokens = resp.json()

    if 'access_token' not in tokens:
        return jsonify({'error': 'failed to get token', 'details': tokens}), 400

    session['access_token'] = tokens['access_token']
    session['instance_url'] = tokens['instance_url']
    session.permanent = True

    return redirect(frontend_url + '?logged_in=true')


@app.route('/api/status')
def check_status():
    if 'access_token' not in session:
        return jsonify({'logged_in': False})

    token = session['access_token']
    base_url = session['instance_url']

    try:
        resp = requests.get(
            base_url + '/services/oauth2/userinfo',
            headers={'Authorization': 'Bearer ' + token}
        )
        info = resp.json()
        return jsonify({
            'logged_in': True,
            'user': {
                'username': info.get('email', ''),
                'org': info.get('organization_id', 'Developer Edition')
            }
        })
    except:
        return jsonify({'logged_in': True, 'user': None})


@app.route('/api/validation-rules')
def get_rules():
    if 'access_token' not in session:
        return jsonify({'error': 'not authenticated'}), 401

    token = session['access_token']
    base_url = session['instance_url']

    query = "SELECT Id, ValidationName, Active, Description FROM ValidationRule WHERE EntityDefinition.QualifiedApiName = 'Account'"

    headers = {'Authorization': 'Bearer ' + token}

    response = requests.get(
        base_url + '/services/data/v59.0/tooling/query',
        params={'q': query},
        headers=headers
    )

    if response.status_code != 200:
        return jsonify({'error': 'failed to fetch rules', 'details': response.text}), 500

    result = response.json()
    rules = []

    for r in result.get('records', []):
        rules.append({
            'id': r['Id'],
            'name': r['ValidationName'],
            'active': r['Active'],
            'description': r.get('Description') or ''
        })

    return jsonify({'rules': rules})


@app.route('/api/toggle-rule', methods=['POST'])
def toggle_rule():
    if 'access_token' not in session:
        return jsonify({'error': 'not authenticated'}), 401

    body = request.get_json()
    rule_id = body.get('id')
    new_status = body.get('active')

    token = session['access_token']
    base_url = session['instance_url']

    headers = {'Authorization': 'Bearer ' + token}
    get_resp = requests.get(
        base_url + '/services/data/v59.0/tooling/sobjects/ValidationRule/' + rule_id,
        headers=headers
    )

    if get_resp.status_code != 200:
        return jsonify({'success': False, 'error': 'could not fetch rule'}), 400

    rule_data = get_resp.json()
    metadata = rule_data.get('Metadata', {})
    metadata['active'] = new_status

    update_headers = {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    }

    update_resp = requests.patch(
        base_url + '/services/data/v59.0/tooling/sobjects/ValidationRule/' + rule_id,
        json={'Metadata': metadata},
        headers=update_headers
    )

    if update_resp.status_code == 204:
        return jsonify({'success': True})

    return jsonify({'success': False, 'error': update_resp.text}), 400


@app.route('/api/logout')
def logout():
    session.clear()
    return jsonify({'success': True})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
