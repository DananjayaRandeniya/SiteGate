import { expect, test, type Locator } from "@playwright/test";

const portal = process.env.SITEGATE_E2E_PORTAL_URL;
const workerService = process.env.WORKER_SERVICE_URL;
const workerToken = process.env.WORKER_ADMIN_TOKEN;
const admin = process.env.SITEGATE_E2E_ADMIN_SESSION;
const manager = process.env.SITEGATE_E2E_MANAGER_SESSION;

if (!portal || !workerService || !workerToken || !admin || !manager) {
  throw new Error(
    "Use npm run test:e2e:worker to start the isolated Worker stack.",
  );
}

const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  .toISOString()
  .slice(0, 10);
const inductionDate = "2024-05-15";

async function expectReadableText(target: Locator, pseudo?: "::placeholder") {
  const ratio = await target.evaluate((element, pseudo) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Could not measure rendered text colors.");

    const readLuminance = () => {
      const [red, green, blue] = Array.from(
        context.getImageData(0, 0, 1, 1).data.slice(0, 3),
        (channel) => {
          const srgb = channel / 255;
          return srgb <= 0.04045
            ? srgb / 12.92
            : ((srgb + 0.055) / 1.055) ** 2.4;
        },
      );
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const backgrounds: string[] = [];
    for (
      let parent: Element | null = element;
      parent;
      parent = parent.parentElement
    ) {
      backgrounds.unshift(getComputedStyle(parent).backgroundColor);
    }
    context.fillStyle = "white";
    context.fillRect(0, 0, 1, 1);
    for (const color of backgrounds) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
    }
    const background = readLuminance();
    const foreground = getComputedStyle(element, pseudo);
    context.globalAlpha = Number(foreground.opacity);
    context.fillStyle = foreground.color;
    context.fillRect(0, 0, 1, 1);
    const text = readLuminance();
    return (
      (Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05)
    );
  }, pseudo);
  expect(
    ratio,
    `Text contrast for ${target}${pseudo ?? ""}`,
  ).toBeGreaterThanOrEqual(4.5);
}

async function seed(path: string, body: object): Promise<{ id: string }> {
  const reply = await fetch(workerService + path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${workerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  expect(reply.status).toBe(201);
  return reply.json();
}

test("Admin registers and manages a worker while Manager can only view", async ({
  browser,
  request,
}, testInfo) => {
  const { id: contractorId } = await seed("/contractors", {
    name: "Demo Build Co.",
  });
  for (const [fullName, credentialNumber] of [
    ["River Ellis", "DEMO-001"],
    ["Avery Reed", "DEMO-002"],
  ]) {
    await seed("/workers", {
      fullName,
      credentialNumber,
      contractorId,
      inductionDate,
      safetyTicketExpiry: expiry,
      assignedSiteIds: ["S-01"],
    });
  }

  expect((await request.get("/api/workers")).status()).toBe(401);
  const contexts = await Promise.all([
    browser.newContext({ viewport: { width: 1440, height: 960 } }),
    browser.newContext({ viewport: { width: 390, height: 844 } }),
    browser.newContext(),
  ]);
  const [desktop, mobile, readonly] = contexts;
  try {
    await Promise.all([
      desktop.addCookies([
        {
          name: "sitegate-worker-e2e",
          value: admin,
          url: portal,
          httpOnly: true,
        },
      ]),
      mobile.addCookies([
        {
          name: "sitegate-worker-e2e",
          value: admin,
          url: portal,
          httpOnly: true,
        },
      ]),
      readonly.addCookies([
        {
          name: "sitegate-worker-e2e",
          value: manager,
          url: portal,
          httpOnly: true,
        },
      ]),
    ]);
    const directory = await desktop.newPage();
    await test.step("Filter the directory by a URL-backed search", async () => {
      await directory.goto(`${portal}/workers`);
      await expect(
        directory.getByRole("table").getByRole("link", { name: "River Ellis" }),
      ).toBeVisible();
      await expectReadableText(
        directory.getByPlaceholder("Name or credential"),
        "::placeholder",
      );
      await expectReadableText(
        directory.getByPlaceholder("All sites"),
        "::placeholder",
      );
      await expectReadableText(
        directory
          .getByRole("table")
          .getByText("Active", { exact: true })
          .first(),
      );
      await expectReadableText(
        directory.getByRole("button", { name: "Apply filters" }),
      );
      await directory.screenshot({
        path: testInfo.outputPath("worker-review", "directory-desktop.png"),
        fullPage: true,
      });
      await directory
        .getByRole("searchbox", { name: "Search workers" })
        .fill("Avery");
      await directory.getByRole("button", { name: "Apply filters" }).click();
      await expect(directory).toHaveURL(/search=Avery/);
      await expect(
        directory.getByRole("table").getByRole("link", { name: "River Ellis" }),
      ).toBeHidden();
      await expect(
        directory.getByRole("table").getByRole("link", { name: "Avery Reed" }),
      ).toBeVisible();
      await directory
        .getByRole("searchbox", { name: "Search workers" })
        .fill("No matching worker");
      await directory.getByRole("button", { name: "Apply filters" }).click();
      await expect(
        directory.getByRole("heading", {
          name: "No workers match your filters",
        }),
      ).toBeVisible();
    });

    const phone = await mobile.newPage();
    await test.step("Keep filters and page position in the URL", async () => {
      const filters = `limit=1&status=Active&contractorId=${contractorId}&siteId=S-01`;
      await directory.goto(`${portal}/workers?${filters}`);
      const pages = directory.getByRole("navigation", { name: "Worker pages" });
      await expect(pages.getByText("2 workers · Page 1 of 2")).toBeVisible();
      await expect(
        directory.getByRole("table").getByRole("link", { name: "Avery Reed" }),
      ).toBeVisible();
      await pages.getByRole("link", { name: "Next" }).click();
      await expect(pages.getByText("2 workers · Page 2 of 2")).toBeVisible();
      const secondPage = new URL(directory.url());
      expect(Object.fromEntries(secondPage.searchParams)).toMatchObject({
        page: "2",
        limit: "1",
        status: "Active",
        contractorId,
        siteId: "S-01",
      });
      await expect(
        directory.getByRole("table").getByRole("link", { name: "River Ellis" }),
      ).toBeVisible();

      await directory.goBack();
      await expect(pages.getByText("2 workers · Page 1 of 2")).toBeVisible();
      await directory.goForward();
      await expect(pages.getByText("2 workers · Page 2 of 2")).toBeVisible();
      await pages.getByRole("link", { name: "Previous" }).click();
      await expect(pages.getByText("2 workers · Page 1 of 2")).toBeVisible();

      await phone.goto(`${portal}/workers?${filters}&page=10`);
      await expect(phone).toHaveURL(secondPage.href);
      await expect(phone.getByRole("table")).toBeHidden();
      await expect(
        phone.getByRole("link", { name: "River Ellis" }),
      ).toBeVisible();
      await expect(phone.getByLabel("Site ID")).toHaveValue("S-01");
      expect(
        await phone.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);

      await phone.getByLabel("Status").selectOption("Inactive");
      await phone.getByRole("button", { name: "Apply filters" }).click();
      await expect(
        phone.getByRole("heading", { name: "No workers match your filters" }),
      ).toBeVisible();
      expect(new URL(phone.url()).searchParams.get("page")).toBe("1");
    });

    await test.step("Validate and register a worker at phone width", async () => {
      await phone.goto(`${portal}/workers/new`);
      await expect(phone.getByLabel("Full name")).toBeVisible();
      await phone.screenshot({
        path: testInfo.outputPath("worker-review", "registration-mobile.png"),
        fullPage: true,
      });
      await phone.getByLabel("Full name").fill("Morgan Vale");
      await phone
        .getByLabel("Contractor", { exact: true })
        .selectOption(contractorId);
      await phone.getByLabel("Credential number").fill("DEMO-001");
      await phone.getByLabel("Safety ticket expiry").fill(expiry);
      await phone.getByRole("checkbox", { name: "S-01" }).check();

      const requests: string[] = [];
      phone.on("request", (incoming) => {
        if (
          incoming.method() === "POST" &&
          new URL(incoming.url()).pathname === "/api/workers"
        ) {
          requests.push(incoming.url());
        }
      });
      await phone.getByLabel("Induction date").fill(future);
      await phone.getByRole("button", { name: "Save worker" }).click();
      await expect(
        phone.getByText("Induction date must be today or earlier.", {
          exact: true,
        }),
      ).toBeVisible();
      expect(requests).toHaveLength(0);

      await phone.getByLabel("Induction date").fill(inductionDate);
      await phone.getByRole("button", { name: "Save worker" }).click();
      await expect(
        phone.getByText("This credential is already in use", { exact: true }),
      ).toBeVisible();
      await expectReadableText(
        phone.getByText("This credential is already in use", { exact: true }),
      );
      await expect(phone.getByLabel("Full name")).toHaveValue("Morgan Vale");
      await expect(phone.getByLabel("Contractor", { exact: true })).toHaveValue(
        contractorId,
      );
      await expect(phone.getByRole("checkbox", { name: "S-01" })).toBeChecked();
      await phone.screenshot({
        path: testInfo.outputPath(
          "worker-review",
          "duplicate-credential-mobile.png",
        ),
        fullPage: true,
      });
      expect(
        await phone.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);

      await phone.getByLabel("Credential number").fill("DEMO-003");
      await phone.getByRole("button", { name: "Save worker" }).click();
      await expect(
        phone.getByText("Worker registered", { exact: true }),
      ).toBeVisible();
      await expectReadableText(
        phone.getByText("Worker registered", { exact: true }),
      );
      await expect(
        phone.getByRole("heading", { name: "Morgan Vale" }),
      ).toBeVisible();
      expect(requests).toHaveLength(2);
    });

    await test.step("Edit the profile, change the credential, and deactivate", async () => {
      await directory.goto(phone.url());
      await directory.getByRole("button", { name: "Edit profile" }).click();
      const dialog = directory.getByRole("dialog");
      const name = dialog.getByLabel("Full name");
      const induction = dialog.getByLabel("Induction date");
      const profilePath = `/api${new URL(directory.url()).pathname}`;
      const submittedEdits: string[] = [];
      directory.on("request", (incoming) => {
        if (
          incoming.method() === "PATCH" &&
          new URL(incoming.url()).pathname === profilePath
        ) {
          submittedEdits.push(incoming.url());
        }
      });

      await name.fill(" ");
      await induction.fill(future);
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(name).toBeFocused();
      await expect(name).toHaveAccessibleDescription(
        "Enter the worker’s full name.",
      );
      await expect(induction).toHaveAccessibleDescription(
        "Induction date must be today or earlier.",
      );
      await expect(dialog.getByLabel("Contractor")).toHaveValue(contractorId);
      await expect(dialog.getByLabel("Safety ticket expiry")).toHaveValue(
        expiry,
      );
      expect(submittedEdits).toHaveLength(0);

      await name.fill("Morgan Vale Updated");
      await expect(name).not.toHaveAttribute("aria-invalid", "true");
      await induction.fill(inductionDate);
      await dialog.getByRole("button", { name: "Save changes" }).click();
      await expect(
        directory.getByRole("heading", { name: "Morgan Vale Updated" }),
      ).toBeVisible();
      expect(submittedEdits).toHaveLength(1);
      await directory.screenshot({
        path: testInfo.outputPath("worker-review", "profile-desktop.png"),
        fullPage: true,
      });

      await directory
        .getByRole("button", { name: "Revoke credential" })
        .click();
      await dialog.getByLabel("Reason").selectOption("LOST");
      await dialog.getByRole("button", { name: "Revoke credential" }).click();
      const issueButton = directory.getByRole("button", {
        name: "Issue credential",
      });
      await issueButton.focus();
      await directory.keyboard.press("Enter");
      const credential = dialog.getByLabel("Credential number");
      await expect(credential).toBeFocused();
      await directory.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(issueButton).toBeFocused();
      await directory.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await credential.fill("DEMO-001");
      await directory.keyboard.press("Enter");
      await expect(credential).toBeFocused();
      await expect(credential).toHaveAttribute("aria-invalid", "true");
      await expect(credential).toHaveAccessibleDescription(
        "This credential is already in use",
      );
      await expect(credential).toHaveValue("DEMO-001");
      await credential.fill("DEMO-004");
      await directory.keyboard.press("Enter");
      await expect(
        directory.getByText("DEMO-004", { exact: true }),
      ).toBeVisible();

      await directory
        .getByRole("button", { name: "Deactivate worker" })
        .click();
      await dialog.getByLabel("Reason").selectOption("LEFT_COMPANY");
      await dialog.getByRole("button", { name: "Deactivate worker" }).click();
      await expect(
        directory.getByText("Inactive", { exact: true }),
      ).toBeVisible();
    });

    await test.step("Assign and remove sites from the worker profile", async () => {
      const dialog = directory.getByRole("dialog");
      await directory.getByRole("button", { name: "Assign site" }).click();
      await expectReadableText(
        dialog.getByPlaceholder("e.g. S-02"),
        "::placeholder",
      );
      await dialog.getByLabel("Site ID").fill("S-02");
      await dialog.getByRole("button", { name: "Assign site" }).click();
      await expect(
        directory.getByText("S-01, S-02", { exact: true }),
      ).toBeVisible();
      await directory.getByRole("button", { name: "Remove site" }).click();
      await dialog.getByLabel("Site", { exact: true }).selectOption("S-01");
      await dialog.getByRole("button", { name: "Remove site" }).click();
      await expect(directory.getByText("S-02", { exact: true })).toBeVisible();
    });

    await test.step("Confirm the Manager sees the profile but cannot change it", async () => {
      const page = await readonly.newPage();
      const profile = new URL(phone.url()).pathname;
      await page.goto(portal + profile);
      await expect(
        page.getByRole("heading", { name: "Morgan Vale Updated" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Edit profile" }),
      ).toBeHidden();
      const denied = await readonly.request.patch(`${portal}/api${profile}`, {
        headers: { Origin: portal },
        data: { fullName: "Unauthorized edit" },
      });
      expect(denied.status()).toBe(403);
      for (const [path, data] of [
        [profile + "/sites", { siteId: "S-02" }],
        [profile, {}],
      ] as const) {
        const deniedDelete = await readonly.request.delete(
          `${portal}/api${path}`,
          {
            headers: { Origin: portal },
            data,
          },
        );
        expect(deniedDelete.status()).toBe(403);
      }
      await page.goto(`${portal}/workers/new`);
      await expect(
        page.getByRole("heading", { name: "Admin access is required" }),
      ).toBeVisible();
    });

    await test.step("Confirm archive hides the worker from the directory and API", async () => {
      const profile = new URL(directory.url()).pathname;
      await directory.getByRole("button", { name: "Archive worker" }).click();
      const dialog = directory.getByRole("dialog");
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(
        directory.getByRole("heading", { name: "Morgan Vale Updated" }),
      ).toBeVisible();
      await directory.getByRole("button", { name: "Archive worker" }).click();
      await Promise.all([
        directory.waitForURL("**/workers?archived=1"),
        dialog.getByRole("button", { name: "Archive worker" }).click(),
      ]);
      await expect(
        directory.getByText("Worker archived.", { exact: true }),
      ).toBeVisible();
      await expect(
        directory.getByRole("link", { name: "Morgan Vale Updated" }),
      ).toHaveCount(0);
      expect(
        (await desktop.request.get(`${portal}/api${profile}`)).status(),
      ).toBe(404);
      await directory.goto(portal + profile);
      await expect(
        directory.getByRole("heading", { name: "Worker not found" }),
      ).toBeVisible();
      await directory.getByRole("link", { name: "Back to workers" }).click();
      await expect(directory).toHaveURL(`${portal}/workers`);
    });
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
  }
});
