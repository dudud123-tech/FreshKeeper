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

  const baseSize = assetSize?.width && assetSize?.height ? assetSize : displaySize;
  if (coordinateSize?.width && coordinateSize?.height && baseSize?.width && baseSize?.height) {
    const widthRatio = coordinateSize.width / baseSize.width;
    const heightRatio = coordinateSize.height / baseSize.height;
    if (widthRatio > 0.75 && widthRatio < 1.25 && heightRatio > 0.55 && heightRatio < 1.25) {
      pushOption("모바일", baseSize);
    } else {
      pushOption("모바일", {
        width: coordinateSize.width,
        height: Math.round(baseSize.height * (coordinateSize.width / baseSize.width))
      });
    }
  }

  pushOption("실물", displaySize);

  if (assetSize?.width && assetSize?.height) {
    pushOption("원본", assetSize);
    pushOption("회전", { width: assetSize.height, height: assetSize.width });
  }

  return options.length ? options : [{ label: "기본", size: displaySize || coordinateSize }];
}

export function draftNameForOcrLine(line) {
  return parseReceiptLines(line.text)[0] || line.text.trim();
}

export function isOcrLineInDrafts(line, drafts) {
  const draftName = draftNameForOcrLine(line).replace(/\s/g, "");
  const lineText = line.text.replace(/\s/g, "");
  return drafts.some((draft) => {
    const normalizedDraft = draft.replace(/\s/g, "");
    return normalizedDraft === draftName || lineText.includes(normalizedDraft) || draftName.includes(normalizedDraft);
  });
}
