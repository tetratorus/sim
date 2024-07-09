const { v4: uuidv4 } = require('uuid');

// create a world sim for monte carlo simulation of a cryptocurrency protocol below:

// Example: user wants to spend ETH to mint a Solana NFT
// User gives us $5 of ETH
// We use our paymaster to mint Solana NFT, incurring $4 of gas fees
// Refund amount: $5 - $4 = $1. We refund $0.90 to the user in AUTH tokens, the remaining $0.10 just stays in the pool.

// AUTH ends up being an index (basket/exchange token) of tokens that has been spent as collateral.
// First we will support stablecoins: USDC, USDT, etc
// Subsequently other native tokens: ETH, MATIC, SOL, etc

// Any AUTH holder can claim from the collateral pool. 
// Example, if there’s $100 worth of native tokens in the pool and 100 AUTH issued, each AUTH can be burned to claim $1 worth of tokens from the collateral pool. 

// If somehow the collateral pool increases in value to $200 (maybe ETH & SOL goes up 2x), but no new AUTH has been issued (still only 100 AUTH), each AUTH can be burned to claim $2 worth of tokens from the collateral pool.
// All collateral is visible on-chain, so everyone can see how much is in the pool.
// All of the tokens in the collateral basket will be staked, and earn the yield, which goes back into the pool (which AUTH holders can claim from).
// In addition, fees earned through paymaster services / universal gas abstraction will also go back into the pool.

// User class
// variables to consider
// daily probability to make a txn
// balance in USDT
// balance in AUTH
// balance in ETH
// balance in SOL

const pool = {
  usdt: 1,
  eth: 0,
  sol: 0
}

function priceOracle(token) {
  if (token === 'usdt') {
    return 1;
  } else if (token === 'eth') {
    return 3200; // TODO: simulate price changes
  } else if (token === 'sol') {
    return 130; // TODO: simulate price changes
  } else if (token === 'auth') {
    let sum = 0;
    sum += pool['usdt'] * priceOracle('usdt');
    sum += pool['eth'] * priceOracle('eth');
    sum += pool['sol'] * priceOracle('sol');
    return sum / authBalance;
  }
}

function contributeToPool(token, amount) {
  const dollarContribution = amount * priceOracle(token);
  const poolValue = pool['usdt'] * priceOracle('usdt') + pool['eth'] * priceOracle('eth') + pool['sol'] * priceOracle('sol');
  
  const authToIssue = dollarContribution / (poolValue + dollarContribution) * authBalance;
  authBalance += authToIssue;
  pool[token] += amount;
  return authToIssue;
}

let authBalance = 1;

const MIN_DAILY_TXNS = 0.03; // approximately 1 txn per month
const MAX_DAILY_TXNS = 1.5; // approximately 45 txns per month
 
function genUserBalance() {
  const SINGLE_CURRENCY_USER_PROBABILITY = 0.9;
  const SINGLE_CURRENCY_USER_MIN_BALANCE = 10;
  const SINGLE_CURRENCY_USER_MAX_BALANCE = 1000;
  const USDT_ONLY = 0.5;
  const ETH_ONLY = 0.25;
  const SOL_ONLY = 0.25;

  const MULTI_CURRENCY_USER_MIN_BALANCE = 50;
  const MULTI_CURRENCY_USER_MAX_BALANCE = 10000;
  const RATIO_USDT = 0.5;
  const RATIO_ETH = 0.25;
  const RATIO_SOL = 0.25;

  if (Math.random() < SINGLE_CURRENCY_USER_PROBABILITY) {
    if (Math.random() < USDT_ONLY) {
      return {
        usdt: Math.random() * (SINGLE_CURRENCY_USER_MAX_BALANCE - SINGLE_CURRENCY_USER_MIN_BALANCE) + SINGLE_CURRENCY_USER_MIN_BALANCE,
        eth: 0,
        sol: 0
      }
    } else if (Math.random() < ETH_ONLY) {
      return {
        usdt: 0,
        eth: (Math.random() * (SINGLE_CURRENCY_USER_MAX_BALANCE - SINGLE_CURRENCY_USER_MIN_BALANCE) + SINGLE_CURRENCY_USER_MIN_BALANCE) / priceOracle('eth'),
        sol: 0
      }
    } else {
      return {
        usdt: 0,
        eth: 0,
        sol: (Math.random() * (SINGLE_CURRENCY_USER_MAX_BALANCE - SINGLE_CURRENCY_USER_MIN_BALANCE) + SINGLE_CURRENCY_USER_MIN_BALANCE) / priceOracle('sol')
      }
    }
  } else {
    const totalBalance = Math.random() * (MULTI_CURRENCY_USER_MAX_BALANCE - MULTI_CURRENCY_USER_MIN_BALANCE) + MULTI_CURRENCY_USER_MIN_BALANCE;
    const usdt = totalBalance * RATIO_USDT;
    const eth = totalBalance * RATIO_ETH / priceOracle('eth');
    const sol = totalBalance * RATIO_SOL / priceOracle('sol');
    return {
      usdt,
      eth,
      sol
    }
  }
}

class User {
  constructor({dailyTxns, usdt, auth, eth, sol}) {
    this.id = uuidv4();
    this.usdt = usdt;
    this.auth = auth;
    this.eth = eth;
    this.sol = sol;
    this.dailyTxns = dailyTxns || Math.random() * (MAX_DAILY_TXNS - MIN_DAILY_TXNS) + MIN_DAILY_TXNS;
  }
}

const allUsers = {};

let startTime = process.hrtime();
function t() {
  const currentTime = process.hrtime(startTime);
  const durationS = currentTime[0] + currentTime[1] / 1e9;
  console.log(`${durationS.toFixed(2)}`);
}

function newUsersPerDay(day) {
  // assume constant for now
  return 10000;
}

function pickTokenToSpend(user) {
  // assume random for now, if min balance is met
  const tokens = [];
  if (user.usdt > 5) {
    tokens.push('usdt');
  }
  if (user.eth > 0.01) {
    tokens.push('eth');
  }
  if (user.sol > 0.01) {
    tokens.push('sol');
  }
  if (user.auth > 10) {
    tokens.push('auth');
  }
  return tokens[Math.floor(Math.random() * tokens.length)];
}

function topup(user) {
  // assume only topup USDT for now
  user.usdt += 50;
  totalTopups++;
}

function deductGasFee(user, token, gasFee, actualGasFee) {

  const tokenAmount = gasFee / priceOracle(token);
  user[token] -= tokenAmount;
  const maxOvercharge = gasFee - actualGasFee;
  const minOvercharge = 0;
  const refundAmount = Math.random() * (maxOvercharge - minOvercharge) + minOvercharge;
  const authToIssue = contributeToPool(token, refundAmount / priceOracle(token));
  user.auth += authToIssue * (1 - REFUND_TAX);
}

const DAYS_TO_SIM = 30;
const MIN_GAS_FEE_USD = 0.1;
const MAX_GAS_FEE_USD = 1;
const GAS_FEE_MULTIPLE = 2;
const MIN_ADDITIONAL_FEE_USD = 0.2;
const REFUND_TAX = 0.1; // assume we only return 90% of the refund to the user

// counters
let totalTransactions = 0;
let totalTopups = 0;

// world sim
function main() {
  t();

  // simulate days
  for (let day = 0; day < DAYS_TO_SIM; day++) {
    // create new users
    const numNewUsers = newUsersPerDay(day);
    for (let i = 0; i < numNewUsers; i++) {
      const user = new User({
        ...genUserBalance(),
        auth: 0,
      });
      allUsers[user.id] = user;
    }

    // simulate transactions
    for (const userId in allUsers) {
      const user = allUsers[userId];
      // check if user will make a transaction
      // multiply dailyTxn by day - 1 and compare to day, if ones place increments, we do a txn
      const prevTxns = Math.floor(user.dailyTxns * day);
      const currTxns = Math.floor(user.dailyTxns * (day + 1));
      if (currTxns === prevTxns) {
        // user will not make a txn today
        continue;
      }

      // pick a token to spend
      const token = pickTokenToSpend(user);
      if (!token) {
        // user does not have enough currency, so they topup
        topup(user);

        // user does not make a txn today
        continue;
      }

      // user has enough currency to spend
      const actualGasFee = Math.random() * (MAX_GAS_FEE_USD - MIN_GAS_FEE_USD) + MIN_GAS_FEE_USD;
      let gasFee = actualGasFee * GAS_FEE_MULTIPLE;
      
      if ((gasFee - actualGasFee) < MIN_ADDITIONAL_FEE_USD) {
        gasFee = actualGasFee + MIN_ADDITIONAL_FEE_USD;
      }

      // transaction
      deductGasFee(user, token, gasFee, actualGasFee);
      totalTransactions++;
    }

    // log every 10 days
    if ((day + 1) % 30 === 0) {
      // total users
      console.log(`Day ${day + 1}: ${Object.keys(allUsers).length} users`);

      // total txns
      console.log(`Total txns: ${totalTransactions}`);

      // total auth issued
      console.log(`Total AUTH issued: ${authBalance}`);

      // auth price
      console.log(`AUTH price: $${priceOracle('auth').toFixed(2)}`);

      // calculate pool value
      const poolValue = pool['usdt'] * priceOracle('usdt') + pool['eth'] * priceOracle('eth') + pool['sol'] * priceOracle('sol');
      console.log(`Pool value: $${poolValue.toFixed(2)}`);
    }

  }

  t();
}

main();
