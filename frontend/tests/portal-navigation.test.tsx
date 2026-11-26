// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { afterEach, expect, test, vi } from "vitest";
import {
  PortalNavigation,
  PortalSection,
} from "@/components/portal-navigation";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

afterEach(cleanup);

test.each([
  ["/workers", "Workers", "Workers"],
  ["/workers/new", "Workers", "Workers / Add worker"],
  ["/workers/worker-id", "Workers", "Workers / Profile"],
  ["/workers/worker-id/audit", "Audit", "Audit / Worker history"],
  ["/sites/S-01/on-site", "Access", "Access / On site"],
  ["/gates", "Access", "Access"],
  ["/alerts", "Audit", "Audit"],
])("marks the right section for %s", (path, section, location) => {
  vi.mocked(usePathname).mockReturnValue(path);
  render(
    <>
      <PortalNavigation />
      <div aria-label="Current location" role="status">
        <PortalSection />
      </div>
    </>,
  );

  const navigation = screen.getByRole("navigation", {
    name: "Main navigation",
  });
  const activeLinks = within(navigation).getAllByRole("link", {
    current: "location",
  });
  expect(activeLinks).toHaveLength(1);
  expect(activeLinks[0]).toBe(
    within(navigation).getByRole("link", { name: section }),
  );
  expect(
    screen.getByRole("status", { name: "Current location" }).textContent,
  ).toBe(location);
});
