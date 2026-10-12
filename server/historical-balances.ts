import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { historyImportSchema, evidenceText, evidenceUnits, type HistoryImportInput, type HistoryPreview } from "@shared/history-import";
import { reconcileHistoricalBalances, type HistorySnapshot } from "./historical-balances-reconcile";

export class HistoricalBalanceError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const asDate = (value: unknown) => value == null ? null : new Date(value as string | Date).toISOString();

function normalizedInput(body: unknown): HistoryImportInput {
  const input = historyImportSchema.parse(body);
  return {
    ...input, start: asDate(input.start)!, end: asDate(input.end)!,
    openingBalance: evidenceText(evidenceUnits(input.openingBalance)),
    closingBalance: evidenceText(evidenceUnits(input.closingBalance)),
    source: { ...input.source, sha256: input.source.sha256.toLowerCase() },
    movements: input.movements.map(m => ({ ...m, occurredAt: asDate(m.occurredAt)!, delta: evidenceText(evidenceUnits(m.delta)) }))
      .sort((a, b) => a.sequence - b.sequence),
    nonPostingTransactions: [...input.nonPostingTransactions].sort((a, b) => a.transactionId - b.transactionId),
  };
}

async function readSnapshot(c: PoolClient, input: HistoryImportInput, locking = false): Promise<HistorySnapshot> {
  // An exact retry of an immutable accepted source is validated against that
  // source's original dates. New evidence must use the audited effective dates.
  const { rows: [retry] } = await c.query(`SELECT id FROM historical_balance_imports
    WHERE account_id=$1 AND fingerprint=$2`, [input.accountId,hash(input)]);
  const replay = retry?.id ?? null;
  const { rows: [account] } = await c.query(`
    SELECT id,user_id,account_number,account_type,display_name,balance::text,created_at,is_demo,
      EXISTS (SELECT 1 FROM fee_audit f WHERE f.actor='test_fixture'
        AND f.action='fictional_balance_history_authorized' AND f.detail->>'synthetic'='true'
        AND f.detail->>'accountId'=accounts.id::text AND f.detail->>'userId'=accounts.user_id::text
        AND f.detail->>'sourceSha256'=$2) AS fictional_history_authorized
    FROM accounts WHERE id=$1 AND EXISTS (SELECT 1 FROM users u WHERE u.id=accounts.user_id)
    ${locking ? "FOR UPDATE" : ""}`, [input.accountId,input.source.sha256]);
  if (!account || account.user_id !== input.userId) {
    throw new HistoricalBalanceError(404, "The account was not found for the selected owner.");
  }
  const ids = [...new Set([
    ...input.movements.flatMap(m => [m.transactionId, m.relatedTransactionId]),
    ...input.nonPostingTransactions.map(t => t.transactionId),
  ].filter((id): id is number => typeof id === "number"))];
  const { rows: transactions } = await c.query(`
    SELECT t.id,t.from_account_id,t.to_account_id,t.amount::text,t.status,t.cash_debit_deferred,
      CASE WHEN d.historical_import_id=$5::uuid THEN t.created_at ELSE COALESCE(d.effective_at,t.created_at) END AS created_at,t.is_demo
    FROM transactions t LEFT JOIN transaction_date_corrections d ON d.transaction_id=t.id
      AND d.account_id=$1 AND d.user_id=$6
    WHERE ((t.from_account_id=$1 OR t.to_account_id=$1) AND
      (CASE WHEN d.historical_import_id=$5::uuid THEN t.created_at ELSE COALESCE(d.effective_at,t.created_at) END) >= $2::timestamptz AND
      (CASE WHEN d.historical_import_id=$5::uuid THEN t.created_at ELSE COALESCE(d.effective_at,t.created_at) END) < $3::timestamptz)
      OR t.id=ANY($4::integer[]) ORDER BY t.id`,
      [input.accountId,input.start,input.end,ids,replay,input.userId]);
  // Include actual postings of backdated rows as well as chronological cash changes.
  const relevantIds = [...new Set([...ids,...transactions.map(t => t.id)])];
  const { rows: live } = await c.query(`
    SELECT id::text,transaction_id,balance_before::text,balance_after::text,posted_at
    FROM account_cash_changes WHERE account_id=$1 AND
      (transaction_id=ANY($4::integer[]) OR (posted_at >= $2::timestamptz AND posted_at < $3::timestamptz))
    ORDER BY id`, [input.accountId,input.start,input.end,relevantIds]);
  const { rows: previous } = await c.query(`
    SELECT i.id,
      CASE WHEN i.id=$2::uuid THEN i.start_at ELSE LEAST(i.start_at,MIN(d.effective_at)) END AS start_at,
      CASE WHEN i.id=$2::uuid THEN i.end_at ELSE GREATEST(i.end_at,MAX(d.effective_at)+interval '1 millisecond') END AS end_at,
      i.opening_balance::text,i.closing_balance::text,i.fingerprint
    FROM historical_balance_imports i LEFT JOIN transaction_date_corrections d ON d.historical_import_id=i.id
      AND d.account_id=i.account_id AND d.user_id=i.user_id
    WHERE i.account_id=$1 GROUP BY i.id ORDER BY start_at,i.id`, [input.accountId,replay]);
  const { rows: historical } = await c.query(`
    SELECT h.transaction_id,h.balance_after::text,
      CASE WHEN h.import_id=$3::uuid THEN h.occurred_at ELSE COALESCE(d.effective_at,h.occurred_at) END AS occurred_at
    FROM historical_balance_postings h LEFT JOIN transaction_date_corrections d
      ON d.transaction_id=h.transaction_id AND d.account_id=h.account_id AND d.historical_import_id=h.import_id
    WHERE h.account_id=$1 AND h.transaction_id=ANY($2::integer[]) ORDER BY h.id`, [input.accountId,relevantIds,replay]);
  return {
    account: { ...account, created_at: asDate(account.created_at)! },
    transactions: transactions.map(t => ({ ...t, created_at: asDate(t.created_at) })),
    live: live.map(p => ({ ...p, posted_at: asDate(p.posted_at)! })),
    previous: previous.map(p => ({ ...p, start_at: asDate(p.start_at)!, end_at: asDate(p.end_at)! })),
    historical: historical.map(p => ({ ...p, occurred_at: asDate(p.occurred_at)! })),
  };
}

export class HistoricalBalanceService {
  constructor(private pool: Pool) {}
  async preview(body: unknown): Promise<HistoryPreview> {
    const input = normalizedInput(body), fingerprint = hash(input);
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
      const snapshot = await readSnapshot(c, input);
      const result = reconcileHistoricalBalances(input,snapshot,fingerprint);
      if (Date.parse(input.end) > Date.now()) {
        result.issues.push({ code: "FUTURE_RANGE", message: "Historical evidence cannot cover future cash movements. Use an already documented closing boundary." });
        result.canApply = false;
        result.requiredRecords.push(result.issues[result.issues.length - 1].message);
      }
      const preview: HistoryPreview = {
        previewId: randomUUID(), canApply: result.canApply,
        account: { accountId: snapshot.account.id, accountNumber: snapshot.account.account_number,
          accountName: snapshot.account.display_name || snapshot.account.account_type },
        openingBalance: input.openingBalance, closingBalance: input.closingBalance,
        calculatedClosing: result.calculatedClosing, issues: result.issues, rows: result.rows,
        requiredRecords: result.requiredRecords,
      };
      await c.query(`INSERT INTO historical_balance_previews(id,account_id,input,fingerprint,snapshot_hash,result)
        VALUES($1,$2,$3::jsonb,$4,$5,$6::jsonb)`,
        [preview.previewId,input.accountId,JSON.stringify(input),fingerprint,hash(snapshot),JSON.stringify(preview)]);
      await c.query("COMMIT");
      return preview;
    } catch (error) { await c.query("ROLLBACK"); throw error; }
    finally { c.release(); }
  }

  async apply(previewId: string) {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      const { rows: [preview] } = await c.query("SELECT * FROM historical_balance_previews WHERE id=$1", [previewId]);
      if (!preview) throw new HistoricalBalanceError(404, "Preview not found. Review the source and create a new preview.");
      const input = normalizedInput(preview.input), fingerprint = hash(input);
      // Serialize imports on the account; genuine financial operations already lock it.
      // Never UPDATE the account, even for an evidence import.
      const snapshot = await readSnapshot(c,input,true);
      const prior = snapshot.previous.find(p => p.fingerprint === fingerprint);
      if (prior) {
        await c.query("COMMIT");
        return { applied: false, importId: prior.id, postingCount: input.movements.filter(m => m.kind === "transaction").length };
      }
      if (Date.now() - new Date(preview.created_at).getTime() > 30 * 60 * 1000) {
        throw new HistoricalBalanceError(409, "This preview has expired. Create a new preview before applying.");
      }
      if (!preview.result.canApply) throw new HistoricalBalanceError(409, "This preview has unresolved evidence gaps and cannot be applied.");
      if (fingerprint !== preview.fingerprint || hash(snapshot) !== preview.snapshot_hash) {
        throw new HistoricalBalanceError(409, "Account history changed after the preview. Review a new preview; nothing was applied.");
      }
      const result = reconcileHistoricalBalances(input,snapshot,fingerprint);
      if (!result.canApply) throw new HistoricalBalanceError(409, "The evidence no longer reconciles. Review a new preview; nothing was applied.");
      const importId = randomUUID();
      await c.query(`INSERT INTO historical_balance_imports
        (id,preview_id,account_id,user_id,start_at,end_at,opening_balance,closing_balance,fingerprint,source,posting_count,actor)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12)`,
        [importId,previewId,input.accountId,input.userId,input.start,input.end,input.openingBalance,input.closingBalance,
          fingerprint,JSON.stringify({ ...input.source, nonPostingTransactions: input.nonPostingTransactions }),
          result.postingCount,`Authenticated administrator; source reviewer: ${input.source.reviewedBy}`]);
      for (const row of result.rows) {
        const movement = input.movements.find(m => m.sequence === row.sequence)!;
        await c.query(`INSERT INTO historical_balance_postings
          (import_id,account_id,transaction_id,source_sequence,occurred_at,delta,balance_after,source_reference,kind,related_transaction_id)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [importId,input.accountId,row.transactionId,
            row.sequence,row.occurredAt,row.delta,row.balanceAfter,row.sourceReference,movement.kind,movement.relatedTransactionId ?? null]);
      }
      await c.query("COMMIT");
      return { applied: true, importId, postingCount: result.postingCount };
    } catch (error: any) {
      await c.query("ROLLBACK");
      if (error.code === "40001" || error.code === "23505") {
        throw new HistoricalBalanceError(409, "History changed or an import conflicted. Review a new preview; no partial evidence was saved.");
      }
      throw error;
    } finally { c.release(); }
  }

  async imports(accountId: number) {
    const { rows } = await this.pool.query(`SELECT id,account_id AS "accountId",start_at AS "start",
      end_at AS "end",opening_balance::text AS "openingBalance",closing_balance::text AS "closingBalance",
      source,posting_count AS "postingCount",actor,created_at AS "createdAt"
      FROM historical_balance_imports WHERE account_id=$1 ORDER BY created_at DESC,id`, [accountId]);
    return rows;
  }
}
