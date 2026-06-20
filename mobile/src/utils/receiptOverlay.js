import { Image } from "react-native";
import { parseReceiptLines } from "../receiptParser";

export function getImageDisplaySize(imageUri, fallbackSize = null) {
  return new Promise((resolve) => {
    Image.getSize(
      imageUri,
      (width, height) => resolve({ width, height }),
      () => resolve(fallbackSize || { width: 0, height: 0 })
    );
  });
}

export function frameForBox(box, imageSize, layout, minWidth, minHeight, heightRatio = 1) {
  if (!box || !imageSize.width || !imageSize.height || !layout.width || !layout.height) return null;
  const scale = Math.min(layout.width / imageSize.width, layout.height / imageSize.height);
  const renderedWidth = imageSize.width * scale;
  const renderedHeight = imageSize.height * scale;
  const offsetX = (layout.width - renderedWidth) / 2;
  const offsetY = (layout.height - renderedHeight) / 2;
  const fullHeight = Math.max(box.height * scale, minHeight);
  const visualHeight = Math.max(fullHeight * heightRatio, minHeight);

  return {
    left: offsetX + box.x * scale,
    top: offsetY + box.y * scale + (fullHeight - visualHeight) / 2,
    width: Math.max(box.width * scale, minWidth),
    height: visualHeight
  };
}

export function buildOcrCoordinateOptions(coordinateSize, displaySize, assetSize = null) {
  const options = [];
  const pushOption = (label, size) => {
    if (!size?.width || !size?.height) return;
    const duplicate = options.some((option) => Math.abs(option.size.width - size.width) < 2 && Math.abs(option.size.height - size.height) < 2);
    if (!duplicate) options.push({ label, size });
  };

  const baseSize = displaySize?.width && displaySize?.height ? displaySize : assetSize;
  if (coordinateSize?.width && coordinateSize?.height && baseSize?.width && baseSize?.height) {
    const widthRatio = coordinateSize.width / baseSize.width;
    const heightRatio = coordinateSize.height / baseSize.height;
    if (widthRatio > 0.75 && widthRatio < 1.25 && heightRatio > 0.55 && heightRatio < 1.25) {
      pushOption("\ubaa8\ubc14\uc77c", baseSize);
    } else {
      pushOption("\ubaa8\ubc14\uc77c", {
        width: coordinateSize.width,
        height: Math.round(baseSize.height * (coordinateSize.width / baseSize.width))
      });
    }
  }

  pushOption("\ud654\uba74", displaySize);

  if (assetSize?.width && assetSize?.height) {
    pushOption("\uc6d0\ubcf8", assetSize);
    pushOption("\ud68c\uc804", { width: assetSize.height, height: assetSize.width });
  }

  return options.length ? options : [{ label: "\uae30\ubcf8", size: displaySize || coordinateSize }];
}

export function draftNameForOcrLine(line) {
  return parseReceiptLines(line.text)[0] || line.text.trim();
}

export function chooseBestOcrCoordinateOption(options, lines, drafts = []) {
  if (!Array.isArray(options) || options.length <= 1) return { index: 0, score: 0 };

  const scoredOptions = options.map((option, index) => ({
    index,
    score: scoreOcrCoordinateOption(option?.size, lines, drafts)
  }));

  scoredOptions.sort((a, b) => b.score - a.score);
  return scoredOptions[0] || { index: 0, score: 0 };
}

export function isOcrLineInDrafts(line, drafts) {
  const draftName = draftNameForOcrLine(line).replace(/\s/g, "");
  const lineText = line.text.replace(/\s/g, "");
  return drafts.some((draft) => {
    const normalizedDraft = draft.replace(/\s/g, "");
    return normalizedDraft === draftName || lineText.includes(normalizedDraft) || draftName.includes(normalizedDraft);
  });
}

function scoreOcrCoordinateOption(size, lines, drafts) {
  if (!size?.width || !size?.height || !Array.isArray(lines) || lines.length === 0) return -1000;

  let score = 0;
  let validBoxCount = 0;
  let candidateBoxCount = 0;
  const yCenters = [];

  lines.forEach((line) => {
    const box = line?.box;
    if (!box) return;

    const left = Number(box.x);
    const top = Number(box.y);
    const width = Number(box.width);
    const height = Number(box.height);
    const right = left + width;
    const bottom = top + height;
    if (![left, top, width, height, right, bottom].every(Number.isFinite) || width <= 0 || height <= 0) return;

    const isInside = left >= -size.width * 0.03 &&
      top >= -size.height * 0.03 &&
      right <= size.width * 1.03 &&
      bottom <= size.height * 1.03;

    if (isInside) {
      score += 6;
      validBoxCount += 1;
    } else {
      score -= 18;
    }

    const widthRatio = width / size.width;
    const heightRatio = height / size.height;
    if (widthRatio > 0.015 && widthRatio < 0.98) score += 1;
    else score -= 4;
    if (heightRatio > 0.003 && heightRatio < 0.12) score += 2;
    else score -= 5;
    if (widthRatio > 0.05 && widthRatio < 0.75 && heightRatio > 0.005 && heightRatio < 0.07) score += 2;

    yCenters.push(top + height / 2);

    if (isOcrLineInDrafts(line, drafts)) {
      candidateBoxCount += 1;
      score += isInside ? 16 : -16;
      if (widthRatio > 0.08 && widthRatio < 0.85 && heightRatio > 0.006 && heightRatio < 0.08) score += 8;
    }
  });

  if (validBoxCount === 0) score -= 120;
  if (candidateBoxCount === 0 && drafts.length > 0) score -= 30;

  if (yCenters.length > 2) {
    const minY = Math.min(...yCenters);
    const maxY = Math.max(...yCenters);
    const spread = (maxY - minY) / size.height;
    if (spread > 0.12 && spread < 0.98) score += 18;
    else score -= 12;
  }

  return score;
}
