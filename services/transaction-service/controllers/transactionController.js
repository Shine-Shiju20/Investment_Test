const {
  initiateTransfer,
  depositMoney,
  withdrawMoney,
  getTransactionHistory,
  getMyTransactions,
} = require("../services/transactionService");

const {
  validateTransactionInput,
} = require("../validators/transactionValidator");

/**
 * 🔁 TRANSFER
 */
async function transfer(req, res) {
  try {

    const { valid, errors } =
      validateTransactionInput(req.body);

    if (!valid) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    const {
      from_account_number,
      to_account_number,
      amount,
      transaction_type,
    } = req.body;

    const txn = await initiateTransfer({
      from_account_number,
      to_account_number,
      amount: Number(amount),
      transaction_type,
      user_id: req.user.user_id,
    });

    return res.status(200).json({
      success: true,
      message: "Transfer successful",
      transaction: txn,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message,
    });

  }
}

/**
 * 💰 DEPOSIT
 */
async function deposit(req, res) {
  try {

    const { account_number, amount } = req.body;

    const txn = await depositMoney({
      account_number,
      amount: Number(amount),
      user_id: req.user.user_id,
    });

    return res.json({
      success: true,
      message: "Deposit successful",
      transaction: txn,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }
}

/**
 * 💸 WITHDRAW
 */
async function withdraw(req, res) {
  try {

    const { account_number, amount } = req.body;

    const txn = await withdrawMoney({
      account_number,
      amount: Number(amount),
      user_id: req.user.user_id,
    });

    return res.json({
      success: true,
      message: "Withdrawal successful",
      transaction: txn,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }
}

/**
 * 📊 ACCOUNT HISTORY
 */
async function getHistory(req, res) {
  try {

    const { account_id } = req.params;

    const data =
      await getTransactionHistory(account_id);

    return res.json({
      success: true,
      transactions: data,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }
}

/**
 * 📄 ALL USER TRANSACTIONS
 */
async function getAllTransactions(req, res) {
  try {

    const data = await getMyTransactions(
      req.user.user_id
    );

    return res.json({
      success: true,
      transactions: data,
    });

  } catch (err) {

    return res.status(500).json({
      success: false,
      message: err.message,
    });

  }
}

module.exports = {
  transfer,
  deposit,
  withdraw,
  getHistory,
  getAllTransactions,
};