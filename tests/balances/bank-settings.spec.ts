import { test, expect, login } from "./fixtures";
import { generate } from "otplib";
import { contactDetailsPath, recoveryRequestPath, adminRecoveryRequestPath } from "../../shared/client-settings";

// No authentication material or recovery codes in browser evidence.
test.use({ trace: "off", screenshot: "off", video: "off",
  expectedHttpFailures: { [contactDetailsPath]: 400 },
});

async function finances(db: import("pg").Pool, id: number) {
  return Promise.all([
    "SELECT * FROM accounts WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM transactions WHERE from_account_id IN (SELECT id FROM accounts WHERE user_id=$1) OR to_account_id IN (SELECT id FROM accounts WHERE user_id=$1) ORDER BY id",
    "SELECT * FROM fee_enrollments WHERE user_id=$1 ORDER BY id",
    "SELECT * FROM management_contracts WHERE user_id=$1 ORDER BY id",
    "SELECT display_currency,debt_clearance_required,debt_payment_account_id,account_frozen,login_restricted FROM users WHERE id=$1",
  ].map(async sql => (await db.query(sql, [id])).rows));
}

test("bank settings save contact and addresses with confirmation, safe preferences and responsive layout", async ({page,identity,db}, info) => {
  const before = await finances(db,identity.userId);
  await login(page,identity);
  await page.goto("/settings");
  await expect(page.getByRole("tab", {name:"Contact details",exact:true})).toBeVisible();
  await expect(page.getByText("Residential address", {exact:true})).toBeVisible();
  await expect(page.getByRole("tab", {name:/display/i})).toHaveCount(0);
  for (const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:info.outputPath("bank-settings-mobile.png"),fullPage:true,animations:"disabled"});
  await page.getByRole("button", {name:"Edit details",exact:true}).click();
  await page.getByLabel("Phone number", {exact:true}).fill("+1 555 010 2048");
  await page.getByRole("button", {name:"Add residential address",exact:true}).click();
  const address = page.getByRole("group", {name:"Residential address",exact:true});
  await address.getByLabel("Address line 1", {exact:true}).fill("12 Test Street");
  await address.getByLabel("Town or city", {exact:true}).fill("Toronto");
  await address.getByLabel(/province|region|county/i).fill("Ontario");
  await address.getByLabel(/post.*code/i).fill("M5V 1A1");
  await address.getByLabel("Country", {exact:true}).fill("Canada");
  await page.getByRole("button", {name:"Add a separate mailing address",exact:true}).click();
  const mailing=page.getByRole("group", {name:"Separate mailing address",exact:true});
  await mailing.getByLabel("Address line 1", {exact:true}).fill("20 Mail Lane");
  await mailing.getByLabel("Town or city", {exact:true}).fill("Toronto");
  await mailing.getByLabel(/post.*code/i).fill("M5V 1A2");
  await mailing.getByLabel("Country", {exact:true}).fill("Canada");
  await page.getByLabel("Current password", {exact:true}).fill("incorrect");
  await page.getByRole("button", {name:"Save contact details",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("current password is incorrect");
  await page.getByLabel("Current password", {exact:true}).fill(identity.password);
  await page.getByRole("button", {name:"Save contact details",exact:true}).click();
  await expect(page.getByText("Contact details saved.", {exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByText(/12 Test Street/, {exact:false})).toBeVisible();
  await expect(page.getByText(/20 Mail Lane/, {exact:false})).toBeVisible();
  const saved = await (await page.request.get(contactDetailsPath)).json();
  expect(saved.residentialAddress.city).toBe("Toronto");
  expect(saved.mailingAddress.line1).toBe("20 Mail Lane");
  expect(saved.phoneNumber).toBe("+1 555 010 2048");
  expect((await page.request.patch(contactDetailsPath,{data:{...saved,currentPassword:identity.password,loginRestricted:false}})).status()).toBe(400);
  expect((await page.request.patch("/api/user",{data:{loginRestricted:false}})).status()).toBe(400);
  expect((await page.request.patch("/api/user",{data:{email:"bypass@example.test"}})).status()).toBe(403);
  await page.getByRole("tab", {name:/communications|preferences/i}).click();
  const marketing=page.getByRole("switch").last();
  const checked=await marketing.getAttribute("aria-checked");
  await marketing.click();
  await page.getByRole("button", {name:/save preferences/i}).click();
  await expect(page.getByText(/preferences saved/i)).toBeVisible();
  expect((await db.query("SELECT marketing_emails FROM users WHERE id=$1",[identity.userId])).rows[0].marketing_emails).toBe(checked!=="true");
  expect(await finances(db,identity.userId)).toEqual(before);
});

test("recovery codes require a client request and admin review, cannot be self-generated and are one-time", async ({page,identity,db,playwright,browser}) => {
  const before=await finances(db,identity.userId);
  await login(page,identity);
  const setup=await (await page.request.post("/api/security/two-factor/setup",{data:{currentPassword:identity.password}})).json();
  const confirmed=await page.request.post("/api/security/two-factor/confirm",{data:{code:await generate({secret:setup.secret})}});
  expect(confirmed.status()).toBe(200);
  expect((await confirmed.json()).recoveryCodes).toEqual([]);
  expect((await db.query("SELECT * FROM client_security_recovery WHERE user_id=$1",[identity.userId])).rows).toHaveLength(0);
  expect((await page.request.post("/api/security/two-factor/recovery",{data:{currentPassword:identity.password}})).status()).toBe(403);
  expect((await page.request.get(adminRecoveryRequestPath)).status()).toBe(401);
  expect((await page.request.post(recoveryRequestPath,{data:{currentPassword:"wrong"}})).status()).toBe(400);
  await page.goto("/settings");
  await page.getByRole("tab",{name:/security/i}).click();
  await page.getByRole("button",{name:"Request recovery codes",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Current password", {exact:true}).fill(identity.password);
  await page.getByRole("button",{name:"Submit request",exact:true}).click();
  await expect(page.getByText("Request awaiting administrator review.", {exact:true})).toBeVisible();
  await expect(page.getByRole("button",{name:"Request recovery codes",exact:true})).toBeDisabled();
  let pending=await (await page.request.get(recoveryRequestPath)).json();
  const duplicate=await page.request.post(recoveryRequestPath,{data:{currentPassword:identity.password}});
  expect((await duplicate.json()).id).toBe(pending.id);
  const adminHeaders={"x-admin-key":process.env.BALANCE_E2E_ADMIN!};
  expect((await page.request.post(`${adminRecoveryRequestPath}/${pending.id}/issue`,{data:{identityVerified:true}})).status()).toBe(401);
  expect((await page.request.post(`${adminRecoveryRequestPath}/${pending.id}/reject`,{headers:adminHeaders,data:{identityVerified:false}})).status()).toBe(200);
  expect((await (await page.request.get(recoveryRequestPath)).json()).status).toBe("rejected");
  expect((await page.request.post(`${adminRecoveryRequestPath}/${pending.id}/issue`,{headers:adminHeaders,data:{identityVerified:true}})).status()).toBe(409);
  const next=await page.request.post(recoveryRequestPath,{data:{currentPassword:identity.password}});
  expect(next.status()).toBe(202);
  const nextPending=await next.json();
  expect(nextPending.id).not.toBe(pending.id);
  pending=nextPending;
  const issueUrl=`${adminRecoveryRequestPath}/${pending.id}/issue`;
  expect((await page.request.post(issueUrl,{headers:adminHeaders,data:{identityVerified:false}})).status()).toBe(400);
  const adminContext=await browser.newContext();
  const adminPage=await adminContext.newPage();
  let codes: string[]=[];
  try {
    await adminPage.goto(`${process.env.BALANCE_E2E_URL}/admin`);
    await adminPage.getByTestId("input-admin-password").fill(process.env.BALANCE_E2E_ADMIN!);
    await adminPage.getByTestId("button-admin-login").click();
    await adminPage.getByRole("tab",{name:"Recovery requests",exact:true}).click();
    await adminPage.getByTestId(`recovery-request-${pending.id}`).getByRole("button",{name:"Review request",exact:true}).click();
    await expect(adminPage.getByRole("button",{name:"Issue recovery codes",exact:true})).toBeDisabled();
    await adminPage.getByLabel("I have verified this client's identity through our approved process.", {exact:true}).check();
    const response=adminPage.waitForResponse(r=>r.url().endsWith(issueUrl)&&r.request().method()==="POST");
    await adminPage.getByRole("button",{name:"Issue recovery codes",exact:true}).click();
    const issued=await response;
    expect(issued.status()).toBe(200);
    expect(issued.headers()["cache-control"]).toBe("no-store");
    codes=(await issued.json()).recoveryCodes;
    await expect(adminPage.getByRole("dialog", {name:"One-time recovery codes",exact:true})).toBeVisible();
    expect(await adminPage.getByRole("dialog").locator("code").allTextContents()).toEqual(codes);
    await adminPage.getByRole("button",{name:"Done",exact:true}).click();
    await expect(adminPage.getByRole("dialog", {name:"One-time recovery codes",exact:true})).toHaveCount(0);
  } finally {await adminContext.close();}
  expect(codes).toHaveLength(10);
  expect((await page.request.post(issueUrl,{headers:adminHeaders,data:{identityVerified:true}})).status()).toBe(409);
  const rows=(await db.query("SELECT digest FROM client_security_recovery WHERE user_id=$1",[identity.userId])).rows;
  expect(rows).toHaveLength(10);
  expect(rows.every(row=>!codes.includes(row.digest))).toBe(true);
  expect((await page.request.get("/api/user")).status()).toBe(401);
  const client=await playwright.request.newContext({baseURL:process.env.BALANCE_E2E_URL});
  try {
    expect((await client.post("/api/login",{data:{userId:identity.ref,password:identity.password}})).status()).toBe(202);
    expect((await client.post("/api/security/two-factor/challenge",{data:{code:codes[0]}})).status()).toBe(200);
    const contact=await (await client.get(contactDetailsPath)).json();
    expect((await client.patch(contactDetailsPath,{data:{...contact,currentPassword:identity.password}})).status()).toBe(400);
    expect((await client.post("/api/login",{data:{userId:identity.ref,password:identity.password}})).status()).toBe(202);
    expect((await client.post("/api/security/two-factor/challenge",{data:{code:codes[0]}})).status()).toBe(400);
  } finally {await client.dispose();}
  expect(await finances(db,identity.userId)).toEqual(before);
});
