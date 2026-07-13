function shouldSyncStorefrontVisibility(status, previousStatus) {
  const resolvedStatus = String(status ?? previousStatus ?? "DRAFT").toUpperCase();
  return resolvedStatus === "ACTIVE";
}

module.exports = {
  shouldSyncStorefrontVisibility,
};
