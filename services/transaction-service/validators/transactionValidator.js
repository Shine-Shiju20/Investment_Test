// services/transaction-service/validators/transactionValidator.js

const ACCOUNT_RULES = {
  savings: {
    minDeposit: 1000,
    maxBalance: 500000000, // ₹50 Crore
  },

  current: {
    minDeposit: 5000,
    maxBalance: null, // Unlimited
  },

  salary: {
    minDeposit: 0,
    maxBalance: null, // Unlimited
  },
};

/**
 * Validate amount format:
 * - Required
 * - Must be a valid number
 * - Greater than 0
 * - Maximum 2 decimal places
 * - Maximum single transaction ₹1 Crore
 */
function validateAmount(amount) {
  const errors = [];

  // Required
  if (amount === undefined || amount === null || amount === "") {
    errors.push("Amount is required.");
    return errors;
  }

  const amountStr = String(amount).trim();

  // Valid number format
  if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
    // If more than 2 decimals
    if (/^\d+\.\d{3,}$/.test(amountStr)) {
      errors.push("Maximum 2 decimal places allowed.");
    } else {
      errors.push("Only valid numbers are allowed.");
    }
    return errors;
  }

  const numericAmount = Number(amountStr);

  // Greater than 0
  if (numericAmount <= 0) {
    errors.push("Amount should be greater than 0.");
  }

  // Max single transaction = ₹1 Crore
  if (numericAmount > 10000000) {
    errors.push("Maximum single transaction limit is ₹1,00,00,000.");
  }

  return errors;
}

/**
 * Validate transfer / deposit / withdraw input
 */
function validateTransactionInput(data) {
  const errors = [];

  // Validate amount
  errors.push(...validateAmount(data.amount));

  // Transaction type validation (optional)
  const validTypes = [
    "deposit",
    "withdraw",
    "internal",
    "imps",
    "neft",
    "rtgs",
  ];

  if (
    data.transaction_type &&
    !validTypes.includes(data.transaction_type)
  ) {
    errors.push("Invalid transaction type.");
  }

  // RTGS minimum amount
  if (
    data.transaction_type === "rtgs" &&
    Number(data.amount) < 200000
  ) {
    errors.push("RTGS minimum amount is ₹2,00,000.");
  }

  // Deposit max limit
  if (
    data.transaction_type === "deposit" &&
    Number(data.amount) > 1000000
  ) {
    errors.push("Maximum deposit limit is ₹10,00,000.");
  }

  // Withdraw max limit
  if (
    data.transaction_type === "withdraw" &&
    Number(data.amount) > 50000
  ) {
    errors.push("Maximum withdrawal limit is ₹50,000.");
  }

  // IMPS max limit
  if (
    data.transaction_type === "imps" &&
    Number(data.amount) > 500000
  ) {
    errors.push("Maximum IMPS limit is ₹5,00,000.");
  }

  // NEFT max limit
  if (
    data.transaction_type === "neft" &&
    Number(data.amount) > 1000000
  ) {
    errors.push("Maximum NEFT limit is ₹10,00,000.");
  }

  // Internal transfer max limit
  if (
    data.transaction_type === "internal" &&
    Number(data.amount) > 2000000
  ) {
    errors.push("Maximum internal transfer limit is ₹20,00,000.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  ACCOUNT_RULES,
  validateAmount,
  validateTransactionInput,
};