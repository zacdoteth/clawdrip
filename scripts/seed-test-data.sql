-- ClawDrip Test Data Seeding
--
-- Seeds test CLAWDRIP balances for discount testing
-- Run this after schema.sql to set up test wallets

-- Test wallet with 175 CLAWDRIP (Gold Drip tier = 10% discount)
INSERT INTO clawdrip_balances (wallet_address, balance, total_earned, order_count)
VALUES ('0xtestwith175clawdrip', 175, 175, 5)
ON CONFLICT (wallet_address) DO UPDATE
SET balance = 175, total_earned = 175, order_count = 5;

-- Test wallet with 500 CLAWDRIP (Diamond Drip tier = 15% discount)
INSERT INTO clawdrip_balances (wallet_address, balance, total_earned, order_count)
VALUES ('0xtestwith500clawdrip', 500, 500, 15)
ON CONFLICT (wallet_address) DO UPDATE
SET balance = 500, total_earned = 500, order_count = 15;

-- Test wallet with 75 CLAWDRIP (Silver Drip tier = 5% discount)
INSERT INTO clawdrip_balances (wallet_address, balance, total_earned, order_count)
VALUES ('0xtestwith75clawdrip', 75, 75, 2)
ON CONFLICT (wallet_address) DO UPDATE
SET balance = 75, total_earned = 75, order_count = 2;

-- Test wallet with 0 CLAWDRIP (Base tier = 0% discount)
INSERT INTO clawdrip_balances (wallet_address, balance, total_earned, order_count)
VALUES ('0xtestwith0clawdrip', 0, 0, 0)
ON CONFLICT (wallet_address) DO UPDATE
SET balance = 0, total_earned = 0, order_count = 0;

-- Verify the insertions
SELECT
  wallet_address,
  balance,
  CASE
    WHEN balance >= 500 THEN 'Diamond Drip (15%)'
    WHEN balance >= 150 THEN 'Gold Drip (10%)'
    WHEN balance >= 50 THEN 'Silver Drip (5%)'
    ELSE 'Base (0%)'
  END as tier
FROM clawdrip_balances
WHERE wallet_address LIKE '0xtest%'
ORDER BY balance DESC;
