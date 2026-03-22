// A simple script to benchmark the sequential vs parallel inserts
class MockDB {
  async addImage(file) {
    // Simulate DB delay
    return new Promise(resolve => setTimeout(() => resolve(Math.random()), 5));
  }
}

async function sequential(files, db) {
  let count = 0;
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    await db.addImage(file);
    count++;
  }
  return count;
}

async function parallel(files, db) {
  let count = 0;
  const promises = Array.from(files).map(async (file) => {
    if (!file.type.startsWith('image/')) return;
    await db.addImage(file);
    count++; // Need atomic increment or reduce later, but for this mock let's ignore safety for counting
  });
  await Promise.all(promises);
  return count;
}

async function run() {
  const db = new MockDB();
  const files = Array(100).fill({ type: 'image/jpeg' });

  const startSeq = performance.now();
  await sequential(files, db);
  const endSeq = performance.now();

  const startPar = performance.now();
  await parallel(files, db);
  const endPar = performance.now();

  console.log(`Sequential: ${(endSeq - startSeq).toFixed(2)}ms`);
  console.log(`Parallel: ${(endPar - startPar).toFixed(2)}ms`);
}

run();
