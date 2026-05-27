import { sampleReceiptText } from "./sampleReceipt";

export async function recognizeReceiptImage(imageUri) {
  try {
    const textRecognitionModule = await import("@react-native-ml-kit/text-recognition");
    const TextRecognition = textRecognitionModule.default || textRecognitionModule;
    const script = textRecognitionModule.TextRecognitionScript?.KOREAN || "Korean";
    const result = await TextRecognition.recognize(imageUri, script);
    const lines = normalizeRecognitionLines(result);
    logRecognitionDebug(result, lines);
    const text = normalizeRecognitionText(result);

    if (!text) {
      return {
        mode: "empty",
        text: "",
        message: "글자를 찾지 못했습니다. 영수증을 밝은 곳에서 다시 촬영해 주세요."
      };
    }

    return {
      mode: "real",
      text,
      lines,
      coordinateSize: estimateCoordinateSize(lines),
      message: "영수증에서 상품 후보를 만들었습니다."
    };
  } catch (error) {
    await delay(450);
    return {
      mode: "sample",
      text: sampleReceiptText,
      lines: sampleReceiptText.split(/\n+/).map((text, index) => ({
        id: `sample-${index}`,
        text,
        box: null
      })),
      coordinateSize: null,
      message:
        "현재 앱에서는 실제 인식 모듈을 사용할 수 없어 테스트용 결과를 적용했습니다. 개발 빌드에서 실제 영수증 인식이 실행됩니다."
    };
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeRecognitionText(result) {
  if (!result) return "";
  if (typeof result === "string") return result.trim();
  if (typeof result.text === "string") return result.text.trim();
  const lines = normalizeRecognitionLines(result);
  if (lines.length) return lines.map((line) => line.text).join("\n").trim();
  if (Array.isArray(result.blocks)) {
    return result.blocks
      .map((block) => block?.text)
      .filter(Boolean)
      .join("\n")
      .trim();
  }
  return "";
}

function normalizeRecognitionLines(result) {
  const sourceLines = [];

  if (Array.isArray(result?.blocks)) {
    result.blocks.forEach((block) => {
      if (Array.isArray(block?.lines) && block.lines.length) {
        block.lines.forEach((line) => sourceLines.push(line));
      } else if (block?.text) {
        sourceLines.push(block);
      }
    });
  }

  if (!sourceLines.length && Array.isArray(result?.lines)) {
    sourceLines.push(...result.lines);
  }

  return sourceLines
    .map((line, index) => {
      const text = normalizeLineText(line);
      if (!text) return null;
      return {
        id: `ocr-${index}-${text.slice(0, 16)}`,
        text,
        box: normalizeBox(line)
      };
    })
    .filter(Boolean);
}

function normalizeLineText(line) {
  if (!line) return "";
  if (typeof line === "string") return line.trim();
  return String(line.text || line.value || line.inferText || "").trim();
}

function normalizeBox(line) {
  const box = line?.frame || line?.boundingBox || line?.bounds || line?.rect;
  if (box) {
    const x = numberOr(box.x, box.left, box.origin?.x);
    const y = numberOr(box.y, box.top, box.origin?.y);
    const width = numberOr(box.width, box.w, box.size?.width, box.right - box.left);
    const height = numberOr(box.height, box.h, box.size?.height, box.bottom - box.top);
    if ([x, y, width, height].every((value) => Number.isFinite(value))) {
      return { x, y, width, height };
    }
  }

  const points = line?.cornerPoints || line?.points;
  if (Array.isArray(points) && points.length) {
    const xs = points.map((point) => numberOr(point.x, point[0])).filter(Number.isFinite);
    const ys = points.map((point) => numberOr(point.y, point[1])).filter(Number.isFinite);
    if (xs.length && ys.length) {
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
  }

  return null;
}

function logRecognitionDebug(result, lines) {
  try {
    const blocks = Array.isArray(result?.blocks) ? result.blocks : [];
    const firstBlock = blocks[0];
    const firstLine = firstBlock?.lines?.[0] || firstBlock || result?.lines?.[0];
    console.log(
      "[freshkeeper:ocr-debug]",
      JSON.stringify(
        {
          resultKeys: result ? Object.keys(result) : [],
          blockCount: blocks.length,
          firstBlockKeys: firstBlock ? Object.keys(firstBlock) : [],
          firstLineKeys: firstLine ? Object.keys(firstLine) : [],
          firstLineRaw: simplifyForLog(firstLine),
          normalizedFirstLines: lines.slice(0, 5),
          estimatedCoordinateSize: estimateCoordinateSize(lines)
        },
        null,
        2
      )
    );
  } catch (error) {
    console.log("[freshkeeper:ocr-debug-error]", error?.message || String(error));
  }
}

function estimateCoordinateSize(lines) {
  const boxes = lines.map((line) => line.box).filter(Boolean);
  if (!boxes.length) return null;
  const width = Math.max(...boxes.map((box) => box.x + box.width));
  const height = Math.max(...boxes.map((box) => box.y + box.height));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  return { width, height };
}

function simplifyForLog(value) {
  if (!value || typeof value !== "object") return value;
  const output = {};
  ["text", "value", "inferText", "frame", "boundingBox", "bounds", "rect", "cornerPoints", "points"].forEach((key) => {
    if (value[key] !== undefined) output[key] = value[key];
  });
  return output;
}

function numberOr(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return NaN;
}
