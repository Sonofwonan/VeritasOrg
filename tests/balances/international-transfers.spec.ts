import { test, expect, login } from "./fixtures";

const destination = {
  institutionName: "Synthetic International Custodian",
  institutionCountry: "SG",
  institutionAccountNumber: "SYNTHETIC-PORTFOLIO-1",
  destinationDetails: "Synthetic branch\nRouting reference supplied by client for review",
  accountType: "Full Portfolio",
  transferType: "in-kind",
  transferScope: "full-portfolio",
  accountHolderType: "own",
};

async function clearDebt(db: any, identity: any) {
  await db.query("UPDATE accounts SET balance=0 WHERE id=$1", [identity.debt]);
  await db.query("UPDATE fee_assessments SET status='paid' WHERE id=$1", [identity.assessment]);
}

async function finances(db: any, userId: number) {
  const accounts = (await db.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id", [userId])).rows;
  const investments = (await db.query("SELECT * FROM investments WHERE account_id=ANY($1::int[]) ORDER BY id", [accounts.map((a: any) => a.id)])).rows;
  const transactions = (await db.query("SELECT * FROM transactions WHERE from_account_id=ANY($1::int[]) OR to_account_id=ANY($1::int[]) ORDER BY id", [accounts.map((a: any) => a.id)])).rows;
  return { accounts, investments, transactions };
}

test("unlisted international destination reaches client history and administrator review without posting cash", async ({ page, db, identity }, info) => {
  await clearDebt(db, identity);
  const before = await finances(db, identity.userId);
  await login(page, identity);
  await page.goto("/transfers");
  await page.getByTestId("button-new-institutional-transfer").click();
  await page.getByTestId("input-institution-search").fill("No matching synthetic bank");
  await page.getByTestId("institution-option-custom").click();
  await page.getByTestId("button-submit-institutional-transfer").click();
  await expect(page.getByRole("alert")).toContainText("Institution name is required");
  await page.getByTestId("input-destination-institution").fill(`  ${destination.institutionName}  `);
  await page.getByTestId("input-institution-account-number").fill(destination.institutionAccountNumber);
  await page.getByTestId("button-submit-institutional-transfer").click();
  await expect(page.getByRole("alert")).toContainText("Select a destination country");
  await page.getByTestId("select-destination-country").selectOption("SG");
  await page.getByTestId("input-destination-details").fill(destination.destinationDetails);
  await page.screenshot({ path: info.outputPath("international-destination-form.png"), fullPage: true });
  await page.getByTestId("button-submit-institutional-transfer").click();
  await expect(page.getByText("Transfer Request Submitted", { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText(destination.institutionName, { exact: true })).toBeVisible();
  await page.getByTestId("button-done-institutional-transfer").click();
  await expect(page.getByText("Singapore", { exact: true })).toBeVisible();
  await expect(page.getByText(`Destination details: ${destination.destinationDetails}`)).toBeVisible();
  const [record] = (await db.query("SELECT * FROM institutional_transfers WHERE user_id=$1", [identity.userId])).rows;
  expect(record).toMatchObject({ institution_name: destination.institutionName, institution_country: "SG", destination_details: destination.destinationDetails, status: "pending" });
  const headers = { "x-admin-key": process.env.BALANCE_E2E_ADMIN! };
  const adminList = await page.request.get("/api/admin/institutional-transfers", { headers });
  expect(adminList.status()).toBe(200);
  expect((await adminList.json()).find((r: any) => r.id === record.id)).toMatchObject({
    institutionCountry: "SG", destinationDetails: destination.destinationDetails, status: "pending",
  });
  const review = await page.request.patch(`/api/admin/institutional-transfers/${record.id}`, {
    headers, data: { status: "under_review", adminNotes: "Synthetic destination requires verification" },
  });
  expect(review.status()).toBe(200);
  expect((await review.json()).transfer.status).toBe("under_review");
  expect(await finances(db, identity.userId)).toEqual(before);
  await page.goto("/admin");
  await page.getByTestId("input-admin-password").fill(process.env.BALANCE_E2E_ADMIN!);
  await page.getByTestId("button-admin-login").click();
  await page.getByRole("tab", { name: "Inst. Transfers", exact: true }).click();
  const adminCard = page.getByTestId(`inst-transfer-admin-${record.id}`);
  await expect(adminCard).toContainText("Singapore");
  await expect(adminCard).toContainText(destination.institutionAccountNumber);
  await expect(adminCard).toContainText(destination.destinationDetails);
  await page.screenshot({ path: info.outputPath("administrator-destination-review.png"), fullPage: true });
});

test("listed destination still accepts a cash request and third-party holder without moving assets", async ({ page, db, identity }) => {
  await clearDebt(db, identity);
  await login(page, identity);
  const before = await finances(db, identity.userId);
  await page.goto("/transfers");
  await page.getByTestId("button-new-institutional-transfer").click();
  await page.getByTestId("institution-option-RBC").click();
  await expect(page.getByTestId("select-destination-country")).toHaveValue("CA");
  await page.getByTestId("input-institution-account-number").fill("SYNTHETIC-LISTED-ID");
  await page.getByTestId("holder-type-other").click();
  await page.getByTestId("button-submit-institutional-transfer").click();
  await expect(page.getByRole("alert")).toContainText("Account holder name is required");
  await page.getByTestId("input-holder-name").fill("Synthetic Receiving Holder");
  await page.getByTestId("transfer-type-cash").click();
  await page.getByTestId("button-submit-institutional-transfer").click();
  await expect(page.getByText("Transfer Request Submitted", { exact: true })).toBeVisible();
  const [record] = (await db.query("SELECT * FROM institutional_transfers WHERE user_id=$1", [identity.userId])).rows;
  expect(record).toMatchObject({ institution_name: "RBC Dominion Securities", institution_country: "CA",
    account_holder_type: "other", account_holder_name: "Synthetic Receiving Holder", transfer_type: "cash", status: "pending" });
  expect(await finances(db, identity.userId)).toEqual(before);
});

test.describe("server destination validation", () => {
  test.use({ expectedHttpFailures: { "/api/institutional-transfers": 400 } });
  test("invalid fields cannot create requests or change finances", async ({ page, db, identity }) => {
    await clearDebt(db, identity);
    await login(page, identity);
    const before = await finances(db, identity.userId);
    for (const [invalid, message] of [
      [{ institutionName: "   " }, "Institution name is required"],
      [{ institutionName: 123 }, "Expected string"],
      [{ institutionName: "x".repeat(201) }, "200 characters"],
      [{ institutionCountry: undefined }, "Required"],
      [{ institutionCountry: "XX" }, "Select a destination country"],
      [{ institutionAccountNumber: " " }, "Receiving account or portfolio ID is required"],
      [{ institutionAccountNumber: "x".repeat(101) }, "100 characters"],
      [{ destinationDetails: "x".repeat(1001) }, "1000 characters"],
      [{ destinationDetails: "invalid\u0000text" }, "invalid characters"],
      [{ accountHolderType: "other", accountHolderName: " " }, "Account holder name is required"],
    ] as const) {
      const response = await page.request.post("/api/institutional-transfers", { data: { ...destination, ...invalid } });
      expect(response.status()).toBe(400);
      expect((await response.json()).message).toContain(message);
    }
    expect((await db.query("SELECT count(*)::int AS n FROM institutional_transfers WHERE user_id=$1", [identity.userId])).rows[0].n).toBe(0);
    expect(await finances(db, identity.userId)).toEqual(before);
  });
});

test.describe("blocked international requests", () => {
  test.use({ expectedHttpFailures: { "/api/institutional-transfers": 423 } });
  for (const restriction of ["debt", "frozen"] as const) {
    test(`${restriction} clients cannot submit custom destinations`, async ({ page, db, identity }) => {
      if (restriction === "frozen") {
        await clearDebt(db, identity);
      } else {
        await db.query("UPDATE users SET debt_clearance_required=true, debt_payment_account_id=$2 WHERE id=$1", [identity.userId, identity.debt]);
      }
      await login(page, identity);
      // Stop dashboard polling before changing access; unrelated background
      // transaction reads would correctly start returning 423 after freezing.
      await page.goto("/transfers");
      await expect(page.getByTestId("button-new-institutional-transfer")).toBeVisible();
      if (restriction === "frozen") {
        await db.query("UPDATE users SET account_frozen=true WHERE id=$1", [identity.userId]);
      }
      const before = await finances(db, identity.userId);
      const response = await page.request.post("/api/institutional-transfers", { data: destination });
      expect(response.status()).toBe(423);
      expect((await response.json()).message).toBe(restriction === "debt" ? "DEBT_PAYMENT_REQUIRED" : "ACCOUNT_FROZEN");
      expect((await db.query("SELECT count(*)::int AS n FROM institutional_transfers WHERE user_id=$1", [identity.userId])).rows[0].n).toBe(0);
      expect(await finances(db, identity.userId)).toEqual(before);
    });
  }
});
