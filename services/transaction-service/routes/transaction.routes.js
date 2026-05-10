const express = require("express");
const router = express.Router();

// controller
const controller = require("../controllers/transactionController");

// middleware
const verifyTransactionPin = require("../../../shared/middlewares/pinMiddleware");

// 🔁 TRANSFER
router.post(
  "/transfer",
  verifyTransactionPin,
  controller.transfer
);

// 💰 DEPOSIT
router.post(
  "/deposit",
  verifyTransactionPin,
  controller.deposit
);

// 💸 WITHDRAW
router.post(
  "/withdraw",
  verifyTransactionPin,
  controller.withdraw
);

// 📊 ACCOUNT HISTORY
router.get(
  "/history/:account_id",
  controller.getHistory
);

// 📄 ALL USER TRANSACTIONS
router.get(
  "/all",
  controller.getAllTransactions
);

module.exports = router;