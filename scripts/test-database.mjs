import assert from "node:assert/strict";

export async function dropTestSchema(pool, schema) {
  assert(/^commerce_test_[a-f0-9]{32}$/.test(schema), "Only generated commerce test schemas can be removed.");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      return;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}
