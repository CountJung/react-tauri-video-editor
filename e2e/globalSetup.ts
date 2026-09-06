// @ts-expect-error — plain JS helper without type declarations
import { ensureFixtures } from '../scripts/make-e2e-fixtures.mjs'

export default function globalSetup(): void {
  ensureFixtures()
}
