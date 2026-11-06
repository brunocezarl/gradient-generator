import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { expect, test } from "vitest"

test("lint checks hooks noninteractively and reports React hook violations", () => {
  const dir = mkdtempSync(path.join(process.cwd(), "hooks", "lint-fixture-"))
  try {
    writeFileSync(path.join(dir, "broken.tsx"), `import { useState } from "react"
export function Broken({ enabled }: { enabled: boolean }) {
  if (enabled) useState(0)
  return null
}
`)
    let output = ""
    let status = 0
    try {
      execFileSync("npm", ["run", "lint", "--", "--no-cache"], { encoding: "utf8", stdio: "pipe" })
    } catch (error) {
      const failure = error as { status: number; stdout: string; stderr: string }
      status = failure.status
      output = failure.stdout + failure.stderr
    }
    expect(status).not.toBe(0)
    expect(output).toContain("react-hooks/rules-of-hooks")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 30_000)
