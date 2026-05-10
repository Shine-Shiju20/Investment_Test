import React, { useState, useEffect } from 'react';
import { accountAPI, transactionAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import './TransactionsPage.css';

const TransactionsPage = () => {

  const { showToast } = useAuth();

  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeTab, setActiveTab] = useState('transfer');

  // FORM
  const [formData, setFormData] = useState({
    source_account_id: '',
    target_account_number: '',
    amount: '',
    transaction_pin: '',
    transfer_type: 'imps',
    description: ''
  });

  /**
   * FETCH ACCOUNTS
   */
  const fetchAccounts = async () => {

    try {

      const res = await accountAPI.getMyAccounts();

      if (res.success) {

        setAccounts(res.data || []);

        if (res.data?.length > 0) {

          setFormData(prev => ({
            ...prev,
            source_account_id: res.data[0].account_id
          }));

          setSelectedAccountId(
            res.data[0].account_id
          );
        }
      }

    } catch (err) {

      showToast(
        'error',
        'Failed to load accounts'
      );

    } finally {

      setLoading(false);

    }
  };

  /**
   * FETCH HISTORY
   */
  const fetchHistory = async (accountId) => {

    if (!accountId) return;

    setHistoryLoading(true);

    try {

      const res =
        await transactionAPI.getHistory(accountId);

      if (res.success) {

        // ✅ FIXED
        setHistory(res.transactions || []);

      }

    } catch (err) {

      showToast(
        'error',
        'Failed to load transaction history'
      );

    } finally {

      setHistoryLoading(false);

    }
  };

  /**
   * INITIAL LOAD
   */
  useEffect(() => {
    fetchAccounts();
  }, []);

  /**
   * ACCOUNT CHANGE
   */
  useEffect(() => {

    if (selectedAccountId) {
      fetchHistory(selectedAccountId);
    }

  }, [selectedAccountId]);

  /**
   * INPUT CHANGE
   */
  const handleInputChange = (e) => {

    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * SUBMIT
   */
  const handleSubmit = async (e) => {

    e.preventDefault();

    setActionLoading(true);

    try {

      let res;

      // Selected account
      const selectedAccount = accounts.find(
        acc => acc.account_id === formData.source_account_id
      );

      if (!selectedAccount) {
        throw new Error('Selected account not found');
      }

      /**
       * TRANSFER
       */
      if (activeTab === 'transfer') {

        res = await transactionAPI.transfer({
          from_account_number:
            selectedAccount.account_number,

          to_account_number:
            formData.target_account_number,

          amount:
            parseFloat(formData.amount),

          transaction_type:
            formData.transfer_type,

          transaction_pin:
            formData.transaction_pin,

          description:
            formData.description
        });
      }

      /**
       * DEPOSIT
       */
      else if (activeTab === 'deposit') {

        res = await transactionAPI.deposit({
          account_number:
            selectedAccount.account_number,

          amount:
            parseFloat(formData.amount),

          transaction_pin:
            formData.transaction_pin
        });
      }

      /**
       * WITHDRAW
       */
      else if (activeTab === 'withdraw') {

        res = await transactionAPI.withdraw({
          account_number:
            selectedAccount.account_number,

          amount:
            parseFloat(formData.amount),

          transaction_pin:
            formData.transaction_pin
        });
      }

      /**
       * SUCCESS
       */
      if (res?.success) {

        showToast(
          'success',
          `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} successful!`
        );

        // Reset
        setFormData(prev => ({
          ...prev,
          target_account_number: '',
          amount: '',
          transaction_pin: '',
          description: ''
        }));

        // Refresh
        fetchAccounts();
        fetchHistory(formData.source_account_id);
      }

    } catch (err) {

      console.error(err);

      showToast(
        'error',
        err?.response?.data?.message ||
        err?.data?.message ||
        err?.message ||
        'Transaction failed'
      );

    } finally {

      setActionLoading(false);

    }
  };

  /**
   * LOADING
   */
  if (loading) {
    return (
      <LoadingSpinner
        text="Initializing transactions..."
      />
    );
  }

  return (

    <div className="transactions-page animate-fade">

      {/* HEADER */}
      <div className="page-header">

        <h1>Transactions</h1>

        <p>
          Transfer funds, deposit or withdraw money
        </p>

      </div>

      {/* TABS */}
      <div className="transaction-tabs">

        <button
          className={`tab-btn ${
            activeTab === 'transfer'
              ? 'active'
              : ''
          }`}
          onClick={() => setActiveTab('transfer')}
        >
          <i className="fas fa-exchange-alt" />
          Transfer
        </button>

        <button
          className={`tab-btn ${
            activeTab === 'deposit'
              ? 'active'
              : ''
          }`}
          onClick={() => setActiveTab('deposit')}
        >
          <i className="fas fa-arrow-down" />
          Deposit
        </button>

        <button
          className={`tab-btn ${
            activeTab === 'withdraw'
              ? 'active'
              : ''
          }`}
          onClick={() => setActiveTab('withdraw')}
        >
          <i className="fas fa-arrow-up" />
          Withdraw
        </button>

      </div>

      {/* GRID */}
      <div className="transactions-grid">

        {/* LEFT CARD */}
        <div className="transaction-card">

          <h2>
            <i className={`fas ${
              activeTab === 'transfer'
                ? 'fa-exchange-alt'
                : activeTab === 'deposit'
                ? 'fa-arrow-down'
                : 'fa-arrow-up'
            }`} />

            {activeTab.charAt(0).toUpperCase() +
              activeTab.slice(1)} Funds
          </h2>

          <form onSubmit={handleSubmit}>

            {/* ACCOUNT */}
            <div className="form-group">

              <label>Select Account</label>

              <select
                name="source_account_id"
                className="account-selector"
                value={formData.source_account_id}
                onChange={(e) => {

                  handleInputChange(e);

                  setSelectedAccountId(
                    e.target.value
                  );
                }}
                required
              >

                {accounts.map(acc => (

                  <option
                    key={acc.account_id}
                    value={acc.account_id}
                  >
                    {acc.account_number}
                    {' '}
                    ({acc.account_type})
                    {' '} - ₹
                    {parseFloat(acc.balance)
                      .toLocaleString()}
                  </option>

                ))}

              </select>

            </div>

            {/* TRANSFER FIELDS */}
            {activeTab === 'transfer' && (
              <>

                <div className="form-group">

                  <label>
                    Recipient Account Number
                  </label>

                  <input
                    type="text"
                    name="target_account_number"
                    className="input-field"
                    placeholder="Enter account number"
                    value={formData.target_account_number}
                    onChange={handleInputChange}
                    required
                  />

                </div>

                <div className="form-group">

                  <label>Transfer Type</label>

                  <select
                    name="transfer_type"
                    className="input-field"
                    value={formData.transfer_type}
                    onChange={handleInputChange}
                  >
                    <option value="internal">
                      Internal
                    </option>

                    <option value="imps">
                      IMPS
                    </option>

                    <option value="neft">
                      NEFT
                    </option>

                    <option value="rtgs">
                      RTGS
                    </option>

                  </select>

                </div>

              </>
            )}

            {/* AMOUNT */}
            <div className="form-group">

              <label>Amount (₹)</label>

              <input
                type="number"
                name="amount"
                className="input-field"
                placeholder="0.00"
                min="1"
                step="0.01"
                value={formData.amount}
                onChange={handleInputChange}
                required
              />

            </div>

            {/* DESCRIPTION */}
            {activeTab === 'transfer' && (

              <div className="form-group">

                <label>Description</label>

                <input
                  type="text"
                  name="description"
                  className="input-field"
                  placeholder="Rent, Food, etc."
                  value={formData.description}
                  onChange={handleInputChange}
                />

              </div>

            )}

            {/* PIN */}
            <div className="form-group">

              <label>Transaction PIN</label>

              <input
                type="password"
                name="transaction_pin"
                className="input-field"
                placeholder="Enter PIN"
                maxLength="6"
                value={formData.transaction_pin}
                onChange={handleInputChange}
                required
              />

              <p className="pin-hint">
                Enter your secure transaction PIN
              </p>

            </div>

            {/* BUTTON */}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={actionLoading}
            >

              {actionLoading
                ? <LoadingSpinner size="sm" text="" />
                : `Confirm ${
                    activeTab.charAt(0)
                      .toUpperCase() +
                    activeTab.slice(1)
                  }`
              }

            </button>

          </form>

        </div>

        {/* HISTORY */}
        <div className="history-card">

          <h2>
            <i className="fas fa-history" />
            Transaction Statement
          </h2>

          {historyLoading ? (

            <LoadingSpinner
              text="Loading transactions..."
            />

          ) : history.length === 0 ? (

            <p>No transactions found</p>

          ) : (

            <div className="history-table-container">

              <table className="history-table">

                <thead>

                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Recipient</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Reference</th>
                  </tr>

                </thead>

                <tbody>

                  {history.map((txn) => (

                    <tr key={txn.transaction_id}>

                      <td>
                        {new Date(
                          txn.created_at
                        ).toLocaleString()}
                      </td>

                      <td
                        style={{
                          textTransform: 'uppercase'
                        }}
                      >
                        {txn.transaction_type}
                      </td>

                      <td>
                        {txn.recipient_name || '-'}
                      </td>

                      <td
                        className={
                          txn.from_account_id === selectedAccountId
                            ? 'amount-debit'
                            : 'amount-credit'
                        }
                      >
                        {txn.from_account_id === selectedAccountId
                          ? '-'
                          : '+'}

                        ₹
                        {parseFloat(txn.amount)
                          .toLocaleString()}
                      </td>

                      <td>

                        <span
                          className={`transaction-status status-${txn.status}`}
                        >
                          {txn.status}
                        </span>

                      </td>

                      <td>
                        {txn.reference_id}
                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      </div>

    </div>
  );
};

export default TransactionsPage;