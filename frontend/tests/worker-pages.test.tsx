// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import NewWorkerPage from "@/app/(portal)/workers/new/page";
import WorkerLoading from "@/app/(portal)/workers/loading";
import WorkerNotFound from "@/app/(portal)/workers/[id]/not-found";
import WorkerPage from "@/app/(portal)/workers/[id]/page";
import WorkersPage from "@/app/(portal)/workers/page";
import { getWorkerPortalRole } from "@/lib/workers/worker-access";

const { refresh, notFound, fetchWorkerService } = vi.hoisted(() => ({
  refresh: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("Worker profile missing");
  }),
  fetchWorkerService: vi.fn<typeof fetch>(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
  notFound,
}));
vi.mock("@/lib/workers/worker-access", () => ({
  getWorkerPortalRole: vi.fn(),
}));

const workerId = "111111111111111111111111";
const emptyDirectory = {
  items: [],
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
};
const directory = (searchParams = {}) =>
  WorkersPage({ searchParams: Promise.resolve(searchParams) });
const profile = () =>
  WorkerPage({
    params: Promise.resolve({ id: workerId }),
    searchParams: Promise.resolve({}),
  });

function respondToWorkerReads(responses: Record<string, () => Response>) {
  fetchWorkerService.mockImplementation(async (input) => {
    const url = new URL(input.toString());
    const respond = responses[url.pathname];
    if (!respond) throw new Error(`Unexpected Worker read at ${url.pathname}`);
    return respond();
  });
}

beforeEach(() => {
  refresh.mockClear();
  notFound.mockClear();
  fetchWorkerService.mockReset();
  vi.mocked(getWorkerPortalRole).mockReset().mockResolvedValue("Admin");
  vi.stubGlobal("fetch", fetchWorkerService);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("announces loading while keeping decorative placeholders out of the accessibility tree", () => {
  render(<WorkerLoading />);
  const status = screen.getByRole("status");
  expect(status.textContent).toBe("Loading worker data…");
  expect(status.querySelector('[aria-hidden="true"]')).not.toBeNull();
});

test.each([
  ["directory", directory, "Could not load workers"],
  ["registration", NewWorkerPage, "Could not load contractors"],
  ["profile", profile, "Could not load the worker profile"],
] as const)(
  "shows a retry action when the Worker Service is unavailable on the %s",
  async (_, load, heading) => {
    fetchWorkerService.mockRejectedValue(new TypeError("Connection refused"));
    render(await load());

    expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    expect(screen.queryByText("Connection refused")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledOnce();
  },
);

test("lets an Admin start registration when the directory is empty", async () => {
  respondToWorkerReads({
    "/workers": () => Response.json(emptyDirectory),
    "/contractors": () => Response.json([]),
  });
  render(await directory());

  expect(screen.getByRole("heading", { name: "No workers yet" })).toBeTruthy();
  expect(
    screen
      .getAllByRole("link", { name: "Add worker" })
      .at(-1)
      ?.getAttribute("href"),
  ).toBe("/workers/new");
});

test("offers to clear a search that returned no workers", async () => {
  respondToWorkerReads({
    "/workers": () => Response.json(emptyDirectory),
    "/contractors": () => Response.json([]),
  });
  render(await directory({ search: "Unlisted worker" }));

  expect(
    screen.getByRole("heading", { name: "No workers match your filters" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Clear filters" }).getAttribute("href"),
  ).toBe("/workers");
});

test("explains that registration needs an active contractor", async () => {
  respondToWorkerReads({ "/contractors": () => Response.json([]) });
  render(await NewWorkerPage());

  expect(
    screen.getByRole("heading", { name: "No active contractors" }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save worker" })).toBeNull();
});

test("routes unknown worker IDs to the missing profile screen", async () => {
  respondToWorkerReads({
    [`/workers/${workerId}`]: () =>
      Response.json({ code: "WORKER_NOT_FOUND" }, { status: 404 }),
    "/contractors": () => Response.json([]),
  });
  await expect(profile()).rejects.toThrow("Worker profile missing");
  expect(notFound).toHaveBeenCalledOnce();
  render(<WorkerNotFound />);

  expect(
    screen.getByRole("heading", { name: "Worker not found" }),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Back to workers" }).getAttribute("href"),
  ).toBe("/workers");
});
