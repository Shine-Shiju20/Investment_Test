// services/transaction-service/services/transactionService.js

const { sequelize } = require("../../../shared/config/db");
const { Op } = require("sequelize");

const Account = require("../../account-service/models/account.model");
const Transaction = require("../models/transaction.model");
const User = require("../../user-service/models/user.model");

/**
 * ACCOUNT RULES
 */
const ACCOUNT_RULES = {
  savings: {
    minDeposit: 1000,
    maxBalance: 500000000, // ₹50 Crore
  },
  current: {
    minDeposit: 5000,
    maxBalance: null,
  },
  salary: {
    minDeposit: 0,
    maxBalance: null,
  },
};

/**
 * BLOCKED ACCOUNT STATUSES
 */
const BLOCKED_STATUSES = [
  "closed",
  "frozen",
  "blocked",
  "inactive",
  "suspended",
];

/**
 * SAFE ROUNDING
 */
function roundAmount(value) {
  return parseFloat(Number(value).toFixed(2));
}

/**
 * VALIDATE ACCOUNT OWNERSHIP AND STATUS
 */
function validateOwnership(account, userId) {
  if (!account) {
    throw new Error("Account not found.");
  }

  if (account.user_id !== userId) {
    throw new Error("Unauthorized access to this account.");
  }

  if (BLOCKED_STATUSES.includes(account.status)) {
    throw new Error(`Account is ${account.status}.`);
  }
}

/**
 * VALIDATE RECEIVER ACCOUNT STATUS
 */
function validateReceiverAccount(account) {
  if (!account) {
    throw new Error("Receiver account does not exist.");
  }

  if (BLOCKED_STATUSES.includes(account.status)) {
    throw new Error(`Receiver account is ${account.status}.`);
  }
}

/**
 * VALIDATE AMOUNT
 */
function validateAmount(amount) {
  if (amount === undefined || amount === null || amount === "") {
    throw new Error("Amount is required.");
  }

  const amountStr = String(amount).trim();

  // Only positive numbers with max 2 decimals
  if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
    if (/^\d+\.\d{3,}$/.test(amountStr)) {
      throw new Error("Maximum 2 decimal places allowed.");
    }
    throw new Error("Only valid numbers are allowed.");
  }

  const numericAmount = Number(amountStr);

  if (numericAmount <= 0) {
    throw new Error("Amount should be greater than 0.");
  }

  // Max single transaction = ₹1 Crore
  if (numericAmount > 10000000) {
    throw new Error("Maximum single transaction limit is ₹1,00,00,000.");
  }

  return roundAmount(numericAmount);
}

/**
 * GET RECIPIENT NAME FROM ACCOUNT
 */
async function getRecipientName(account, transaction) {
  if (!account) return "Unknown";

  const user = await User.findOne({
    where: {
      user_id: account.user_id,
    },
    transaction,
  });

  return user?.full_name || "Unknown";
}

/**
 * TRANSFER ORCHESTRATOR
 */
async function initiateTransfer(data) {
  switch (data.transaction_type) {
    case "internal":
      return processTransfer(data, "internal");

    case "imps":
      return processTransfer(data, "imps");

    case "neft":
      return processTransfer(data, "neft");

    case "rtgs":
      if (Number(data.amount) < 200000) {
        throw new Error("RTGS minimum amount is ₹2,00,000.");
      }
      return processTransfer(data, "rtgs");

    default:
      throw new Error("Invalid transaction type.");
  }
}

/**
 * COMMON TRANSFER LOGIC
 */
async function processTransfer(
  {
    from_account_number,
    to_account_number,
    amount,
    user_id,
  },
  transactionType
) {
  const t = await sequelize.transaction();

  try {
    amount = validateAmount(amount);

    // Fetch sender
    const sender = await Account.findOne({
      where: {
        account_number: from_account_number,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    validateOwnership(sender, user_id);

    // Fetch receiver
    const receiver = await Account.findOne({
      where: {
        account_number: to_account_number,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    validateReceiverAccount(receiver);

    // Prevent self transfer
    if (
      sender.account_number ===
      receiver.account_number
    ) {
      throw new Error("Self transfer is not allowed.");
    }

    // Sufficient balance
    if (
      roundAmount(sender.available_balance) <
      amount
    ) {
      throw new Error("Insufficient balance.");
    }

    // Minimum balance check
    const remainingBalance = roundAmount(
      Number(sender.available_balance) - amount
    );

    const minimumBalance = Number(
      sender.min_balance || 0
    );

    if (remainingBalance < minimumBalance) {
      throw new Error(
        `Minimum balance of ₹${minimumBalance} must be maintained.`
      );
    }

    // Savings max balance check
    if (
      receiver.account_type === "savings" &&
      ACCOUNT_RULES.savings.maxBalance !== null
    ) {
      const updatedBalance = roundAmount(
        Number(receiver.balance) + amount
      );

      if (
        updatedBalance >
        ACCOUNT_RULES.savings.maxBalance
      ) {
        throw new Error(
          "Savings account maximum balance exceeded."
        );
      }
    }

    // Recipient name
    const recipientName = await getRecipientName(
      receiver,
      t
    );

    // Debit sender
    sender.balance = roundAmount(
      Number(sender.balance) - amount
    );

    sender.available_balance = roundAmount(
      Number(sender.available_balance) - amount
    );

    // Credit receiver
    receiver.balance = roundAmount(
      Number(receiver.balance) + amount
    );

    receiver.available_balance = roundAmount(
      Number(receiver.available_balance) + amount
    );

    await sender.save({ transaction: t });
    await receiver.save({ transaction: t });

    // Create transaction
    const txn = await Transaction.create(
      {
        from_account_id: sender.account_id,
        to_account_id: receiver.account_id,
        recipient_name: recipientName,
        amount,
        transaction_type: transactionType,
        status: "success",
        reference_id: `TXN-${Date.now()}`,
      },
      {
        transaction: t,
      }
    );

    await t.commit();

    return txn;
  } catch (err) {
    await t.rollback();
    console.error("TRANSFER ERROR:", err.message);
    throw err;
  }
}

/**
 * DEPOSIT
 */
async function depositMoney({
  account_number,
  amount,
  user_id,
}) {
  const t = await sequelize.transaction();

  try {
    amount = validateAmount(amount);

    // Deposit max limit
    if (amount > 1000000) {
      throw new Error("Maximum deposit limit is ₹10,00,000.");
    }

    const account = await Account.findOne({
      where: {
        account_number,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    validateOwnership(account, user_id);

    // Savings max balance
    if (
      account.account_type === "savings" &&
      ACCOUNT_RULES.savings.maxBalance !== null
    ) {
      const updatedBalance = roundAmount(
        Number(account.balance) + amount
      );

      if (
        updatedBalance >
        ACCOUNT_RULES.savings.maxBalance
      ) {
        throw new Error(
          "Savings account maximum balance exceeded."
        );
      }
    }

    const recipientName = await getRecipientName(
      account,
      t
    );

    // Update balance
    account.balance = roundAmount(
      Number(account.balance) + amount
    );

    account.available_balance = roundAmount(
      Number(account.available_balance) + amount
    );

    await account.save({ transaction: t });

    const txn = await Transaction.create(
      {
        to_account_id: account.account_id,
        recipient_name: recipientName,
        amount,
        transaction_type: "deposit",
        status: "success",
        reference_id: `TXN-${Date.now()}`,
      },
      {
        transaction: t,
      }
    );

    await t.commit();

    return txn;
  } catch (err) {
    await t.rollback();
    console.error("DEPOSIT ERROR:", err.message);
    throw err;
  }
}

/**
 * WITHDRAW
 */
async function withdrawMoney({
  account_number,
  amount,
  user_id,
}) {
  const t = await sequelize.transaction();

  try {
    amount = validateAmount(amount);

    // Withdrawal max limit
    if (amount > 50000) {
      throw new Error("Maximum withdrawal limit is ₹50,000.");
    }

    const account = await Account.findOne({
      where: {
        account_number,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    validateOwnership(account, user_id);

    // Sufficient balance
    if (
      roundAmount(account.available_balance) <
      amount
    ) {
      throw new Error("Insufficient balance.");
    }

    // Minimum balance check
    const remainingBalance = roundAmount(
      Number(account.available_balance) - amount
    );

    const minimumBalance = Number(
      account.min_balance || 0
    );

    if (remainingBalance < minimumBalance) {
      throw new Error(
        `Minimum balance of ₹${minimumBalance} must be maintained.`
      );
    }

    const recipientName = await getRecipientName(
      account,
      t
    );

    // Update balance
    account.balance = roundAmount(
      Number(account.balance) - amount
    );

    account.available_balance = roundAmount(
      Number(account.available_balance) - amount
    );

    await account.save({ transaction: t });

    const txn = await Transaction.create(
      {
        from_account_id: account.account_id,
        recipient_name: recipientName,
        amount,
        transaction_type: "withdraw",
        status: "success",
        reference_id: `TXN-${Date.now()}`,
      },
      {
        transaction: t,
      }
    );

    await t.commit();

    return txn;
  } catch (err) {
    await t.rollback();
    console.error("WITHDRAW ERROR:", err.message);
    throw err;
  }
}

/**
 * HISTORY FOR ONE ACCOUNT
 */
async function getTransactionHistory(account_id) {
  return await Transaction.findAll({
    where: {
      [Op.or]: [
        { from_account_id: account_id },
        { to_account_id: account_id },
      ],
    },
    order: [["created_at", "DESC"]],
  });
}

/**
 * ALL USER TRANSACTIONS
 */
async function getMyTransactions(user_id) {
  const accounts = await Account.findAll({
    where: {
      user_id,
    },
  });

  const accountIds = accounts.map(
    (acc) => acc.account_id
  );

  if (accountIds.length === 0) {
    return [];
  }

  return await Transaction.findAll({
    where: {
      [Op.or]: [
        {
          from_account_id: {
            [Op.in]: accountIds,
          },
        },
        {
          to_account_id: {
            [Op.in]: accountIds,
          },
        },
      ],
    },
    order: [["created_at", "DESC"]],
  });
}

module.exports = {
  initiateTransfer,
  processTransfer,
  depositMoney,
  withdrawMoney,
  getTransactionHistory,
  getMyTransactions,
};