import { test, expect, login, verifyHeadline } from "./fixtures";

test("client navigation stays collapsed until deliberately opened", async ({page,identity},info) => {
  await page.context().addCookies([{name:"sidebar_state",value:"true",url:process.env.BALANCE_E2E_URL!}]);
  await login(page,identity);
  await verifyHeadline(page);
  const sidebar=page.getByTestId("sidebar-toggle");
  const top=page.getByTestId("top-navigation-toggle");
  const gear=page.getByTestId("header-settings-button");
  const nav=page.locator("#veritas-side-navigation");
  const header=page.locator("header").filter({has:top});
  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    await expect(sidebar).toHaveAttribute("aria-expanded","false");
    await expect(top).toHaveAttribute("aria-expanded","false");
    await expect(gear).toHaveCount(0);
    // Responsive offcanvas and header transitions settle after their aria state
    // changes. Check the final layout, not an intermediate animation frame.
    await expect.poll(async () => {
      const box=await header.boundingBox();
      return {height:box?.height,x:box?.x};
    }).toEqual({height:48,x:0});
    for (const control of [sidebar,top]) {
      const target=await control.boundingBox();
      expect(target!.width).toBeGreaterThanOrEqual(44);
      expect(target!.height).toBeGreaterThanOrEqual(44);
    }
    await header.hover();
    await page.locator('main.overflow-y-auto').evaluate(el=>el.scrollTop=200);
    await expect(top).toHaveAttribute("aria-expanded","false");
    await expect(sidebar).toHaveAttribute("aria-expanded","false");
    await top.focus();
    await page.keyboard.press("Enter");
    await expect(top).toHaveAttribute("aria-expanded","true");
    await expect(gear).toBeVisible();
    const settingsBox=await gear.boundingBox();
    expect(settingsBox!.x+settingsBox!.width).toBeLessThanOrEqual(width);
    await top.focus();
    await page.keyboard.press("Space");
    await expect(top).toHaveAttribute("aria-expanded","false");
    await expect(gear).toHaveCount(0);
    await sidebar.click();
    await expect(page.getByTestId("sidebar-close")).toHaveAttribute("aria-expanded","true");
    await expect(nav).not.toHaveAttribute("inert");
    await expect(nav.getByRole("button",{name:"Accounts",exact:true})).toBeInViewport();
    await page.getByTestId("sidebar-close").click();
    await expect(sidebar).toHaveAttribute("aria-expanded","false");
    if (width>=768) await expect(nav).toHaveAttribute("inert");
    if ([390,1440].includes(width)) {
      await page.locator('main.overflow-y-auto').evaluate(el=>el.scrollTop=0);
      const path=info.outputPath(`navigation-collapsed-${width}.png`);
      await page.screenshot({path});
      await info.attach(`navigation-collapsed-${width}`,{path,contentType:"image/png"});
    }
  }
  await top.click();
  await gear.click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(top).toHaveAttribute("aria-expanded","false");
  await expect(sidebar).toHaveAttribute("aria-expanded","false");
  await sidebar.click();
  await nav.getByRole("button",{name:"Dashboard",exact:true}).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await verifyHeadline(page);
  await expect(sidebar).toHaveAttribute("aria-expanded","false");
  await top.click();
  await sidebar.click();
  await page.reload();
  await expect(top).toHaveAttribute("aria-expanded","false");
  await expect(sidebar).toHaveAttribute("aria-expanded","false");
  await verifyHeadline(page);
});

test("dashboard offers three fitting quick actions with unchanged destinations", async ({page,identity,db},info) => {
  const snapshot = async () => Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM investments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM fee_assessments WHERE account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT display_currency,debt_clearance_required,debt_payment_account_id,debt_payment_confirmed_at FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql,[identity.userId])).rows));
  const before = await snapshot();
  await login(page,identity);
  await verifyHeadline(page);
  const actions = page.locator('[data-testid^="button-quick-"]');
  const checkActions = async (width: number) => {
    await expect(actions).toHaveText(["Transfer","Invest","Accounts"]);
    await expect(page.getByTestId("button-quick-wire")).toHaveCount(0);
    const geometry = await actions.evaluateAll(buttons => ({
      row: buttons[0].parentElement!.getBoundingClientRect().toJSON(),
      buttons: buttons.map(button => button.getBoundingClientRect().toJSON()),
    }));
    expect(geometry.buttons[0].x).toBeCloseTo(geometry.row.x,0);
    const last = geometry.buttons[2];
    expect(last.x + last.width).toBeCloseTo(geometry.row.x + geometry.row.width,0);
    for (const box of geometry.buttons) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y).toBeCloseTo(geometry.buttons[0].y,0);
      if (width < 768) expect(box.width).toBeCloseTo(geometry.buttons[0].width,0);
    }
  };
  for (const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:900});
    await checkActions(width);
    await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded","false");
    await expect(page.getByTestId("top-navigation-toggle")).toHaveAttribute("aria-expanded","false");
    if (width === 390 || width === 1440) {
      await page.screenshot({path:info.outputPath(`three-dashboard-actions-${width}.png`),animations:"disabled"});
    }
    if (width === 768 || width === 1024) {
      await page.getByTestId("sidebar-toggle").click();
      await expect(page.getByTestId("sidebar-toggle")).toHaveAttribute("aria-expanded","true");
      await page.waitForTimeout(300);
      await checkActions(width);
      await page.getByTestId("sidebar-close").click();
      await page.waitForTimeout(300);
    }
  }
  for (const [action,destination] of [["transfer","transfers"],["invest","investments"],["accounts","accounts"]]) {
    await page.getByTestId(`button-quick-${action}`).click();
    await expect(page).toHaveURL(new RegExp(`/${destination}$`));
    await expect(page.getByTestId("funds-action-dialog")).toHaveCount(0);
    await page.goto("/dashboard");
    await verifyHeadline(page);
  }
  expect(await snapshot()).toEqual(before);
});
