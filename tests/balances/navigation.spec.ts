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
    const box=await header.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(48);
    expect(box!.x).toBe(0);
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
