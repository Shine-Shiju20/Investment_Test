import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { accountAPI } from '../api/api';
import LoadingSpinner from './LoadingSpinner';
import './Dashboard.css';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAccounts() {
      try {
        const res = await accountAPI.getMyAccounts();
        if (res.success) setAccounts(res.data || []);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAccounts();
  }, []);

  const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
  const totalAvailable = accounts.reduce((sum, acc) => sum + parseFloat(acc.available_balance || 0), 0);

  if (loading) return <LoadingSpinner text="Loading dashboard..." />;

  return (
    <div className="dashboard">
      {/* Welcome */}
      <div className="page-header">
        <h1>Welcome back, {currentUser?.full_name?.split(' ')[0]} </h1>
        <p>Here's your financial overview</p>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon primary">
            <i className="fas fa-wallet" />
          </div>
          <div className="stat-info">
            <p>Total Balance</p>
            <h3>₹{totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <span className="stat-change badge-success">
              <i className="fas fa-arrow-up" /> Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon accent">
            <i className="fas fa-money-bill-wave" />
          </div>
          <div className="stat-info">
            <p>Available Balance</p>
            <h3>₹{totalAvailable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h3>
            <span className="stat-change" style={{ color: 'var(--accent)' }}>Ready to use</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon success">
            <i className="fas fa-user-check" />
          </div>
          <div className="stat-info">
            <p>KYC Status</p>
            <h3 className="capitalize">{currentUser?.kyc_status || 'Pending'}</h3>
            <span className={`badge ${currentUser?.kyc_status === 'verified' ? 'badge-success' : 'badge-warning'}`}>
              {currentUser?.kyc_status === 'verified' ? 'Verified' : 'Action Required'}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon warning">
            <i className="fas fa-shield-alt" />
          </div>
          <div className="stat-info">
            <p>Account Status</p>
            <h3 className="capitalize">{currentUser?.status || 'Active'}</h3>
            <span className={`badge ${currentUser?.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
              {currentUser?.status || 'active'}
            </span>
          </div>
        </div>
      </div>

      {/* Accounts List */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2><i className="fas fa-university" /> Your Accounts</h2>
        </div>

        {accounts.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-piggy-bank" />
            <h3>No Active Accounts</h3>
            <p>Your accounts will appear here</p>
          </div>
        ) : (
          <div className="accounts-grid">
            {accounts.map((acc) => (
              <div key={acc.account_id} className="account-card-dash">
                <div className="acc-card-header">
                  <div className="acc-type-badge">
                    <i className={`fas ${acc.account_type === 'savings' ? 'fa-coins' : acc.account_type === 'current' ? 'fa-chart-line' : 'fa-wallet'}`} />
                    <span className="capitalize">{acc.account_type}</span>
                  </div>
                  <span className={`badge ${acc.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                    {acc.status}
                  </span>
                </div>

                <div className="acc-number">
                  <span className="acc-label">Account Number</span>
                  <span className="acc-value">{acc.account_number}</span>
                </div>

                <div className="acc-balance-row">
                  <div>
                    <span className="acc-label">Balance</span>
                    <span className="acc-amount">₹{parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="acc-label">IFSC</span>
                    <span className="acc-ifsc">{acc.ifsc_code}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Info */}
      <div className="dashboard-section">
        <div className="section-header">
          <h2><i className="fas fa-id-card" /> Account Holder</h2>
        </div>
        <div className="user-info-grid">
          <div className="info-item"><span className="info-label">Full Name</span><span className="info-value">{currentUser?.full_name}</span></div>
          <div className="info-item"><span className="info-label">Email</span><span className="info-value">{currentUser?.email}</span></div>
          <div className="info-item"><span className="info-label">Phone</span><span className="info-value">{currentUser?.phone}</span></div>
          <div className="info-item"><span className="info-label">Occupation</span><span className="info-value">{currentUser?.occupation}</span></div>
          <div className="info-item"><span className="info-label">Role</span><span className="info-value capitalize">{currentUser?.role}</span></div>
          <div className="info-item"><span className="info-label">Member Since</span><span className="info-value">{currentUser?.created_at ? new Date(currentUser.created_at).toLocaleDateString() : '—'}</span></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;