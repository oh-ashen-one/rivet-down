import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the complete RIVET//DOWN campaign shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>RIVET\/\/DOWN — Industrial Rhythm Rage<\/title>/i);
  assert.match(html, /RIVET SYSTEMS/);
  assert.match(html, /SYNCING LINE/);
  assert.match(html, /manifest\.webmanifest/);
  assert.match(html, /og:image/);
  assert.match(html, /http:\/\/localhost:3000\/og\.png/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("keeps starter preview code out of the product", async () => {
  const [page, layout, menu, serviceWorker, levels, packageJson, previewFiles] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(
        new URL("../app/components/RivetDown.tsx", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
      readFile(new URL("../src/game/levels.ts", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readdir(new URL("../app/_sites-preview/", import.meta.url)).catch(
        () => [],
      ),
    ]);

  assert.match(page, /<RivetDown \/>/);
  assert.match(layout, /const title = "RIVET\/\/DOWN/);
  assert.match(layout, /manifest\.webmanifest/);
  assert.match(menu, /href="https:\/\/github\.com\/oh-ashen-one\/rivet-down"/);
  assert.match(menu, /aria-label="Open the RIVET\/\/DOWN source code on GitHub"/);
  assert.match(menu, /Fresh game files required\./);
  assert.match(menu, /Reload game/);
  assert.match(serviceWorker, /const CACHE_NAME = "rivet-down-v2"/);
  assert.match(serviceWorker, /await fetch\(event\.request\)/);
  assert.doesNotMatch(serviceWorker, /return cached \|\| refreshed/);
  for (const title of [
    "Cold Start",
    "Pressure Line",
    "Polarity Shaft",
    "Turbine Blackout",
    "Meltdown Zero",
  ]) {
    assert.match(levels, new RegExp(title));
  }
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.deepEqual(previewFiles, []);
  await access(new URL("schemas/level-definition.schema.json", projectRoot));
  await access(new URL("docs/SUNO_PROMPTS.md", projectRoot));
});
