import { readFile, writeFile } from "node:fs/promises";
import { SpzReader, SpzWriter } from "@sparkjsdev/spark";

const [inputPath, outputPath] = process.argv.slice(2);
const source = await readFile(inputPath);
const reader = new SpzReader({ fileBytes: source });
await reader.parseHeader();

const keptSplats = reader.numSplats - Math.ceil(reader.numSplats / 5);
const writer = new SpzWriter({
  numSplats: keptSplats,
  shDegree: reader.shDegree,
  fractionalBits: reader.fractionalBits,
  flagAntiAlias: reader.flagAntiAlias,
});

const targetIndex = (sourceIndex) => {
  if (sourceIndex % 5 === 0) return -1;
  return sourceIndex - Math.floor(sourceIndex / 5) - 1;
};

await reader.parseSplats(
  (index, x, y, z) => {
    const target = targetIndex(index);
    if (target >= 0) writer.setCenter(target, x, y, z);
  },
  (index, alpha) => {
    const target = targetIndex(index);
    if (target >= 0) writer.setAlpha(target, alpha);
  },
  (index, r, g, b) => {
    const target = targetIndex(index);
    if (target >= 0) writer.setRgb(target, r, g, b);
  },
  (index, x, y, z) => {
    const target = targetIndex(index);
    if (target >= 0) writer.setScale(target, x, y, z);
  },
  (index, x, y, z, w) => {
    const target = targetIndex(index);
    if (target >= 0) writer.setQuat(target, x, y, z, w);
  },
  (index, sh1, sh2, sh3) => {
    const target = targetIndex(index);
    if (target >= 0) writer.setSh(target, sh1, sh2, sh3);
  },
);

const reduced = await writer.finalize();
await writeFile(outputPath, reduced);
console.log(
  JSON.stringify({
    splatsBefore: reader.numSplats,
    splatsAfter: keptSplats,
    bytesBefore: source.byteLength,
    bytesAfter: reduced.byteLength,
  }),
);
