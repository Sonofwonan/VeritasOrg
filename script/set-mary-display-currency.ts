import assert from "node:assert/strict";
import { pool } from "../server/db";

// Explicit one-off presentation change, never run by startup or post-merge setup.
async function main() {
  if (!process.argv.includes("--apply")) {
    throw new Error("Requires explicit --apply");
  }
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_currency TEXT NOT NULL DEFAULT 'CAD'");
    const { rows: owners } = await connection.query(
      "SELECT id FROM users WHERE client_ref=$1 AND name=$2 FOR UPDATE",
      ["VWMS2024", "Mary Scott"],
    );
    assert.equal(owners.length, 1, "Requires the existing fictional Mary profile");
    const id = owners[0].id;
    const { rows: accounts } = await connection.query(
      "SELECT id,balance,is_demo FROM accounts WHERE user_id=$1 ORDER BY id FOR UPDATE", [id],
    );
    assert(accounts.length > 0 && accounts.every(a => a.is_demo === true), "Only fictional test accounts may use this script");
    const fingerprint = async () => (await connection.query(`
      SELECT
        md5(COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM accounts a WHERE a.user_id=$1)::text,'[]')) AS accounts,
        md5(COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY t.id) FROM transactions t
          WHERE EXISTS (SELECT 1 FROM accounts a WHERE a.user_id=$1 AND
            (a.id=t.from_account_id OR a.id=t.to_account_id)))::text,'[]')) AS transactions
    `, [id])).rows[0];
    const before = await fingerprint();
    const otherCurrencies = await connection.query(
      "SELECT id,display_currency FROM users WHERE id<>$1 ORDER BY id", [id],
    );
    const updated = await connection.query(
      "UPDATE users SET display_currency=$1 WHERE id=$2 RETURNING display_currency", ["GBP", id],
    );
    assert.equal(updated.rowCount, 1);
    assert.equal(updated.rows[0].display_currency, "GBP");
    assert.deepEqual(await fingerprint(), before, "Account amounts and transaction history must remain unchanged");
    assert.deepEqual((await connection.query(
      "SELECT id,display_currency FROM users WHERE id<>$1 ORDER BY id", [id],
    )).rows, otherCurrencies.rows, "Other clients must remain unchanged");
    await connection.query("COMMIT");
    console.log("Mary's £ display preference saved. All balances, transactions and other clients are unchanged.");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

main().catch(() => {
  console.error("Currency preference update failed and was rolled back. No credentials or account payloads printed.");
  process.exitCode = 1;
}).finally(() => pool.end());
