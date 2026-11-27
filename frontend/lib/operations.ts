export const sites = [
  { id: "S-01", name: "Harbour East" },
  { id: "S-02", name: "Riverside Works" },
];

export function siteLabel(id: string) {
  return sites.find((site) => site.id === id)?.name ?? id;
}

export function alertTitle(type: string) {
  switch (type) {
    case "REPEATED_DENIAL":
      return "Repeated access denials";
    case "EXPIRED_TICKET_ACCESS":
      return "Access attempted with an expired safety ticket";
    default:
      return readableCode(type);
  }
}

export function readableCode(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .toLowerCase()
    .replace(/^./, (initial) => initial.toUpperCase());
}

export function readText(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export function readPage(value: string | string[] | undefined) {
  const raw = readText(value);
  const number = Number(raw);
  return /^\d{1,8}$/.test(raw) && number > 0 ? number : 1;
}

export function formatUtc(value: string) {
  return `${new Date(value).toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
