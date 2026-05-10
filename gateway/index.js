// /gateway/index.js

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

/**
 * CORS
 */
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

/**
 * DB
 */
const { sequelize } = require("../shared/config/db");

/**
 * IMPORT MODELS
 */
require("../services/user-service/models/user.model");
require("../services/account-service/models/account.model");
require("../services/auth-service/models/session.model");
require("../services/auth-service/models/emailOtp.model");
require("../services/audit-service/models/auditLog.model");
require("../services/loan-service/models/loan.model");

require("../services/investment-service/models/investmentProduct.model");
require("../services/investment-service/models/portfolio.model");
require("../services/investment-service/models/holding.model");
require("../services/investment-service/models/investmentTransaction.model");
require("../services/investment-service/models/navHistory.model");

require("../services/transaction-service/models/transaction.model");

/**
 * AUTH
 */
const {
  authenticateToken,
} = require("../shared/middlewares/authMiddleware");

/**
 * ROUTES
 */
const authRoutes = require("./Routes/auth.routes");

const userRoutes = require("./Routes/user.routes");

const accountRoutes = require(
  "../services/account-service/routes/account.routes"
);

const transactionRoutes = require(
  "../services/transaction-service/routes/transaction.routes"
);

const loanRoutes = require(
  "../services/loan-service/routes/loan.routes"
);

const investmentRoutes = require(
  "../services/investment-service/routes/investment.routes"
);

const creditCardRoutes = require(
  "../services/credit-card-service/routes/creditCard.routes"
);

/**
 * MIDDLEWARES
 */
app.use(express.json());

app.use(cookieParser());

/**
 * ROUTES
 */
app.use("/auth", authRoutes);

app.use(
  "/user",
  authenticateToken,
  userRoutes
);

app.use(
  "/accounts",
  authenticateToken,
  accountRoutes
);

app.use(
  "/transactions",
  authenticateToken,
  transactionRoutes
);

app.use(
  "/loans",
  authenticateToken,
  loanRoutes
);

app.use(
  "/credit-cards",
  authenticateToken,
  creditCardRoutes
);

app.use(
  "/investments",
  authenticateToken,
  investmentRoutes
);

/**
 * INITIALIZE JOBS
 */
const {
  initializeJobs
} = require("../services/loan-service/index");

initializeJobs();

const {
  initializeJobs: initializeInvestmentJobs,
} = require("../services/investment-service/index");

initializeInvestmentJobs();

/**
 * DATABASE CONNECTION
 * IMPORTANT:
 * DO NOT USE alter:true
 */
sequelize
  .authenticate()
  .then(() => {

    console.log(
      "Database connected successfully."
    );

    const PORT =
      process.env.PORT || 5000;

    app.listen(PORT, () => {

      console.log(
        `Gateway running on port ${PORT}`
      );

    });

  })
  .catch((error) => {

    console.error(
      "Database connection failed:",
      error
    );

  });