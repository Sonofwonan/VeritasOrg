import { test, expect, login, verifyHeadline } from "./fixtures";

test.use({ expectedHttpFailures: { "/api/user": 503, "/src/main.tsx": 503 } });

function gate() {
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  return { ready, release };
}

test("branded startup hands off to session loading and ready content without duplicate overlays", async ({ page }, info) => {
  const bundle = gate();
  const session = gate();
  await page.route("**/src/main.tsx*", async route => { await bundle.ready; await route.continue(); });
  await page.route("**/api/user", async route => { await session.ready; await route.continue(); });
  await page.goto("/auth", { waitUntil: "commit" });
  const startup = page.locator("[data-startup-loader]");
  await expect(startup).toBeVisible();
  await expect(page.getByTestId("branded-loader")).toHaveCount(1);
  await expect(startup.locator("img")).toHaveCSS("animation-name", "vw-loader-logo-pulse");
  await expect.poll(() => startup.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBeTruthy();
  await page.screenshot({ path: info.outputPath("startup-logo.png") });
  bundle.release();
  await expect(startup).toHaveCount(0);
  await expect(page.getByTestId("branded-loader")).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText("Loading");
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const image = await page.locator(".vw-loader-logo").boundingBox();
    expect(image).not.toBeNull();
    expect(image!.x).toBeGreaterThanOrEqual(0);
    expect(image!.x + image!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: info.outputPath(`session-logo-${width}.png`) });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".vw-loader-logo")).toHaveCSS("animation-name", "none");
  expect(await page.locator(".vw-loader-line").evaluate(el => getComputedStyle(el, "::after").animationName)).toBe("none");
  session.release();
  await expect(page.getByTestId("button-sign-in")).toBeVisible();
  await expect(page.getByTestId("branded-loader")).toHaveCount(0);
});

test("homepage and protected-route loading finish with normal sign-in behavior", async ({ page }) => {
  for (const path of ["/", "/dashboard"]) {
    const session = gate();
    await page.route("**/api/user", async route => { await session.ready; await route.continue(); });
    await page.goto(path, { waitUntil: "commit" });
    await expect(page.locator('[data-testid="branded-loader"]:not([data-startup-loader])')).toBeVisible();
    session.release();
    if (path === "/") await expect(page.getByRole("button", { name: "Apply now" })).toBeVisible();
    else {
      await expect(page).toHaveURL(/\/auth$/);
      await expect(page.getByTestId("button-sign-in")).toBeVisible();
    }
    await expect(page.getByTestId("branded-loader")).toHaveCount(0);
    await page.unroute("**/api/user");
  }
});

test("session failures show retry and failed bundles show reload rather than perpetual animation", async ({ page }) => {
  await page.route("**/api/user", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Test unavailable"}' }));
  await page.goto("/dashboard");
  await expect(page.getByTestId("session-load-error")).toContainText("We couldn't connect. Please try again.");
  await expect(page.getByTestId("branded-loader")).toHaveCount(0);
  await expect(page.locator(".vw-loader-logo")).toHaveCSS("animation-name", "none");
  await page.unroute("**/api/user");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByTestId("button-sign-in")).toBeVisible();
  await page.route("**/src/main.tsx*", route => route.fulfill({ status: 503, contentType: "text/javascript", body: "" }));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Reload site" })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("We couldn't load the site.");
  await expect(page.locator(".vw-loader-logo")).toHaveCSS("animation-name", "none");
  await page.unroute("**/src/main.tsx*");
  await page.getByRole("button", { name: "Reload site" }).click();
  await expect(page.getByRole("button", { name: "Apply now" })).toBeVisible();
  await expect(page.locator("[data-startup-loader]")).toHaveCount(0);
});

test("signed-in refresh retains usable content and preserves synthetic financial records", async ({ page, identity, db }) => {
  const snapshot = async () => ({
    accounts: (await db.query("SELECT * FROM accounts WHERE user_id=$1 ORDER BY id", [identity.userId])).rows,
    enrollment: (await db.query("SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id", [identity.userId])).rows,
  });
  const before = await snapshot();
  await login(page, identity);
  await verifyHeadline(page);
  const session = gate();
  await page.route("**/api/user", async route => { await session.ready; await route.continue(); });
  await page.reload({ waitUntil: "commit" });
  await expect(page.locator('[data-testid="branded-loader"]:not([data-startup-loader])')).toBeVisible();
  session.release();
  await verifyHeadline(page);
  await expect(page.getByTestId("branded-loader")).toHaveCount(0);
  const refresh = gate();
  await page.unroute("**/api/user");
  await page.route("**/api/user", async route => {
    await refresh.ready;
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Test refresh unavailable"}' });
  });
  // Window focus triggers the real session refetch, without clearing cached identity.
  const response = page.waitForResponse(r => r.url().endsWith("/api/user") && r.status() === 503);
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await verifyHeadline(page);
  await expect(page.getByTestId("branded-loader")).toHaveCount(0);
  refresh.release();
  await response;
  await verifyHeadline(page);
  await expect(page.getByTestId("session-load-error")).toHaveCount(0);
  expect(await snapshot()).toEqual(before);
});
