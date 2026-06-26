import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const BASE_URL = 'http://localhost:5000';

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [rules, setRules] = useState([]);
  const [originalRules, setOriginalRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployDone, setDeployDone] = useState(false);
  const [message, setMessage] = useState('');
  const [showInfo, setShowInfo] = useState(true);
  const [activeTab, setActiveTab] = useState('Validation Rules');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const comingFromLogin = params.get('logged_in');
    if (comingFromLogin === 'true') {
      checkLoginStatus(true);
      window.history.replaceState({}, document.title, '/');
    } else {
      checkLoginStatus(false);
    }
  }, []);

  const checkLoginStatus = async (fromLogin) => {
    try {
      const res = await axios.get(BASE_URL + '/api/status', {
        withCredentials: true
      });
      if (res.data.logged_in) {
        setLoggedIn(true);
        if (res.data.user) setUserInfo(res.data.user);
        if (fromLogin) setShowRules(false);
      } else {
        setLoggedIn(false);
      }
    } catch (err) {
      setLoggedIn(false);
    }
    setChecked(true);
  };

  const handleLogin = () => {
    window.location.href = BASE_URL + '/login';
  };

  const handleLogout = async () => {
    await axios.get(BASE_URL + '/api/logout', { withCredentials: true });
    setLoggedIn(false);
    setUserInfo(null);
    setShowRules(false);
    setRules([]);
    setOriginalRules([]);
    setMessage('');
    setDeployDone(false);
  };

  const handleGetMetadata = () => {
    setShowRules(true);
    fetchRules();
  };

  const fetchRules = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.get(BASE_URL + '/api/validation-rules', {
        withCredentials: true
      });
      setRules(res.data.rules);
      setOriginalRules(JSON.parse(JSON.stringify(res.data.rules)));
    } catch (err) {
      setMessage('Could not fetch rules. Try again.');
    }
    setLoading(false);
  };

  const toggleRule = (id, current) => {
    setRules(rules.map(r =>
      r.id === id ? { ...r, active: !current } : r
    ));
  };

  const enableAll = () => {
    setRules(rules.map(r => ({ ...r, active: true })));
  };

  const disableAll = () => {
    setRules(rules.map(r => ({ ...r, active: false })));
  };

  const rollback = () => {
    setRules(JSON.parse(JSON.stringify(originalRules)));
    setMessage('');
  };

  const deployChanges = async () => {
    setDeploying(true);
    setDeployDone(false);
    setMessage('');
    try {
      for (let rule of rules) {
        await axios.post(
          BASE_URL + '/api/toggle-rule',
          { id: rule.id, active: rule.active },
          { withCredentials: true }
        );
      }
      setOriginalRules(JSON.parse(JSON.stringify(rules)));
      setDeploying(false);
      setDeployDone(true);
    } catch (err) {
      setDeploying(false);
      setMessage('Deploy failed. Please try again.');
    }
  };

  const tabs = ['Validation Rules', 'Workflows', 'Process Flows', 'Triggers'];

  if (!checked) return null;

  return (
    <div className="app">

      {deploying && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="modal-title">Processing</h3>
            <p className="modal-text">Deploying changes. Time will vary depending on number and type of components.</p>
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
        </div>
      )}

      {deployDone && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <h3 className="modal-title">Complete</h3>
              <span className="modal-close" onClick={() => setDeployDone(false)}>✕</span>
            </div>
            <div className="success-msg-box">
              All changes have been successfully deployed.
            </div>
            <div className="modal-footer">
              <button className="btn-close-modal" onClick={() => setDeployDone(false)}>
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="header">
        <div className="header-left">
          <div className="logo-box">
            <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
              <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
            </svg>
          </div>
          <h1>Salesforce Toolkit</h1>
        </div>
        <div className="header-right">
          {loggedIn && (
            <button className="btn-logout-top" onClick={handleLogout}>Logout</button>
          )}
        </div>
      </header>

      <div className="container">

        {!loggedIn && (
          <div className="login-card">
            <h2>Salesforce Switch</h2>
            <p>This tool provides an interface to easily enable and disable components in your Salesforce Org - Workflows, Triggers and Validation Rules. Very useful when doing data migrations and needing to disable certain automation.</p>
            <p style={{marginTop: '8px'}}>None of your organisation information or data is captured or kept from running this tool.</p>
            <div className="donate-box">Help keep Salesforce Switch free!</div>
            <div className="note-box">
              <strong>Note:</strong> This application uses multiple API calls to your Salesforce Org to retrieve metadata. Each Salesforce Org has a 24 hour limit of API calls it can make.
            </div>
            <div className="env-row">
              <label>Environment</label>
              <select>
                <option>Production</option>
                <option>Sandbox</option>
              </select>
              <button className="btn-login-orange" onClick={handleLogin}>LOGIN</button>
            </div>
          </div>
        )}

        {loggedIn && !showRules && (
          <div className="login-card">
            <h2>Salesforce Switch</h2>
            <p>This tool provides an interface to easily enable and disable components in your Salesforce Org.</p>
            <p style={{marginTop: '8px'}}>None of your organisation information or data is captured or kept from running this tool.</p>
            <h3 className="loggedin-heading">Logged in as:</h3>
            <table className="user-info-table">
              <tbody>
                <tr>
                  <td className="user-label">Username:</td>
                  <td className="user-value">{userInfo ? userInfo.username : 'sachinsaktiranjan179@gmail.com'}</td>
                </tr>
                <tr>
                  <td className="user-label">Organisation:</td>
                  <td className="user-value">{userInfo ? userInfo.org : 'Developer Edition'}</td>
                </tr>
              </tbody>
            </table>
            <div className="loggedin-btns">
              <button className="btn-orange" onClick={handleLogout}>LOGOUT</button>
              <button className="btn-orange" onClick={handleGetMetadata}>GET METADATA</button>
            </div>
          </div>
        )}

        {loggedIn && showRules && (
          <div>
            <h2 className="page-title">Salesforce Switch</h2>
            {showInfo && (
              <div className="info-box">
                <span className="close-info" onClick={() => setShowInfo(false)}>✕</span>
                Use the Off/On switches and the Enable All/Disable All buttons to specify what you want to activate and deactivate for your Org. Once ready, click Deploy to apply the changes to your Org.
              </div>
            )}
            <div className="user-email">
              {userInfo ? userInfo.username : 'sachinsaktiranjan179@gmail.com'} (Developer Edition)
            </div>
            <div className="tabs">
              {tabs.map(tab => (
                <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {tab}
                </button>
              ))}
            </div>
            <div className="deploy-row">
              <button className="btn-rollback" onClick={rollback}>ROLLBACK TO ORIGINAL</button>
              <button className="btn-deploy" onClick={deployChanges} disabled={deploying}>DEPLOY CHANGES</button>
            </div>

            {activeTab === 'Validation Rules' && (
              <div className="rules-card">
                <div className="rules-object-header">
                  <span className="rules-object-name">Account</span>
                  <div className="bulk-btns">
                    <button className="btn-enable-all" onClick={enableAll}>ENABLE ALL</button>
                    <button className="btn-disable-all" onClick={disableAll}>DISABLE ALL</button>
                  </div>
                </div>
                {loading ? (
                  <div className="empty-msg">Loading rules...</div>
                ) : rules.length === 0 ? (
                  <div className="empty-msg">No rules found.</div>
                ) : (
                  <table className="rules-table">
                    <tbody>
                      {rules.map(rule => (
                        <tr key={rule.id}>
                          <td className="rule-name">{rule.name}</td>
                          <td className="toggle-cell">
                            <div className="onoff-wrap" onClick={() => toggleRule(rule.id, rule.active)}>
                              <span className={`on-btn ${rule.active ? 'is-on' : 'is-off-side'}`}>ON</span>
                              <span className={`off-btn ${!rule.active ? 'is-off' : 'is-on-side'}`}>OFF</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {activeTab !== 'Validation Rules' && (
              <div className="rules-card">
                <div className="empty-msg">No {activeTab} found in your org.</div>
              </div>
            )}

            {message && <div className="msg error">{message}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
