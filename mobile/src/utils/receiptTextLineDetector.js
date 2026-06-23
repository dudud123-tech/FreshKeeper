import { NativeModules, Platform } from "react-native";

const ReceiptImageNormalizer = NativeModules.ReceiptImageNormalizer;

export async function detectReceiptTextLineBoxes(imageUri) {
  if (Platform.OS !== "android" || !ReceiptImageNormalizer?.detectTextLineBoxes) {
    return [];
  }

  try {
    const boxes = await ReceiptImageNormalizer.detectTextLineBoxes(imageUri);
    return Array.isArray(boxes) ? boxes.map(normalizeDetectedBox).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export function alignOcrLinesWithDetectedBoxes(lines, detectedBoxes, boxSource = "opencv-text-line") {
  if (!Array.isArray(lines) || !Array.isArray(detectedBoxes)) return lines || [];
  const linesWithBoxes = lines.filter((line) => line?.box);
  const lineBoxes = boxSource === "dbnet-text-line" ? groupDetectedBoxesIntoRows(detectedBoxes) : detectedBoxes;
  if (linesWithBoxes.length < 4 || lineBoxes.length < Math.max(4, linesWithBoxes.length * 0.35)) {
    return lines;
  }

  const sortedLines = [...linesWithBoxes].sort((a, b) => centerY(a.box) - centerY(b.box));
  const sortedBoxes = [...lineBoxes].sort((a, b) => centerY(a) - centerY(b));
  const lineToBox = boxSource === "dbnet-text-line"
    ? matchLinesToBoxesByAnchoredY(sortedLines, sortedBoxes)
    : matchLinesToBoxesByRank(sortedLines, sortedBoxes);

  if (boxSource === "dbnet-text-line" && !isReliableDbnetMatch(sortedLines, sortedBoxes, lineToBox)) {
    return lines;
  }

  return lines.map((line) => {
    const detectedBox = lineToBox.get(line.id);
    if (!detectedBox) return line;
    return {
      ...line,
      originalBox: line.box,
      box: detectedBox,
      boxSource
    };
  });
}

function matchLinesToBoxesByRank(sortedLines, sortedBoxes) {
  const lineToBox = new Map();
  sortedLines.forEach((line, index) => {
    const boxIndex = sortedLines.length <= 1
      ? 0
      : Math.round((index * (sortedBoxes.length - 1)) / (sortedLines.length - 1));
    const detectedBox = sortedBoxes[boxIndex];
    if (detectedBox) lineToBox.set(line.id, detectedBox);
  });
  return lineToBox;
}

function matchLinesToBoxesByAnchoredY(sortedLines, sortedBoxes) {
  const lineToBox = new Map();
  if (!sortedLines.length || !sortedBoxes.length) return lineToBox;

  const lineCenters = sortedLines.map((line) => centerY(line.box));
  const boxCenters = sortedBoxes.map(centerY);
  const lineRange = trimmedRange(lineCenters);
  const boxRange = trimmedRange(boxCenters);
  const lineSpread = Math.max(1, lineRange.max - lineRange.min);
  const boxSpread = Math.max(1, boxRange.max - boxRange.min);
  const medianHeight = median(sortedBoxes.map((box) => Number(box.height || 0)).filter((height) => height > 0)) || 8;
  const averageGap = sortedBoxes.length > 1 ? boxSpread / (sortedBoxes.length - 1) : medianHeight;
  const maxDistance = Math.max(medianHeight * 1.35, averageGap * 0.42);
  const used = new Set();

  sortedLines.forEach((line) => {
    const relativeY = (centerY(line.box) - lineRange.min) / lineSpread;
    const expectedY = boxRange.min + relativeY * boxSpread;
    let bestIndex = -1;
    let bestDistance = Infinity;

    sortedBoxes.forEach((box, index) => {
      if (used.has(index)) return;
      const distance = Math.abs(centerY(box) - expectedY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    if (bestIndex >= 0 && bestDistance <= maxDistance) {
      used.add(bestIndex);
      lineToBox.set(line.id, sortedBoxes[bestIndex]);
    }
  });

  return lineToBox;
}

export function groupDetectedBoxesIntoRows(boxes) {
  if (!Array.isArray(boxes) || boxes.length === 0) return [];
  const normalizedBoxes = boxes.filter((box) => box?.width > 0 && box?.height > 0);
  const medianHeight = median(normalizedBoxes.map((box) => Number(box.height || 0)).filter((height) => height > 0)) || 8;
  const medianWidth = median(normalizedBoxes.map((box) => Number(box.width || 0)).filter((width) => width > 0)) || 20;
  const validBoxes = normalizedBoxes
    .filter((box) => !isLikelySeparatorBox(box, medianWidth, medianHeight))
    .filter((box) => box?.width > 0 && box?.height > 0)
    .sort((a, b) => centerY(a) - centerY(b) || Number(a.x || 0) - Number(b.x || 0));
  const rows = [];

  validBoxes.forEach((box) => {
    const y = centerY(box);
    const height = Number(box.height || 0);
    const row = rows.find((candidate) => {
      const candidateHeight = Math.max(candidate.height, height, 1);
      return Math.abs(centerY(candidate) - y) <= candidateHeight * 0.65;
    });

    if (!row) {
      rows.push({ ...box });
      return;
    }

    const x1 = Math.min(row.x, box.x);
    const y1 = Math.min(row.y, box.y);
    const x2 = Math.max(row.x + row.width, box.x + box.width);
    const y2 = Math.max(row.y + row.height, box.y + box.height);
    row.x = x1;
    row.y = y1;
    row.width = x2 - x1;
    row.height = y2 - y1;
  });

  return rows
    .filter((box) => box.width >= 12 && box.height >= 5)
    .sort((a, b) => centerY(a) - centerY(b) || Number(a.x || 0) - Number(b.x || 0));
}

function isReliableDbnetMatch(sortedLines, sortedBoxes, lineToBox) {
  const minMatches = Math.max(4, sortedLines.length * 0.32);
  if (lineToBox.size < minMatches) return false;

  const matchedDistances = [];
  const matchedHeights = [];
  sortedLines.forEach((line) => {
    const box = lineToBox.get(line.id);
    if (!box) return;
    matchedDistances.push(Math.abs(centerY(line.box) - centerY(box)));
    matchedHeights.push(Number(box.height || 0));
  });

  const medianDistance = median(matchedDistances);
  const medianHeight = median(matchedHeights) || 8;
  return medianDistance <= Math.max(medianHeight * 2.6, 18);
}

function isLikelySeparatorBox(box, medianWidth, medianHeight) {
  const width = Number(box.width || 0);
  const height = Number(box.height || 0);
  if (height <= 0 || width <= 0) return true;
  const veryThin = height <= Math.max(3, medianHeight * 0.45);
  const unusuallyWide = width >= Math.max(medianWidth * 2.8, 120);
  return veryThin && unusuallyWide;
}

function trimmedRange(values) {
  if (!values.length) return { min: 0, max: 1 };
  const sorted = [...values].sort((a, b) => a - b);
  const lowIndex = Math.floor((sorted.length - 1) * 0.08);
  const highIndex = Math.ceil((sorted.length - 1) * 0.92);
  return {
    min: sorted[lowIndex],
    max: sorted[highIndex]
  };
}

function normalizeDetectedBox(box) {
  const x = Number(box?.x);
  const y = Number(box?.y);
  const width = Number(box?.width);
  const height = Number(box?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  return { x, y, width, height };
}

function centerY(box) {
  return Number(box?.y || 0) + Number(box?.height || 0) / 2;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
