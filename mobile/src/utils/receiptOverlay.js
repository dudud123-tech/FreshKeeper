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

// 오른쪽 끝 부근 줄은 실제 상품명이 아니라 아이콘·뱃지 같은 UI 요소일 가능성이 크다 —
// 쿠팡 주문내역 화면 레이아웃에서 진짜 상품명 줄이라면 항상 같은 행 왼쪽에 상품 썸네일이
// 있어야 한다(2026-08-15 피드백, 우측 상단 검색/장바구니 아이콘 오탐 대응). 처음엔
// "왼쪽에 텍스트가 있는지"로 판단했는데, 헤더 줄의 "coupang" 로고 글자처럼 아이콘과
// 같은 Y에 다른 텍스트가 같이 인식되면 안 걸러지는 문제가 있었다(2026-08-15 재확인).
// 텍스트가 아니라 실제 감지된 상품 썸네일(이미지) 위치를 기준으로 판단해야 한다 —
// 헤더 아이콘은 왼쪽에 텍스트(로고)가 있을 순 있어도 상품 썸네일은 절대 없다.
const RIGHT_EDGE_ZONE_RATIO = 0.8;

export function filterIsolatedRightEdgeLines(lines, coordinateWidth, coordinateHeight, imageBoxes = []) {
  if (!Array.isArray(lines) || !coordinateWidth) return lines;

  return lines.filter((line) => {
    const box = line?.box;
    if (!box || !Number.isFinite(box.x) || !Number.isFinite(box.width)) return true;
    // 줄 시작(x)이 아니라 중심 좌표로 "오른쪽 끝인지"를 판단한다. 시작 좌표로 판단하면
    // 아이콘이 폭 넓은 글자로 오인식됐을 때(예: 돋보기 아이콘 → "a박", 폭 180px) 시작점이
    // 왼쪽으로 밀려 경계값을 살짝 비껴가는 경우가 있었다(2026-08-15, 실기기 로그로 확인 —
    // x=862가 경계 864를 2px 차이로 통과해버림). 실제 상품명 줄은 폭이 넓어도 왼쪽
    // x=318 부근에서 시작해 중심이 항상 오른쪽 경계보다 한참 왼쪽에 남는다.
    const boxCenterX = box.x + box.width / 2;
    if (boxCenterX < coordinateWidth * RIGHT_EDGE_ZONE_RATIO) return true;

    const centerY = box.y + box.height / 2;
    const yTolerance = Math.max(12, box.height * 0.7);
    const hasImageNeighbor = imageBoxes.some((imageBox) => {
      if (!imageBox || !Number.isFinite(imageBox.x) || !Number.isFinite(imageBox.y)) return false;
      const imageCenterY = imageBox.y + imageBox.height / 2;
      return Math.abs(imageCenterY - centerY) <= yTolerance && imageBox.x < box.x;
    });
    return hasImageNeighbor;
  });
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
