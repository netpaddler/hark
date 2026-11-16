// Giscus talks to GitHub Discussions on netpaddler/hark.
// repoId is the repository node id. Category ids stay empty until Discussions
// is enabled and the two categories exist. Paste each id from https://giscus.app.
// A category id looks like DIC_kwDO... Leave it empty to show "Comments are coming soon."

export const giscusConfig = {
  repo: "netpaddler/hark",
  repoId: "R_kgDOVwYmxQ",
  requests: {
    category: "Requests",
    categoryId: "",
    term: "Requests",
  },
  hymnComments: {
    category: "Hymn Comments",
    categoryId: "",
  },
};

export function hymnTerm(number) {
  return `TH ${number}`;
}

export function giscusReady(categoryId) {
  return typeof categoryId === "string" && categoryId.startsWith("DIC_");
}

export function giscusTheme(theme) {
  return theme === "dark" ? "dark" : "light";
}
