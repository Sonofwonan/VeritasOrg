import { test, expect, login, verifyHeadline, assertFundsActionBlocked } from "./fixtures";
import { assertContained, assertReadable } from "./contrast-helper";
import { writeFile } from "node:fs/promises";

test.use({ expectedHttpFailures: { "/api/login": 400 } });

test("visible login entries and readable auth states fit phones through desktop", async ({ page }, info) => {
  test.setTimeout(180000);
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const headerLogin = page.locator("header").getByRole("button", { name: "Client login", exact: true });
    await expect(headerLogin).toBeVisible();
    await assertContained(page, "header");
    const bounds = await headerLogin.boundingBox();
    expect(bounds!.height).toBeGreaterThanOrEqual(44);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    const overflow = await page.evaluate(() => [...document.querySelectorAll("body *")].filter(element => {
      const bounds=element.getBoundingClientRect();
      return bounds.width && bounds.right > innerWidth + 1 && getComputedStyle(element).position !== "fixed" &&
        !element.closest(".ticker-track");
    }).map(element => ({ tag:element.tagName, classes:element.className, text:element.textContent?.trim().slice(0,100),
      right:element.getBoundingClientRect().right })).slice(0,16));
    const overflowPath=info.outputPath(`overflow-${width}.json`);
    await writeFile(overflowPath,JSON.stringify(overflow));
    await info.attach(`overflow-${width}`, {path:overflowPath,contentType:"application/json"});
    expect.soft(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await assertReadable(page, "body", info, `public-${width}`);
    await page.locator("#who-we-serve .group").first().hover();
    await assertReadable(page, "#who-we-serve", info, `public-hover-${width}`);
    // These controls have their own dependable backgrounds over the moving video.
    await assertReadable(page, '[data-testid="button-sign-in"],[data-testid="button-cta-start"]', info, `hero-actions-${width}`);
    if (width === 390) {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await assertReadable(page, "body", info, "public-dark");
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    await headerLogin.click();
    await expect(page).toHaveURL(/\/auth$/);
    const button = page.getByTestId("button-sign-in");
    await expect(button).toBeVisible();
    const submitBounds = await button.boundingBox();
    expect(submitBounds!.height).toBeGreaterThanOrEqual(44);
    expect(submitBounds!.width).toBeGreaterThan(width < 768 ? width * 0.7 : 250);
    await assertReadable(page, "body", info, `auth-${width}`);
    await button.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
    expect(await button.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
    await assertReadable(page, "body", info, `auth-focus-${width}`);
    await button.hover();
    await assertReadable(page, "body", info, `auth-hover-${width}`);
    await button.click();
    await expect(page.getByText("Client Reference is required", { exact: true })).toBeVisible();
    await expect(page.getByText("Password required", { exact: true })).toBeVisible();
    await assertReadable(page, "body", info, `auth-validation-${width}`);
    for (const placeholder of await page.locator("input[placeholder]").all()) {
      const colors = await placeholder.evaluate(element => ({
        placeholder: getComputedStyle(element, "::placeholder").color,
        input: getComputedStyle(element).color,
      }));
      expect(colors.placeholder).not.toMatch(/rgba\([^)]*,\s*0\.[0-5]\)/);
    }
    if (width === 390 || width === 1440) {
      await page.screenshot({ path: info.outputPath(`login-${width}.png`), animations: "disabled" });
      await page.evaluate(() => document.documentElement.classList.add("dark"));
      await assertReadable(page, "body", info, `auth-dark-${width}`);
    }
  }
  await page.goto("/company");
  await assertReadable(page, "body", info, "company-light");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await assertReadable(page, "body", info, "company-dark");
  // The request is intercepted before leaving this isolated server; no bad
  // credentials are sent to a real account and the genuine loading UI is tested.
  await page.goto("/auth");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/login", async route => {
    await pending;
    await route.fulfill({ status: 400, contentType: "application/json",
      body: JSON.stringify({ message: "Synthetic rejected login" }) });
  });
  await page.locator('input[name="userId"]').fill("SYNTHETIC-NOT-A-CLIENT");
  await page.locator('input[name="password"]').fill("synthetic-not-a-real-password");
  await page.getByTestId("button-sign-in").click();
  await expect(page.getByTestId("button-sign-in")).toBeDisabled();
  expect(await page.getByTestId("button-sign-in").evaluate(element => getComputedStyle(element).opacity)).toBe("1");
  await assertReadable(page, '[data-testid="button-sign-in"]', info, "auth-loading", true);
  release();
  await expect(page.getByText("Synthetic rejected login", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("button-sign-in")).toBeEnabled();
  await assertReadable(page, "body", info, "auth-rejected-login");
});

test("client palette stays readable without changing money or collapsed navigation", async ({ page, identity, db }, info) => {
  test.setTimeout(180000);
  await db.query("UPDATE users SET display_currency='GBP',debt_clearance_required=true,debt_payment_account_id=$2 WHERE id=$1",
    [identity.userId, identity.debt]);
  const snapshot = async () => Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at,display_currency FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [identity.userId])).rows));
  const before = await snapshot();
  await login(page, identity);
  await verifyHeadline(page, "£2,003,900.25");
  await assertFundsActionBlocked(page,"button-quick-transfer");
  await assertFundsActionBlocked(page,"button-quick-invest");
  await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("profile-button")).toHaveAttribute("aria-label", "Open profile");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await verifyHeadline(page, "£2,003,900.25");
    await assertReadable(page, "main,header", info, `dashboard-${width}`);
    await expect(page.getByTestId(`debt-account-amount-${identity.debt}`)).toHaveText("-£1,614.39");
    await page.screenshot({ path: info.outputPath(`dashboard-${width}.png`), animations: "disabled" });
    await page.goto("/accounts");
    await expect(page.getByTestId("text-total-balance")).toHaveText("£2,003,900.25");
    await assertReadable(page, "main,header", info, `accounts-${width}`);
    await expect(page.getByTestId("text-total-balance")).toHaveCSS("white-space", "nowrap");
    await page.screenshot({ path: info.outputPath(`accounts-${width}.png`), animations: "disabled" });
    await page.goto("/dashboard");
  }
  for (const dark of [false, true]) {
    for (const path of ["/dashboard", "/accounts", `/accounts/${identity.funded}`, `/accounts/${identity.debt}`, "/investments", "/transfers", "/settings"]) {
      await page.goto(path);
      await expect(page.locator("main").last()).toBeVisible();
      await expect(page.locator("main .animate-spin")).toHaveCount(0);
      await expect(page.locator("main").last()).not.toContainText(/Loading accounts|Loading account details/);
      if (path.startsWith("/accounts/")) await expect(page.locator("main h2").first()).toBeVisible();
      await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
      await assertReadable(page, "main,header", info, `${dark ? "dark" : "light"}-${path.replaceAll("/", "-")}`);
      await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "false");
    }
    await page.getByTestId("sidebar-toggle").click();
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded", "true");
    await assertReadable(page, "#veritas-side-navigation", info, `sidebar-${dark}`);
    await page.getByTestId("sidebar-close").click();
    await page.getByTestId("profile-button").click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId("text-profile-name")).toBeVisible();
    await page.evaluate(value => document.documentElement.classList.toggle("dark", value), dark);
    await assertReadable(page, "main,header", info, `profile-${dark}`);
  }
  await page.goto("/dashboard");
  await verifyHeadline(page, "£2,003,900.25");
  await expect(page.locator("main").last()).not.toContainText("CAD");
  await expect(page.locator("main").last()).not.toContainText("GBP");
  await expect(page.getByTestId("text-day-performance")).toHaveCount(0);
  await expect(page.getByTestId("text-ytd-performance")).toHaveCount(0);
  await expect(page.getByTestId("text-performance-explanation")).toHaveCount(0);
  expect(await snapshot()).toEqual(before);
});
