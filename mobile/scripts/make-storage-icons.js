// 보관 위치 아이콘(냉장/냉동/실온) 생성기.
//   node scripts/make-storage-icons.js assets/storage
// 모양을 바꾸려면 아래 fridge/freezer/room 함수의 좌표만 고치고 다시 돌리면 된다.
// 픽셀을 직접 채우고 node 기본 zlib로 PNG를 인코딩한다.
// tintColor로 색을 입히므로 RGB는 검정 고정, 모양은 알파 채널로만 표현한다.
const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

const N = 96;   // 최종 크기
const S = 4;    // 수퍼샘플링 배율 (계단 제거용)
const M = N * S;

// ── 도형 판정 ────────────────────────────────────────────────────────
function inRoundRect(px, py, x, y, w, h, r) {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return Math.hypot(px - cx, py - cy) <= r;
}
function inCircle(px, py, cx, cy, rad) {
  return Math.hypot(px - cx, py - cy) <= rad;
}
function ringRoundRect(px, py, x, y, w, h, r, th) {
  return inRoundRect(px, py, x, y, w, h, r) &&
    !inRoundRect(px, py, x + th, y + th, w - th * 2, h - th * 2, Math.max(r - th, 1));
}

// ── 아이콘 정의 ──────────────────────────────────────────────────────
// 냉장: 작은 각얼음 세 개 위에 올려진 것
function fridge(px, py) {
  if (inCircle(px, py, 48, 34, 18)) return true;                  // 올려진 것
  for (const x of [9, 38, 67]) {                                  // 각얼음 3개
    if (inRoundRect(px, py, x, 58, 20, 20, 4)) return true;       // 바로 아래에 붙인다
  }
  return false;
}

// 냉동: 큰 얼음 안에 갇힌 것
function freezer(px, py) {
  if (ringRoundRect(px, py, 8, 8, 80, 80, 16, 8)) return true;    // 얼음 덩어리
  if (inCircle(px, py, 48, 48, 15)) return true;                  // 갇힌 것
  return false;
}

// 실온: 선반 위에 올려진 것
function room(px, py) {
  if (inCircle(px, py, 48, 42, 18)) return true;                  // 올려진 것
  if (inRoundRect(px, py, 8, 62, 80, 9, 4)) return true;          // 선반 판
  if (inRoundRect(px, py, 17, 71, 8, 17, 3)) return true;         // 다리
  if (inRoundRect(px, py, 71, 71, 8, 17, 3)) return true;
  return false;
}

// ── 렌더 + PNG 인코딩 ────────────────────────────────────────────────
function render(shape) {
  const acc = new Float32Array(N * N);
  for (let j = 0; j < M; j++) {
    const py = (j + 0.5) / S;
    for (let i = 0; i < M; i++) {
      if (!shape((i + 0.5) / S, py)) continue;
      acc[Math.floor(j / S) * N + Math.floor(i / S)] += 1;
    }
  }
  const rgba = Buffer.alloc(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    rgba[k * 4 + 3] = Math.round((acc[k] / (S * S)) * 255); // RGB는 0(검정)
  }
  return rgba;
}

const CRC = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return (buf) => {
    let c = -1;
    for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
  };
})();

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(CRC(body));
  return Buffer.concat([len, body, crc]);
}

function png(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0);
  ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  const rows = Buffer.alloc((N * 4 + 1) * N);
  for (let y = 0; y < N; y++) {
    rows[y * (N * 4 + 1)] = 0; // filter: none
    rgba.copy(rows, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

const outDir = process.argv[2];
for (const [name, shape] of [["storage-fridge", fridge], ["storage-freezer", freezer], ["storage-room", room]]) {
  const file = path.join(outDir, name + ".png");
  fs.writeFileSync(file, png(render(shape)));
  console.log("생성: " + file + "  (" + fs.statSync(file).size + " bytes)");
}
