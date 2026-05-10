const { sequelize } = require("../../../shared/config/db");

const Account = require("../../account-service/models/account.model");
const Transaction = require("../models/transaction.model");
const User = require("../../user-service/models/user.model");

const { Op } = require("sequelize");

/**
 * 🏦 ACCOUNT RULES
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
 * 🔐 OWNERSHIP VALIDATION
 */
async function validateOwnership(account, user_id) {

  if (!account) {
    throw new Error("Account not found.");
  }

  if (account.user_id !== user_id) {
    throw new Error(
      "Unauthorized access to this account."
    );
  }

  if (
    ["closed", "frozen", "blocked", "inactive"]
      .includes(account.status)
  ) {
    throw new Error(
      `Account is ${account.status}.`
    );
  }
}

/**
 * 💰 SAFE ROUNDING
 */
function roundAmount(value) {

  return parseFloat(
    Number(value).toFixed(2)
  );
}

/**
 * 🔢 VALIDATE AMOUNT
 */
function validateAmount(amount) {

  if (
    amount === undefined ||
    amount === null ||
    amount === ""
  ) {
    throw new Error(
      "Amount is required."
    );
  }

  if (isNaN(amount)) {
    throw new Error(
      "Invalid amount."
    );
  }

  amount = roundAmount(amount);

  if (amount <= 0) {
    throw new Error(
      "Amount must be greater than 0."
    );
  }

  /**
   * MAX 2 DECIMALS
   */
  const decimalRegex =
    /^\d+(\.\d{1,2})?$/;

  if (
    !decimalRegex.test(
      String(amount)
    )
  ) {
    throw new Error(
      "Amount can have maximum 2 decimal places."
    );
  }

  /**
   * MAX SINGLE TXN
   */
  if (amount > 10000000) {
    throw new Error(
      "Maximum single transaction limit is ₹1 crore."
    );
  }

  return amount;
}

/**
 * 🔥 TRANSFER ORCHESTRATOR
 */
async function initiateTransfer(data) {

  switch (data.transaction_type) {

    case "internal":
      return processInternalTransfer(data);

    case "imps":
      return processIMPS(data);

    case "neft":
      return processNEFT(data);

    case "rtgs":
      return processRTGS(data);

    default:
      throw new Error(
        "Invalid transaction type"
      );
  }
}

/**
 * ✅ INTERNAL TRANSFER
 */
async function processInternalTransfer({
  from_account_number,
  to_account_number,
  amount,
  user_id
}) {

  const t = await sequelize.transaction();

  try {

    /**
     * VALIDATE AMOUNT
     */
    amount = validateAmount(amount);

    /**
     * SENDER
     */
    const sender = await Account.findOne({

      where: {
        account_number:
          from_account_number
      },

      transaction: t,

      lock: t.LOCK.UPDATE,
    });

    /**
     * RECEIVER
     */
    const receiver = await Account.findOne({

      where: {
        account_number:
          to_account_number
      },

      transaction: t,

      lock: t.LOCK.UPDATE,
    });

    /**
     * VALIDATE OWNER
     */
    await validateOwnership(
      sender,
      user_id
    );

    /**
     * RECEIVER EXISTS
     */
    if (!receiver) {
      throw new Error(
        "Receiver account does not exist."
      );
    }

    /**
     * BLOCK RECEIVER STATUS
     */
    if (
      ["closed", "frozen", "blocked", "inactive"]
        .includes(receiver.status)
    ) {
      throw new Error(
        `Receiver account is ${receiver.status}.`
      );
    }

    /**
     * BLOCK SELF TRANSFER
     */
    if (
      sender.account_number ===
      receiver.account_number
    ) {
      throw new Error(
        "Self transfer is not allowed."
      );
    }

    /**
     * SUFFICIENT BALANCE
     */
    if (
      roundAmount(
        sender.available_balance
      ) < amount
    ) {
      throw new Error(
        "Insufficient balance."
      );
    }

    /**
     * MINIMUM BALANCE CHECK
     */
    const remainingBalance =
      roundAmount(
        Number(sender.available_balance) -
        amount
      );

    const minimumBalance =
      Number(sender.min_balance || 0);

    if (
      remainingBalance <
      minimumBalance
    ) {
      throw new Error(
        `Minimum balance of ₹${minimumBalance} must be maintained.`
      );
    }

    /**
     * SAVINGS MAX BALANCE
     */
    if (
      receiver.account_type ===
      "savings"
    ) {

      const updatedBalance =
        roundAmount(
          Number(receiver.balance) +
          amount
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

    /**
     * RECEIVER USER
     */
    const receiverUser =
      await User.findOne({

        where: {
          user_id:
            receiver.user_id
        },

        transaction: t,
      });

    /**
     * RECIPIENT NAME
     */
    const recipientName =
      receiverUser?.full_name ||
      "Unknown";

    /**
     * EXACT DEBIT
     */
    sender.balance =
      roundAmount(
        Number(sender.balance) -
        amount
      );

    sender.available_balance =
      roundAmount(
        Number(sender.available_balance) -
        amount
      );

    /**
     * EXACT CREDIT
     */
    receiver.balance =
      roundAmount(
        Number(receiver.balance) +
        amount
      );

    receiver.available_balance =
      roundAmount(
        Number(receiver.available_balance) +
        amount
      );

    /**
     * SAVE ACCOUNTS
     */
    await sender.save({
      transaction: t
    });

    await receiver.save({
      transaction: t
    });

    /**
     * CREATE TXN
     */
    const txn =
      await Transaction.create(

        {
          from_account_id:
            sender.account_id,

          to_account_id:
            receiver.account_id,

          recipient_name:
            recipientName,

          amount,

          transaction_type:
            "internal",

          status:
            "success",

          reference_id:
            `TXN-${Date.now()}`
        },

        {
          transaction: t
        }
      );

    /**
     * COMMIT
     */
    await t.commit();

    return txn;

  } catch (err) {

    /**
     * ROLLBACK
     */
    await t.rollback();

    console.error(
      "TRANSFER ERROR:",
      err
    );

    throw err;
  }
}

/**
 * ⚡ IMPS
 */
async function processIMPS(data) {

  const txn =
    await processInternalTransfer(data);

  txn.transaction_type = "imps";

  await txn.save();

  return txn;
}

/**
 * 🕒 NEFT
 */
async function processNEFT(data) {

  await new Promise(resolve =>
    setTimeout(resolve, 2000)
  );

  const txn =
    await processInternalTransfer(data);

  txn.transaction_type = "neft";

  await txn.save();

  return txn;
}

/**
 * 💰 RTGS
 */
async function processRTGS(data) {

  if (data.amount < 200000) {

    throw new Error(
      "RTGS requires minimum ₹2,00,000"
    );
  }

  const txn =
    await processInternalTransfer(data);

  txn.transaction_type = "rtgs";

  await txn.save();

  return txn;
}

/**
 * 💰 DEPOSIT
 */
async function depositMoney({
  account_number,
  amount,
  user_id
}) {

  const t = await sequelize.transaction();

  try {

    /**
     * VALIDATE AMOUNT
     */
    amount =
      validateAmount(amount);

    /**
     * LIMIT
     */
    if (amount > 1000000) {
      throw new Error(
        "Maximum deposit limit is ₹10,00,000."
      );
    }

    /**
     * ACCOUNT
     */
    const account =
      await Account.findOne({

        where: {
          account_number
        },

        transaction: t,

        lock: t.LOCK.UPDATE,
      });

    /**
     * VALIDATE OWNER
     */
    await validateOwnership(
      account,
      user_id
    );

    /**
     * SAVINGS MAX BALANCE
     */
    if (
      account.account_type ===
      "savings"
    ) {

      const updatedBalance =
        roundAmount(
          Number(account.balance) +
          amount
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

    /**
     * USER
     */
    const user =
      await User.findOne({

        where: {
          user_id:
            account.user_id
        },

        transaction: t,
      });

    /**
     * EXACT CREDIT
     */
    account.balance =
      roundAmount(
        Number(account.balance) +
        amount
      );

    account.available_balance =
      roundAmount(
        Number(account.available_balance) +
        amount
      );

    /**
     * SAVE
     */
    await account.save({
      transaction: t
    });

    /**
     * TRANSACTION
     */
    const txn =
      await Transaction.create(

        {
          to_account_id:
            account.account_id,

          recipient_name:
            user?.full_name ||
            "Self",

          amount,

          transaction_type:
            "deposit",

          status:
            "success",

          reference_id:
            `TXN-${Date.now()}`
        },

        {
          transaction: t
        }
      );

    await t.commit();

    return txn;

  } catch (err) {

    await t.rollback();

    console.error(
      "DEPOSIT ERROR:",
      err
    );

    throw err;
  }
}

/**
 * 💸 WITHDRAW
 */
async function withdrawMoney({
  account_number,
  amount,
  user_id
}) {

  const t = await sequelize.transaction();

  try {

    /**
     * VALIDATE AMOUNT
     */
    amount =
      validateAmount(amount);

    /**
     * LIMIT
     */
    if (amount > 50000) {
      throw new Error(
        "Maximum withdrawal limit is ₹50,000."
      );
    }

    /**
     * ACCOUNT
     */
    const account =
      await Account.findOne({

        where: {
          account_number
        },

        transaction: t,

        lock: t.LOCK.UPDATE,
      });

    /**
     * VALIDATE OWNER
     */
    await validateOwnership(
      account,
      user_id
    );

    /**
     * BALANCE CHECK
     */
    if (
      roundAmount(
        account.available_balance
      ) < amount
    ) {
      throw new Error(
        "Insufficient balance."
      );
    }

    /**
     * MINIMUM BALANCE
     */
    const remainingBalance =
      roundAmount(
        Number(account.available_balance) -
        amount
      );

    const minimumBalance =
      Number(account.min_balance || 0);

    if (
      remainingBalance <
      minimumBalance
    ) {
      throw new Error(
        `Minimum balance of ₹${minimumBalance} must be maintained.`
      );
    }

    /**
     * USER
     */
    const user =
      await User.findOne({

        where: {
          user_id:
            account.user_id
        },

        transaction: t,
      });

    /**
     * EXACT DEBIT
     */
    account.balance =
      roundAmount(
        Number(account.balance) -
        amount
      );

    account.available_balance =
      roundAmount(
        Number(account.available_balance) -
        amount
      );

    /**
     * SAVE
     */
    await account.save({
      transaction: t
    });

    /**
     * TRANSACTION
     */
    const txn =
      await Transaction.create(

        {
          from_account_id:
            account.account_id,

          recipient_name:
            user?.full_name ||
            "Self",

          amount,

          transaction_type:
            "withdraw",

          status:
            "success",

          reference_id:
            `TXN-${Date.now()}`
        },

        {
          transaction: t
        }
      );

    await t.commit();

    return txn;

  } catch (err) {

    await t.rollback();

    console.error(
      "WITHDRAW ERROR:",
      err
    );

    throw err;
  }
}

/**
 * 📊 HISTORY
 */
async function getTransactionHistory(
  account_id
) {

  return await Transaction.findAll({

    where: {

      [Op.or]: [

        {
          from_account_id:
            account_id
        },

        {
          to_account_id:
            account_id
        }
      ]
    },

    order: [
      ["created_at", "DESC"]
    ],
  });
}

/**
 * 📄 ALL USER TXNS
 */
async function getMyTransactions(
  user_id
) {

  const accounts =
    await Account.findAll({

      where: {
        user_id
      }
    });

  const accountIds =
    accounts.map(
      acc => acc.account_id
    );

  return await Transaction.findAll({

    where: {

      [Op.or]: [

        {
          from_account_id:
            accountIds
        },

        {
          to_account_id:
            accountIds
        }
      ]
    },

    order: [
      ["created_at", "DESC"]
    ],
  });
}

module.exports = {
  initiateTransfer,
  processInternalTransfer,
  processIMPS,
  processNEFT,
  processRTGS,
  depositMoney,
  withdrawMoney,
  getTransactionHistory,
  getMyTransactions,
};