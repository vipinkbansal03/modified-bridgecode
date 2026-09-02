const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert");

const source = fs.readFileSync(
  path.join(__dirname, "../src/utils/uploadMedia.ts"),
  "utf8"
);
const mediaServiceSource = fs.readFileSync(
  path.join(__dirname, "../../backend/src/modules/media/media.service.ts"),
  "utf8"
);
const productsServiceSource = fs.readFileSync(
  path.join(__dirname, "../../backend/src/modules/products/products.service.ts"),
  "utf8"
);

assert.match(
  source,
  /const confirmRes = await adminApi\.post\("\/media\/confirm", \{ mediaId \}\);/,
  "Presigned uploads must wait for backend confirmation."
);

assert.match(
  source,
  /const confirmedUrl = confirmRes\.data\?\.data\?\.url;/,
  "Presigned uploads must read the final URL from the confirm response."
);

assert.doesNotMatch(
  source,
  /results\.push\(\{\s*url:\s*[^}]*\bkey\b/s,
  "Presigned uploads must not return the temporary presign key."
);

assert.match(
  source,
  /confirmedUrl\.startsWith\("temporary\/"\)/,
  "Presigned uploads must reject temporary URLs after confirmation."
);

assert.match(
  mediaServiceSource,
  /readyMedia\.url\.startsWith\("temporary\/"\)/,
  "Confirm upload must reject persisted temporary media URLs."
);

assert.match(
  mediaServiceSource,
  /url:\s*uploadResult\.primaryUrl/,
  "Confirm upload must persist the final optimized media URL."
);

assert.match(
  productsServiceSource,
  /media\.url\.startsWith\("temporary\/"\)/,
  "Product media linking must reject unconfirmed temporary media URLs."
);

console.log("uploadMediaFiles presigned URL contract passed.");
