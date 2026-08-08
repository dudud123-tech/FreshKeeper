import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 국내 유통 상품에서 흔한 바코드 타입 위주. QR도 일부 상품 태그에 쓰여서 같이 넣는다.
const SCANNED_BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "itf14", "qr"];

// 프레임 하나만 보고 바로 확정하면(1-shot) 바코드가 사각형에 막 들어온 순간의
// 흐릿한 프레임을 잘못 읽어서 같은 상품이 다른 값으로 잡힐 수 있다(2026-08-08 피드백).
// 같은 값이 연속으로 이만큼 읽히고, 처음 잡힌 뒤 최소 시간이 지나야 확정한다.
const REQUIRED_MATCHING_SCANS = 4;
const MIN_SCAN_DURATION_MS = 400;

export default function BarcodeScannerModal({ visible, onScanned, onClose }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const hasScannedRef = useRef(false);
  const autoPromptedRef = useRef(false);
  // 지금 몇 번 연속으로 같은 값이 읽혔는지 추적한다. 다른 값이 끼어들면 처음부터 다시 센다.
  const candidateRef = useRef({ value: "", count: 0, firstSeenAt: 0 });
  const [confirmProgress, setConfirmProgress] = useState(0);
  // OS 자체 권한 팝업이 뜨는 동안엔 우리 쪽 "권한 허용" 화면을 같이 보여주면
  // 이중으로 떠 보인다. 첫 자동 요청이 끝나기 전까진 검정 화면만 두고,
  // 그래도 거부된 경우에만 우리 쪽 안내/재시도 버튼을 보여준다.
  const [autoPromptDone, setAutoPromptDone] = useState(false);

  useEffect(() => {
    if (!visible) {
      hasScannedRef.current = false;
      autoPromptedRef.current = false;
      candidateRef.current = { value: "", count: 0, firstSeenAt: 0 };
      setConfirmProgress(0);
      setAutoPromptDone(false);
      return;
    }
    if (!permission || permission.granted) return;
    if (!autoPromptedRef.current && permission.canAskAgain) {
      autoPromptedRef.current = true;
      requestPermission().finally(() => setAutoPromptDone(true));
    } else {
      setAutoPromptDone(true);
    }
  }, [visible, permission, requestPermission]);

  function handleBarcodeScanned(result) {
    if (hasScannedRef.current) return;
    const data = String(result?.data || "").trim();
    if (!data) return;

    const now = Date.now();
    const candidate = candidateRef.current;

    if (candidate.value === data) {
      candidate.count += 1;
    } else {
      // 다른 값이 읽혔다 = 아직 안정적으로 못 잡고 있다는 뜻. 처음부터 다시 센다.
      candidateRef.current = { value: data, count: 1, firstSeenAt: now };
    }

    const current = candidateRef.current;
    setConfirmProgress(Math.min(current.count / REQUIRED_MATCHING_SCANS, 1));

    const enoughScans = current.count >= REQUIRED_MATCHING_SCANS;
    const enoughTime = now - current.firstSeenAt >= MIN_SCAN_DURATION_MS;
    if (!enoughScans || !enoughTime) return;

    hasScannedRef.current = true;
    onScanned?.(current.value);
  }

  if (!visible) return null;

  const showPermissionDenied = permission && !permission.granted && !permission.canAskAgain;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: SCANNED_BARCODE_TYPES }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : autoPromptDone ? (
          <View style={styles.permissionFallback}>
            <Text style={styles.permissionText}>
              {showPermissionDenied
                ? "카메라 권한이 꺼져 있어요. 설정에서 카메라 권한을 허용해주세요."
                : "바코드를 스캔하려면 카메라 권한이 필요해요."}
            </Text>
            {!showPermissionDenied ? (
              <Pressable style={styles.permissionButton} onPress={requestPermission}>
                <Text style={styles.permissionButtonText}>권한 허용</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          // 첫 진입: OS 권한 팝업이 뜰 때까지 빈 검정 화면만 보여준다.
          <View style={styles.permissionFallback} />
        )}

        {permission?.granted ? (
          <View style={styles.overlay} pointerEvents="none">
            <View style={[styles.viewfinder, confirmProgress > 0 && styles.viewfinderActive]}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <Text style={styles.guideText}>
              {confirmProgress > 0 ? "인식 중이에요. 잠시 그대로 유지해 주세요" : "바코드를 사각형 안에 맞춰주세요"}
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(confirmProgress * 100)}%` }]} />
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          accessibilityLabel={"닫기"}
        >
          <Text style={styles.closeButtonText}>×</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  permissionFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16
  },
  permissionText: {
    color: "#fff",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22
  },
  permissionButton: {
    minHeight: 46,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: "#1f7a5a",
    alignItems: "center",
    justifyContent: "center"
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 18
  },
  viewfinder: {
    width: 260,
    height: 160
  },
  viewfinderActive: {
    // 인식이 진행 중일 때 사각형이 반응하는 느낌을 준다.
    opacity: 0.65
  },
  progressTrack: {
    width: 160,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)",
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#5ad1a0"
  },
  corner: {
    position: "absolute",
    width: 28,
    height: 28,
    borderColor: "#fff"
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderTopLeftRadius: 8
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
    borderTopRightRadius: 8
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderLeftWidth: 4,
    borderBottomWidth: 4,
    borderBottomLeftRadius: 8
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderBottomRightRadius: 8
  },
  guideText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4
  },
  closeButton: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center"
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 24
  }
});
