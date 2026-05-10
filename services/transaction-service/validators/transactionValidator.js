function validateTransactionInput(data) {

  const errors = [];

  /**
   * VALID TRANSACTION TYPES
   */
  const validTypes = [
    "deposit",
    "withdraw",
    "internal",
    "imps",
    "neft",
    "rtgs"
  ];

  /**
   * AMOUNT CHECK
   */
  if (
    data.amount === undefined ||
    data.amount === null ||
    data.amount === ""
  ) {
    errors.push("Amount is required.");
  }

  /**
   * NUMBER CHECK
   */
  const amount = Number(data.amount);

  if (isNaN(amount)) {
    errors.push("Amount must be a valid number.");
  }

  /**
   * MIN AMOUNT
   */
  if (amount < 1) {
    errors.push(
      "Minimum transaction amount is ₹1."
    );
  }

  /**
   * MAX AMOUNT
   */
  if (amount > 1000000) {
    errors.push(
      "Maximum transaction amount is ₹10,00,000."
    );
  }

  /**
   * DECIMAL VALIDATION
   */
  const decimalRegex = /^\d+(\.\d{1,2})?$/;

  if (!decimalRegex.test(String(data.amount))) {
    errors.push(
      "Amount can have maximum 2 decimal places."
    );
  }

  /**
   * TRANSACTION TYPE
   */
  if (
    data.transaction_type &&
    !validTypes.includes(data.transaction_type)
  ) {
    errors.push("Invalid transaction type.");
  }

  /**
   * RTGS RULE
   */
  if (
    data.transaction_type === "rtgs" &&
    amount < 200000
  ) {
    errors.push(
      "RTGS minimum amount is ₹2,00,000."
    );
  }

  /**
   * WITHDRAW LIMIT
   */
  if (
    data.transaction_type === "withdraw" &&
    amount > 50000
  ) {
    errors.push(
      "Maximum withdrawal limit is ₹50,000."
    );
  }

  /**
   * IMPS LIMIT
   */
  if (
    data.transaction_type === "imps" &&
    amount > 500000
  ) {
    errors.push(
      "IMPS maximum limit is ₹5,00,000."
    );
  }

  /**
   * NEFT LIMIT
   */
  if (
    data.transaction_type === "neft" &&
    amount > 1000000
  ) {
    errors.push(
      "NEFT maximum limit is ₹10,00,000."
    );
  }

  /**
   * INTERNAL LIMIT
   */
  if (
    data.transaction_type === "internal" &&
    amount > 2000000
  ) {
    errors.push(
      "Internal transfer maximum limit is ₹20,00,000."
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = {
  validateTransactionInput,
};