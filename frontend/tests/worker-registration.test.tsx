// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useWorkerRegistration } from "@/lib/workers/use-worker-registration";

const { push, send } = vi.hoisted(() => ({
  push: vi.fn(),
  send: vi.fn<typeof fetch>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const input = {
  fullName: "Demo Worker",
  contractorId: "111111111111111111111111",
  credentialNumber: "DEMO-01",
  inductionDate: "2020-01-01",
  safetyTicketExpiry: "2035-01-01",
  assignedSiteIds: ["S-01"],
};

function startForm(values = input) {
  const hook = renderHook(() => {
    const flow = useWorkerRegistration();
    return { ...flow, errors: flow.form.formState.errors };
  });
  act(() => hook.result.current.form.reset(values));
  return hook.result;
}

beforeEach(() => {
  push.mockReset();
  send.mockReset();
  vi.stubGlobal("fetch", send);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("opens the saved worker's profile with a registration confirmation", async () => {
  const id = "222222222222222222222222";
  send.mockResolvedValue(
    Response.json({ ...input, id, status: "Active" }, { status: 201 }),
  );
  const form = startForm();

  await act(async () => {
    await form.current.submit();
  });

  expect(send).toHaveBeenCalledExactlyOnceWith("/api/workers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  expect(push).toHaveBeenCalledExactlyOnceWith(`/workers/${id}?registered=1`);
});

test("shows a duplicate credential error on its field and keeps the entered values", async () => {
  send.mockResolvedValue(
    Response.json(
      {
        code: "CREDENTIAL_IN_USE",
        message: "This credential is already in use",
      },
      { status: 409 },
    ),
  );
  const form = startForm();

  await act(async () => {
    await form.current.submit();
  });

  expect(form.current.errors.credentialNumber?.message).toBe(
    "This credential is already in use",
  );
  expect(form.current.form.getValues()).toEqual(input);
  expect(push).not.toHaveBeenCalled();
});

test("rejects a future induction date before sending a request", async () => {
  const form = startForm({ ...input, inductionDate: "2999-01-01" });
  await act(async () => {
    await form.current.submit();
  });
  expect(form.current.errors.inductionDate?.message).toBe(
    "Induction date must be today or earlier.",
  );
  expect(send).not.toHaveBeenCalled();
});

test("keeps an unconfirmed save visible without retrying the registration", async () => {
  const message =
    "The worker was saved, but we could not confirm the registration event.";
  send.mockResolvedValue(
    Response.json(
      {
        code: "REGISTRATION_EVENT_UNCONFIRMED",
        message,
      },
      { status: 503 },
    ),
  );
  const form = startForm();

  await act(async () => {
    await form.current.submit();
  });

  expect(form.current.errors.root?.message).toBe(message);
  expect(form.current.form.getValues()).toEqual(input);
  expect(send).toHaveBeenCalledTimes(1);
  expect(push).not.toHaveBeenCalled();
});
